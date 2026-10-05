-- =====================================================================================
-- 0011 · País de las carreras (bandera) en Hoy, inscripción, puntuaciones de etapa y ficha del ciclista
-- =====================================================================================

-- País de la carrera en el historial (lo rellena `python -m ingest history`)
alter table public.rider_history_result add column if not exists country text;

-- get_today + país (cambia el tipo de salida: hay que recrearla)
drop function if exists public.get_today(uuid);
create function public.get_today(p_league uuid)
returns table (stage_id bigint, race_id bigint, race_name text, category text, number integer, start_at timestamptz,
               est_finish_at timestamptz, distance_km numeric, status text, my_points integer, country text)
language plpgsql stable security definer set search_path = public as $$
declare
  me public.league_member := public.my_member(p_league);
  lg public.league;
  v_today date := (public.app_now() at time zone 'Europe/Madrid')::date;
begin
  select * into lg from public.league where id = p_league;
  return query
  select s.id, rc.id, rc.name, rc.category, s.number::int, s.start_at, s.est_finish_at, s.distance_km, s.status,
         (select coalesce(sum(ms.points), 0)::int from public.member_score ms
           where ms.stage_id = s.id and ms.member_id = me.id),
         rc.country
  from public.stage s join public.race rc on rc.id = s.race_id
  join public.race_category c on c.code = rc.category
  where s.date = v_today and c.depth_level <= lg.calendar_depth
  order by s.start_at nulls last, rc.name;
end $$;

grant execute on function public.get_today(uuid) to authenticated;

create or replace function public.get_entry(p_league uuid, p_race bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me public.league_member := public.my_member(p_league);
  rc public.race;
  cat public.race_category;
  v_season integer;
  v_entry bigint;
begin
  select * into rc from public.race where id = p_race;
  if not found then raise exception 'La carrera no existe'; end if;
  select * into cat from public.race_category where code = rc.category;
  v_season := extract(year from rc.start_date);
  select id into v_entry from public.race_entry where race_id = p_race and member_id = me.id;
  return jsonb_build_object(
    'race', jsonb_build_object('id', rc.id, 'name', rc.name, 'category', rc.category, 'category_name', cat.name,
                               'start_date', rc.start_date, 'end_date', rc.end_date, 'country', rc.country,
                               'entries_close_at', rc.entries_close_at),
    'max_entries', cat.max_entries,
    'open', public.app_now() < rc.entries_close_at,
    'auto', coalesce((select auto from public.race_entry where id = v_entry), false),
    'entered', coalesce((select jsonb_agg(rider_id) from public.race_entry_rider where entry_id = v_entry), '[]'::jsonb),
    'has_startlist', exists (select 1 from public.startlist where race_id = p_race),
    'riders', coalesce((
      select jsonb_agg(jsonb_build_object(
               'rider_id', r.id, 'name', r.name, 'pro_team', t.name, 'market_value', r.market_value,
               'season_points', coalesce(sp.points, 0),
               'on_startlist', exists (select 1 from public.startlist sl where sl.race_id = p_race and sl.rider_id = r.id),
               'available', o.member_id = me.id and o.pending_member_id is null and o.eligible_from <= public.app_now(),
               'status', case when o.pending_member_id = me.id or (o.pending_member_id is null and o.eligible_from > public.app_now())
                              then 'incoming' when o.pending_member_id is not null then 'leaving' else 'ok' end)
             order by coalesce(sp.points, 0) desc, r.market_value desc)
      from public.ownership o
      join public.rider r on r.id = o.rider_id
      left join public.team t on t.id = r.team_id
      left join public.rider_season_points sp on sp.rider_id = r.id and sp.season = v_season
      where o.league_id = p_league and (o.member_id = me.id or o.pending_member_id = me.id)), '[]'::jsonb));
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
      select jsonb_agg(jsonb_build_object('member_id', m.id, 'team_name', m.team_name, 'points', x.pts)
                       order by x.pts desc)
      from (select ms.member_id, sum(ms.points)::int pts from public.member_score ms
            where ms.stage_id = p_stage and ms.league_id = p_league group by ms.member_id) x
      join public.league_member m on m.id = x.member_id), '[]'::jsonb),
    'riders', coalesce((
      select jsonb_agg(jsonb_build_object('rider_id', r.id, 'name', r.name, 'points', x.pts, 'owner', own.team_name,
                                          'entered_by_me', exists (
                                            select 1 from public.member_score ms2
                                            where ms2.stage_id = p_stage and ms2.member_id = me.id
                                              and ms2.rider_id = r.id))
                       order by x.pts desc)
      from (select rs.rider_id, sum(rs.points)::int pts from public.rider_score rs
            where rs.stage_id = p_stage group by rs.rider_id) x
      join public.rider r on r.id = x.rider_id
      left join lateral (select lm.team_name from public.ownership o join public.league_member lm on lm.id = o.member_id
                         where o.league_id = p_league and o.rider_id = r.id) own on true), '[]'::jsonb));
