-- =====================================================================================
-- 0019 · País del equipo: se elige al crear la liga o al unirse y no se puede cambiar (no hay función para ello)
--        Se enseña con su bandera en la clasificación, la plantilla de cada equipo, la etapa y la carrera.
-- =====================================================================================

alter table public.league_member add column if not exists country text
  check (country is null or country ~ '^[a-z]{2}$');                     -- código ISO de 2 letras, como los ciclistas
grant select (country) on public.league_member to authenticated;

-- Funciones con un parámetro nuevo (opcional): hay que quitar las versiones anteriores
drop function if exists public.add_member(uuid, uuid, text);
drop function if exists public.create_league(text, text, jsonb);
drop function if exists public.join_league(text, text);
drop function if exists public.get_standings(uuid);

create function public.add_member(p_league uuid, p_user uuid, p_team_name text, p_country text default null)
returns uuid language plpgsql as $$
declare v_member uuid;
begin
  insert into public.league_member (league_id, user_id, team_name, country)
  values (p_league, p_user, p_team_name, nullif(lower(trim(p_country)), '')) returning id into v_member;
  perform public.post_ledger(v_member, 8000000, 'initial', null, 'Presupuesto inicial');
  perform public.assign_initial_team(v_member);
  return v_member;
end $$;

create function public.create_league(p_name text, p_team_name text, p_settings jsonb default '{}',
                                     p_country text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  s jsonb := coalesce(p_settings, '{}');
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para crear una liga'; end if;
  insert into public.league (name, admin_id, invite_code, max_riders, calendar_depth, market_size, market_hour,
                             clauses_enabled, payout_mode, payout_per_point, payout_by_position, next_market_at)
  values (trim(p_name), auth.uid(), public.gen_invite_code(),
          coalesce((s->>'max_riders')::smallint, 22),
          coalesce((s->>'calendar_depth')::smallint, 2),
          coalesce((s->>'market_size')::smallint, 10),
          coalesce((s->>'market_hour')::smallint, 8),
          coalesce((s->>'clauses_enabled')::boolean, true),
          coalesce((s->>'payout_mode')::public.payout_mode, 'per_point'),
          coalesce((s->>'payout_per_point')::integer, 100),
          coalesce((select array_agg(x::bigint) from jsonb_array_elements_text(s->'payout_by_position') x), '{}'),
          public.app_now())
  returning id into v_id;
  -- la semana de creación cuenta como ya iniciada: el primer cambio de semana es el próximo lunes
  insert into public.week_run (league_id, week_start) values (v_id, public.week_start(public.app_now()));
  perform public.add_member(v_id, auth.uid(), trim(p_team_name), p_country);
  perform public.resolve_market(v_id);          -- primer mercado
  return v_id;
end $$;

create function public.join_league(p_code text, p_team_name text, p_country text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare lg public.league;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para unirte a una liga'; end if;
  select * into lg from public.league where invite_code = upper(trim(p_code)) for update;
  if not found then raise exception 'No hay ninguna liga con ese código'; end if;
  if exists (select 1 from public.league_member where league_id = lg.id and user_id = auth.uid()) then
    return lg.id;
  end if;
  perform public.add_member(lg.id, auth.uid(), trim(p_team_name), p_country);
  return lg.id;
end $$;

create function public.get_standings(p_league uuid)
returns table (pos integer, member_id uuid, user_id uuid, team_name text, display_name text, avatar_url text,
               points_total integer, points_week integer, team_value bigint, country text)
language plpgsql stable security definer set search_path = public as $$
declare v_week date := public.week_start(public.app_now());
begin
  if not public.is_member(p_league) then raise exception 'No perteneces a esta liga' using errcode = '42501'; end if;
  return query
  with pts as (
    select m.id,
           coalesce(sum(ms.points), 0)::int as total,
           coalesce(sum(ms.points) filter (where s.date >= v_week), 0)::int as week
    from public.league_member m
    left join public.member_score ms on ms.member_id = m.id
    left join public.stage s on s.id = ms.stage_id
    where m.league_id = p_league
    group by m.id
  )
  select (rank() over (order by pts.total desc))::int, m.id, m.user_id, m.team_name, p.display_name, p.avatar_url,
         pts.total, pts.week, public.team_value(m.id), m.country
  from pts join public.league_member m on m.id = pts.id
  left join public.profile p on p.user_id = m.user_id
  order by pts.total desc, m.joined_at;
end $$;

grant execute on function public.create_league(text, text, jsonb, text), public.join_league(text, text, text),
  public.get_standings(uuid) to authenticated;

create or replace function public.get_race_detail(p_league uuid, p_race bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me public.league_member := public.my_member(p_league);
  v_last bigint;
begin
  select s.id into v_last from public.stage s where s.race_id = p_race and s.status = 'scored'
  order by s.number desc limit 1;
  return jsonb_build_object(
    'stages', coalesce((
      select jsonb_agg(jsonb_build_object(
               'stage_id', s.id, 'number', s.number, 'date', s.date, 'status', s.status,
               'my_points', (select coalesce(sum(points), 0) from public.member_score
                             where stage_id = s.id and member_id = me.id),
               'top_member', (select jsonb_build_object('team_name', m.team_name, 'points', sum(ms.points))
                              from public.member_score ms join public.league_member m on m.id = ms.member_id
                              where ms.stage_id = s.id and ms.league_id = p_league
                              group by m.id, m.team_name order by sum(ms.points) desc limit 1))
             order by s.number)
      from public.stage s where s.race_id = p_race), '[]'::jsonb),
    'league_total', coalesce((
      select jsonb_agg(jsonb_build_object('member_id', x.member_id, 'team_name', m.team_name, 'points', x.pts,
                                          'country', m.country)
                       order by x.pts desc)
      from (select ms.member_id, sum(ms.points)::int pts from public.member_score ms
            join public.stage s on s.id = ms.stage_id
            where s.race_id = p_race and ms.league_id = p_league group by ms.member_id) x
      join public.league_member m on m.id = x.member_id), '[]'::jsonb),
    'gc', coalesce((
      select jsonb_agg(jsonb_build_object('position', r.position, 'rider_id', rd.id, 'name', rd.name,
                                          'nationality', rd.nationality,
                                          -- equipos de la liga para los que sumó puntos en esta carrera
                                          'scored_for', coalesce((
                                            select jsonb_agg(x.team_name order by x.team_name)
                                            from (select distinct lm.team_name from public.member_score ms
                                                  join public.stage s2 on s2.id = ms.stage_id
                                                  join public.league_member lm on lm.id = ms.member_id
                                                  where s2.race_id = p_race and ms.league_id = p_league
                                                    and ms.rider_id = rd.id and ms.points > 0) x), '[]'::jsonb))
                       order by r.position)
      from public.result r join public.rider rd on rd.id = r.rider_id
      where r.stage_id = v_last
        and r.kind = case when (select is_stage_race from public.race where id = p_race) then 'gc' else 'stage' end
        and r.position <= 10), '[]'::jsonb));
end $$;

create or replace function public.get_stage_scores(p_league uuid, p_stage bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.league_member := public.my_member(p_league);
begin
  return jsonb_build_object(
    'stage', (select jsonb_build_object('id', s.id, 'number', s.number, 'date', s.date, 'status', s.status,
                                        'race_id', rc.id, 'race_name', rc.name, 'is_stage_race', rc.is_stage_race,
                                        'country', rc.country)
              from public.stage s join public.race rc on rc.id = s.race_id where s.id = p_stage),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('member_id', m.id, 'team_name', m.team_name, 'points', x.pts,
                                          'is_mine', m.id = me.id, 'country', m.country,
                                          -- sus ciclistas inscritos en la carrera y lo que ha puntuado cada uno
                                          -- (las inscripciones de los demás solo se ven al cerrar la inscripción)
                                          'riders', coalesce((
                                            select jsonb_agg(jsonb_build_object('rider_id', r.id, 'name', r.name,
                                                                                'points', coalesce(ms.points, 0))
                                                             order by coalesce(ms.points, 0) desc, r.market_value desc)
                                            from public.stage s
                                            join public.race rc on rc.id = s.race_id
                                            join public.race_entry e on e.race_id = rc.id and e.member_id = m.id
                                            join public.race_entry_rider er on er.entry_id = e.id
                                            join public.rider r on r.id = er.rider_id
                                            left join public.member_score ms on ms.stage_id = p_stage
                                                 and ms.member_id = m.id and ms.rider_id = r.id
                                            where s.id = p_stage
                                              and (m.id = me.id or public.app_now() >= rc.entries_close_at)), '[]'::jsonb))
                       order by x.pts desc, m.team_name)
      from public.league_member m
      cross join lateral (select coalesce(sum(ms.points), 0)::int pts from public.member_score ms
                          where ms.stage_id = p_stage and ms.member_id = m.id) x
      where m.league_id = p_league), '[]'::jsonb),
    'riders', coalesce((
      select jsonb_agg(jsonb_build_object('rider_id', r.id, 'name', r.name, 'points', x.pts, 'owner', own.team_name,
                                          'pro_team', t.name, 'nationality', r.nationality, 'photo_url', r.photo_url,
                                          'entered_by', coalesce((
                                            select jsonb_agg(lm.team_name order by lm.team_name)
                                            from public.member_score ms2 join public.league_member lm on lm.id = ms2.member_id
                                            where ms2.stage_id = p_stage and ms2.league_id = p_league
                                              and ms2.rider_id = r.id), '[]'::jsonb),
                                          'entered_by_me', exists (
                                            select 1 from public.member_score ms2
                                            where ms2.stage_id = p_stage and ms2.member_id = me.id
                                              and ms2.rider_id = r.id))
                       order by x.pts desc)
      from (select rs.rider_id, sum(rs.points)::int pts from public.rider_score rs
            where rs.stage_id = p_stage group by rs.rider_id) x
      join public.rider r on r.id = x.rider_id
      left join public.team t on t.id = r.team_id
      left join lateral (select lm.team_name from public.ownership o join public.league_member lm on lm.id = o.member_id
                         where o.league_id = p_league and o.rider_id = r.id) own on true), '[]'::jsonb));
end $$;

create or replace function public.get_race_entries(p_league uuid, p_stage bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me public.league_member := public.my_member(p_league);
  rc public.race;
  v_visible boolean;
begin
  select r.* into rc from public.stage s join public.race r on r.id = s.race_id where s.id = p_stage;
  if not found then raise exception 'La etapa no existe'; end if;
  v_visible := public.app_now() >= rc.entries_close_at;
  return jsonb_build_object(
    'race_id', rc.id,
    'visible', v_visible,
    'entries_close_at', rc.entries_close_at,
    'max_entries', (select max_entries from public.race_category where code = rc.category),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
               'member_id', m.id, 'team_name', m.team_name, 'is_mine', m.id = me.id, 'country', m.country,
               'hidden', not v_visible and m.id <> me.id,
               'entered', e.id is not null, 'auto', coalesce(e.auto, false),
               'riders', case when not v_visible and m.id <> me.id then '[]'::jsonb else coalesce((
                 select jsonb_agg(jsonb_build_object('rider_id', r.id, 'name', r.name, 'pro_team', t.name,
                                                     'nationality', r.nationality, 'photo_url', r.photo_url)
                                  order by r.market_value desc)
                 from public.race_entry_rider er join public.rider r on r.id = er.rider_id
                 left join public.team t on t.id = r.team_id
                 where er.entry_id = e.id), '[]'::jsonb) end)
             order by (m.id = me.id) desc, m.team_name)
      from public.league_member m
      left join public.race_entry e on e.race_id = rc.id and e.member_id = m.id
      where m.league_id = p_league), '[]'::jsonb),
    'startlist', coalesce((
      select jsonb_agg(jsonb_build_object('team_name', g.team_name, 'riders', g.riders) order by g.first_bib nulls last, g.team_name)
      from (
        select sr.team_name, min(sr.bib) first_bib,
               jsonb_agg(jsonb_build_object(
                 'rider_id', sr.rider_id, 'name', coalesce(r.name, sr.rider_name), 'nationality', coalesce(r.nationality, sr.nationality),
                 'bib', sr.bib, 'photo_url', r.photo_url,
                 'teams', coalesce((
                   select jsonb_agg(m.team_name order by m.team_name)
                   from public.race_entry e
                   join public.league_member m on m.id = e.member_id
                   join public.race_entry_rider er on er.entry_id = e.id
                   where e.race_id = rc.id and e.league_id = p_league and er.rider_id = sr.rider_id
                     and (v_visible or e.member_id = me.id)), '[]'::jsonb))
                 order by sr.bib nulls last, sr.rider_name) riders
        from public.startlist_rider sr
        left join public.rider r on r.id = sr.rider_id
        where sr.race_id = rc.id
        group by sr.team_name) g), '[]'::jsonb));
end $$;

-- Equipos que ya existían
update public.league_member set country = 'nl' where team_name = 'Prueba team' and country is null;
update public.league_member set country = 'es' where team_name = 'Prueba2 team' and country is null;
