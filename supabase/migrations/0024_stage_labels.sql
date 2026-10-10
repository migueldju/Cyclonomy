-- =====================================================================================
-- 0024 · Etapa del día: el calendario devuelve las etapas de cada carrera (número y fecha) y las carreras de hoy,
--        si son por etapas y cuántas tienen, para mostrar «Etapa 2/21» o «Carrera de un día»
-- =====================================================================================

drop function if exists public.get_calendar(uuid, date);
create function public.get_calendar(p_league uuid, p_from date default null)
returns table (race_id bigint, name text, category text, category_name text, country text,
               start_date date, end_date date, is_stage_race boolean, n_stages integer,
               entries_close_at timestamptz, entries_open boolean, max_entries integer,
               my_entry_count integer, status text, stages jsonb)
language plpgsql stable security definer set search_path = public as $$
declare
  me public.league_member := public.my_member(p_league);
  lg public.league;
  v_today date := (public.app_now() at time zone 'Europe/Madrid')::date;
begin
  select * into lg from public.league where id = p_league;
  return query
  select rc.id, rc.name, rc.category, c.name, rc.country, rc.start_date, rc.end_date, rc.is_stage_race,
         (select count(*)::int from public.stage s where s.race_id = rc.id),
         rc.entries_close_at, public.app_now() < rc.entries_close_at, c.max_entries::int,
         (select count(*)::int from public.race_entry e join public.race_entry_rider er on er.entry_id = e.id
           where e.race_id = rc.id and e.member_id = me.id),
         case when rc.end_date < v_today then 'finished'
              when public.app_now() >= rc.entries_close_at then 'live'
              else 'upcoming' end,
         coalesce((select jsonb_agg(jsonb_build_object('number', s.number, 'date', s.date) order by s.number)
                   from public.stage s where s.race_id = rc.id), '[]'::jsonb)
  from public.race rc join public.race_category c on c.code = rc.category
  where c.depth_level <= lg.calendar_depth
    and rc.start_date >= coalesce(p_from, make_date(extract(year from v_today)::int, 1, 1))
  order by rc.start_date, rc.name;
end $$;
revoke all on function public.get_calendar(uuid, date) from public, anon;
grant execute on function public.get_calendar(uuid, date) to authenticated;

drop function if exists public.get_today(uuid);
create function public.get_today(p_league uuid)
returns table (stage_id bigint, race_id bigint, race_name text, category text, number integer, start_at timestamptz,
               est_finish_at timestamptz, distance_km numeric, status text, my_points integer, country text,
               is_stage_race boolean, last_stage integer)
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
         rc.country, rc.is_stage_race,
         (select max(x.number)::int from public.stage x where x.race_id = rc.id)
  from public.stage s join public.race rc on rc.id = s.race_id
  join public.race_category c on c.code = rc.category
  where s.date = v_today and c.depth_level <= lg.calendar_depth
  order by s.start_at nulls last, rc.name;
end $$;
revoke all on function public.get_today(uuid) from public, anon;
grant execute on function public.get_today(uuid) to authenticated;
