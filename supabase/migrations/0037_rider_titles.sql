-- =====================================================================================
-- 0037 · Campeones: los ganadores de los campeonatos nacionales, continentales y del mundo (ruta y contrarreloj,
--        hombres élite), para mostrarlos con su maillot en la app. Cada título vale desde su campeonato hasta la
--        siguiente edición (según la fecha del juego, también en la simulación).
-- =====================================================================================

create table if not exists public.rider_title (
  race_slug   text primary key,                       -- p. ej. nc-spain-2026, uec-road-european-championships-me
  season      smallint not null,
  date        date not null,
  level       text not null check (level in ('nc', 'cc', 'wc')),
  discipline  text not null check (discipline in ('rr', 'itt')),
  scope       text not null,                          -- país (nc), continente (cc: europe, asia, …) o 'world'
  rider_slug  text not null
);
create index if not exists rider_title_rider on public.rider_title (rider_slug);
alter table public.rider_title enable row level security;

-- Títulos vigentes en la fecha del juego, de los ciclistas del juego
create or replace function public.get_current_titles() returns jsonb
language sql stable security definer set search_path = public as $$
  with today as (select (public.app_now() at time zone 'Europe/Madrid')::date d),
  latest as (
    select distinct on (t.level, t.discipline, t.scope) t.*
    from public.rider_title t, today
    where t.date <= today.d
    order by t.level, t.discipline, t.scope, t.date desc
  )
  select coalesce(jsonb_agg(jsonb_build_object('rider_id', r.id, 'level', l.level, 'discipline', l.discipline,
                                               'scope', l.scope)
                            order by l.level desc, l.discipline), '[]'::jsonb)
  from latest l join public.rider r on r.pcs_slug = l.rider_slug
$$;
revoke all on function public.get_current_titles() from public, anon;
grant execute on function public.get_current_titles() to authenticated;
