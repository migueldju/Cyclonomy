-- =====================================================================================
-- 0018 · Desplegable del calendario: la clasificación con la bandera de cada ciclista y los equipos de la liga
--        para los que sumó puntos
-- =====================================================================================

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
      select jsonb_agg(jsonb_build_object('member_id', x.member_id, 'team_name', m.team_name, 'points', x.pts)
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
