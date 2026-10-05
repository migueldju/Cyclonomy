-- =====================================================================================
-- 0020 · Clasificación completa: guarda también a los corredores que no están en el juego, para que el top 10 del
--        desplegable del calendario (clásica o general final) salga entero
-- =====================================================================================

create table if not exists public.result_full (
  stage_id    bigint not null references public.stage(id) on delete cascade,
  kind        text not null check (kind in ('stage','gc','points','kom','kom_leader')),
  position    smallint not null check (position >= 1),
  rider_slug  text not null,
  rider_id    bigint references public.rider(id) on delete set null,   -- null: no está en el juego
  primary key (stage_id, kind, rider_slug)
);
alter table public.result_full enable row level security;
drop policy if exists read_all on public.result_full;
create policy read_all on public.result_full for select to authenticated using (true);
revoke all on public.result_full from anon, authenticated;
grant select on public.result_full to authenticated;

create or replace function public.get_race_detail(p_league uuid, p_race bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me public.league_member := public.my_member(p_league);
  rc public.race;
  v_last bigint;
  v_kind text;
begin
  select * into rc from public.race where id = p_race;
  select s.id into v_last from public.stage s where s.race_id = p_race and s.status = 'scored'
  order by s.number desc limit 1;
  v_kind := case when rc.is_stage_race then 'gc' else 'stage' end;

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
      select jsonb_agg(jsonb_build_object(
               'position', g.position, 'rider_id', g.rider_id, 'name', g.name, 'nationality', g.nationality,
               'in_game', g.rider_id is not null,
               'scored_for', coalesce((
                 select jsonb_agg(x.team_name order by x.team_name)
                 from (select distinct lm.team_name from public.member_score ms
                       join public.stage s2 on s2.id = ms.stage_id
                       join public.league_member lm on lm.id = ms.member_id
                       where s2.race_id = p_race and ms.league_id = p_league
                         and ms.rider_id = g.rider_id and ms.points > 0) x), '[]'::jsonb))
             order by g.position)
      from (
        -- clasificación completa si existe; si no (carreras antiguas), solo los del juego
        select f.position, f.rider_id,
               coalesce(rd.name, sl.rider_name, initcap(replace(f.rider_slug, '-', ' '))) as name,
               coalesce(rd.nationality, sl.nationality) as nationality
        from public.result_full f
        left join public.rider rd on rd.id = f.rider_id
        left join public.startlist_rider sl on sl.race_id = p_race and sl.rider_slug = f.rider_slug
        where f.stage_id = v_last and f.kind = v_kind and f.position <= 10
        union all
        select r.position, rd.id, rd.name, rd.nationality
        from public.result r join public.rider rd on rd.id = r.rider_id
        where r.stage_id = v_last and r.kind = v_kind and r.position <= 10
          and not exists (select 1 from public.result_full f where f.stage_id = v_last)
      ) g), '[]'::jsonb));
end $$;