end $$;

create or replace function public.get_rider(p_league uuid, p_rider bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me public.league_member := public.my_member(p_league);
  v_season integer := extract(year from public.app_now() at time zone 'Europe/Madrid');
  v_today date := (public.app_now() at time zone 'Europe/Madrid')::date;
begin
  if not exists (select 1 from public.rider where id = p_rider) then
    raise exception 'El ciclista no existe';
  end if;
  return jsonb_build_object(
    'rider', (select jsonb_build_object(
                'id', r.id, 'name', r.name, 'pro_team', t.name, 'nationality', r.nationality,
                'age', public.age_at(r.birthdate)::int, 'market_value', r.market_value,
                'season_points', coalesce((select sp.points from public.rider_season_points sp
                                           where sp.rider_id = r.id and sp.season = v_season), 0),
                'photo', case when r.photo_url is null then null else jsonb_build_object(
                           'url', r.photo_url, 'author', r.photo_author, 'license', r.photo_license,
                           'license_url', r.photo_license_url, 'page_url', r.photo_page_url) end)
              from public.rider r left join public.team t on t.id = r.team_id where r.id = p_rider),
    'owner', (select jsonb_build_object('member_id', m.id, 'team_name', m.team_name, 'is_mine', m.id = me.id,
                                        'clause', o.clause)
              from public.ownership o join public.league_member m on m.id = o.member_id
              where o.league_id = p_league and o.rider_id = p_rider),
    'values', coalesce((
      select jsonb_agg(jsonb_build_object('day', h.day, 'value', h.value) order by h.day)
      from public.rider_value_history h
      where h.rider_id = p_rider and h.day > v_today - 365), '[]'::jsonb),
    'results', coalesce((
      select jsonb_agg(jsonb_build_object(
               'stage_id', x.stage_id, 'race_key', x.race_key, 'race_start', x.race_start, 'race_end', x.race_end,
               'race_name', x.race_name, 'country', x.country, 'category', x.category,
               'is_stage_race', x.is_stage_race, 'number', x.number, 'date', x.date, 'kind', x.kind,
               'position', x.position, 'points', x.points)
             order by x.date desc, x.kind_order)
      from (
        -- resultados del juego
        (select s.id stage_id, 'g' || rc.id race_key, rc.start_date race_start, rc.end_date race_end, rc.name race_name, rc.country, rc.category, rc.is_stage_race, s.number, s.date,
                res.kind, res.position,
                case res.kind when 'stage' then 0 when 'gc' then 1 when 'points' then 2 else 3 end kind_order,
                coalesce((select sum(rs.points)::int from public.rider_score rs
                          where rs.stage_id = s.id and rs.rider_id = p_rider
                            and rs.kind = case res.kind when 'stage' then (case when rc.is_stage_race then 'stage' else 'oneday' end)
                                                        when 'gc' then 'gc' when 'points' then 'points_final'
                                                        else 'kom_final' end), 0) points
         from public.result res
         join public.stage s on s.id = res.stage_id
         join public.race rc on rc.id = s.race_id
         where res.rider_id = p_rider
           and (res.kind = 'stage'
                or (rc.is_stage_race and res.kind in ('gc', 'points', 'kom')
                    and s.number = (select max(s2.number) from public.stage s2 where s2.race_id = rc.id))))
        union all
        -- historial: los puntos son los que daría la tabla de puntuación del juego
        (select null::bigint, 'h' || h.season || '-' || h.race_slug,
                min(h.date) over (partition by h.season, h.race_slug), max(h.date) over (partition by h.season, h.race_slug),
                h.race_name, h.country, h.category, h.is_stage_race, h.number, h.date, h.kind, h.position,
                case h.kind when 'stage' then 0 when 'gc' then 1 when 'points' then 2 else 3 end,
                coalesce((select sr.points from public.scoring_rule sr
                          where sr.category = h.category and sr.position = h.position
                            and sr.kind = case h.kind when 'stage' then (case when h.is_stage_race then 'stage' else 'oneday' end)
                                                      when 'gc' then 'gc' when 'points' then 'points_final'
                                                      else 'kom_final' end), 0)
         from public.rider_history_result h
         where h.rider_id = p_rider)
        order by 10 desc
        limit 600) x), '[]'::jsonb));
end $$;
