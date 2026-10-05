-- =====================================================================================
-- 0015 · Pantalla de etapa: inscripciones de la carrera y puntuaciones completas
-- =====================================================================================

-- Inscripciones de la carrera de una etapa: cada equipo de la liga con sus ciclistas y el total por ciclista.
-- Las de los demás solo se ven cuando cierra la inscripción (como en la política entry_read); las mías siempre.
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
               'member_id', m.id, 'team_name', m.team_name, 'is_mine', m.id = me.id,
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
    'riders', coalesce((
      select jsonb_agg(jsonb_build_object('rider_id', x.rider_id, 'name', r.name, 'pro_team', t.name,
                                          'nationality', r.nationality, 'photo_url', r.photo_url, 'teams', x.teams)
                       order by jsonb_array_length(x.teams) desc, r.market_value desc)
      from (select er.rider_id, jsonb_agg(m.team_name order by m.team_name) teams
            from public.race_entry e
            join public.league_member m on m.id = e.member_id
            join public.race_entry_rider er on er.entry_id = e.id
            where e.race_id = rc.id and e.league_id = p_league and (v_visible or e.member_id = me.id)
            group by er.rider_id) x
      join public.rider r on r.id = x.rider_id
      left join public.team t on t.id = r.team_id), '[]'::jsonb));
end $$;

grant execute on function public.get_race_entries(uuid, bigint) to authenticated;

-- Puntuaciones de una etapa: todos los equipos de la liga (también los que no puntúan) y todos los ciclistas
-- que puntúan, estén o no en un equipo, con quién los inscribió
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
                                          'is_mine', m.id = me.id)
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
