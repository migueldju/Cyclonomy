-- =====================================================================================
-- 0016 · Lista de salida completa (todos los corredores, también los que no están en el juego, con su equipo
--        real y su dorsal) y su uso en las inscripciones de la pantalla de etapa
-- =====================================================================================

-- La tabla startlist sigue siendo la que usa el juego (solo ciclistas del juego); esta es para enseñarla entera
create table if not exists public.startlist_rider (
  race_id      bigint not null references public.race(id) on delete cascade,
  rider_slug   text not null,                           -- slug de PCS
  rider_name   text not null,
  nationality  text,
  bib          integer,                                 -- dorsal
  team_name    text not null,
  rider_id     bigint references public.rider(id) on delete set null,   -- si está en el juego
  primary key (race_id, rider_slug)
);
alter table public.startlist_rider enable row level security;
drop policy if exists read_all on public.startlist_rider;
create policy read_all on public.startlist_rider for select to authenticated using (true);
revoke all on public.startlist_rider from anon, authenticated;
grant select on public.startlist_rider to authenticated;

-- Inscripciones: además de las de cada equipo de la liga, la lista de salida completa agrupada por equipo real,
-- con los equipos de la liga que han inscrito a cada corredor (los de los demás, solo al cerrar la inscripción)
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
