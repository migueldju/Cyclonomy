-- =====================================================================================
-- 0008 · Ranking de ciclistas y ficha de ciclista (resultados y evolución del valor)
-- =====================================================================================

-- Ciclistas activos por puntos de la temporada (y después por valor), con su dueño en la liga.
-- p_limit: solo los primeros (la pantalla de inicio enseña 3)
create or replace function public.get_ranking(p_league uuid, p_limit integer default null)
returns table (rider_id bigint, name text, pro_team text, nationality text, age integer, market_value bigint,
               season_points integer, owner_member_id uuid, owner_team text, is_mine boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  me public.league_member := public.my_member(p_league);
  v_season integer := extract(year from public.app_now() at time zone 'Europe/Madrid');
begin
  return query
  select r.id, r.name, t.name, r.nationality, public.age_at(r.birthdate)::int, r.market_value,
         coalesce(sp.points, 0), m.id, m.team_name, coalesce(m.id = me.id, false)
  from public.rider r
  left join public.team t on t.id = r.team_id
  left join public.rider_season_points sp on sp.rider_id = r.id and sp.season = v_season
  left join public.ownership o on o.league_id = p_league and o.rider_id = r.id
  left join public.league_member m on m.id = o.member_id
  where r.active
  order by coalesce(sp.points, 0) desc, r.market_value desc, r.name
  limit p_limit;
end $$;

-- Ficha de un ciclista: datos, dueño en la liga, valor del último año y resultados.
-- Resultados: el de cada etapa (o clásica) y las clasificaciones finales de las vueltas.
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
                                           where sp.rider_id = r.id and sp.season = v_season), 0))
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
               'stage_id', x.stage_id, 'race_id', x.race_id, 'race_name', x.race_name, 'category', x.category,
               'is_stage_race', x.is_stage_race, 'number', x.number, 'date', x.date, 'kind', x.kind,
               'position', x.position, 'points', x.points)
             order by x.date desc, x.kind_order)
      from (
        select s.id stage_id, rc.id race_id, rc.name race_name, rc.category, rc.is_stage_race, s.number, s.date,
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
                   and s.number = (select max(s2.number) from public.stage s2 where s2.race_id = rc.id)))
        order by s.date desc
        limit 300) x), '[]'::jsonb));
end $$;

grant execute on function public.get_ranking(uuid, integer), public.get_rider(uuid, bigint) to authenticated;
