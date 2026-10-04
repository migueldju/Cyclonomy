-- =====================================================================================
-- 0001 · Catálogo: categorías, puntuación, equipos, ciclistas, carreras, etapas, resultados
-- Estos datos los escribe la ingesta (rol de servicio). La app solo los lee.
-- =====================================================================================
create extension if not exists pgcrypto;

-- Hora del juego. En producción es now(); en los tests se fija con: set app.now = '...';
create or replace function public.app_now() returns timestamptz
language sql stable as $$
  select coalesce(nullif(current_setting('app.now', true), '')::timestamptz, now())
$$;

-- Lunes 00:00 (Madrid) de la semana que contiene ts
create or replace function public.week_start(ts timestamptz) returns date
language sql immutable as $$
  select date_trunc('week', ts at time zone 'Europe/Madrid')::date
$$;

-- Próximo lunes a las 00:00 (Madrid), como timestamptz
create or replace function public.next_monday(ts timestamptz default null) returns timestamptz
language sql stable as $$
  select ((public.week_start(coalesce(ts, public.app_now())) + 7)::timestamp) at time zone 'Europe/Madrid'
$$;

-- ---------------------------------------------------------------- categorías y puntos
create table public.race_category (
  code         text primary key,
  name         text not null,
  depth_level  smallint not null check (depth_level between 1 and 4),
  max_entries  smallint not null check (max_entries > 0),
  is_itt       boolean not null default false
);
comment on column public.race_category.depth_level is
  '1 = WT de primer nivel · 2 = WT completo · 3 = hasta .Pro · 4 = hasta .1';

create table public.scoring_rule (
  category  text not null references public.race_category(code) on update cascade,
  kind      text not null check (kind in ('oneday','gc','stage','points_final','kom_final','kom_jersey')),
  position  smallint not null check (position >= 1),
  points    integer not null check (points >= 0),
  primary key (category, kind, position)
);

-- Reglas para decidir la categoría de una carrera a partir de su clase UCI y su nombre/slug.
-- Se evalúan por prioridad ascendente; gana la primera que encaja. Editable.
create table public.category_rule (
  id           serial primary key,
  priority     integer not null,
  category     text not null references public.race_category(code) on update cascade,
  uci_classes  text[] not null,           -- en mayúsculas: {'2.UWT'}, {'1.PRO','2.PRO'}, {'WC'}...
  pattern      text,                      -- regex sobre "slug nombre" en minúsculas; null = cualquiera
  itt          boolean                    -- true = solo CRI, false = solo no CRI, null = da igual
);

create or replace function public.is_itt_name(txt text) returns boolean
language sql immutable as $$
  select lower(txt) ~ '(\mitt\M|time trial|contre-la-montre|contrarreloj|\mcri\M|-itt\M|tijdrit|cronometro)'
$$;

create or replace function public.classify_race(p_slug text, p_name text, p_uci_class text)
returns text language sql stable as $$
  select r.category
  from public.category_rule r
  where upper(p_uci_class) = any (r.uci_classes)
    and (r.pattern is null or (lower(p_slug) || ' ' || lower(p_name)) ~ r.pattern)
    and (r.itt is null or r.itt = public.is_itt_name(p_slug || ' ' || p_name))
  order by r.priority
  limit 1
$$;

-- ---------------------------------------------------------------- equipos y ciclistas
create table public.team (
  id        bigserial primary key,
  pcs_slug  text not null unique,
  name      text not null,
  level     text not null check (level in ('WT','PRT')),
  season    smallint not null
);

create table public.rider (
  id               bigserial primary key,
  pcs_slug         text not null unique,
  name             text not null,
  nationality      text,
  birthdate        date,
  team_id          bigint references public.team(id) on delete set null,
  active           boolean not null default true,
  pcs_points_base  integer not null default 0,          -- puntos PCS de la temporada base (2026)
  market_value     bigint not null default 30000 check (market_value >= 0),
  photo_url        text,
  updated_at       timestamptz not null default now()
);
create index on public.rider (team_id) where active;

create table public.rider_value_history (
  rider_id  bigint not null references public.rider(id) on delete cascade,
  day       date not null,
  value     bigint not null,
  primary key (rider_id, day)
);

-- ---------------------------------------------------------------- carreras
create table public.race (
  id                 bigserial primary key,
  pcs_slug           text not null,
  season             smallint not null,
  name               text not null,
  uci_class          text not null,
  category           text not null references public.race_category(code) on update cascade,
  country            text,
  start_date         date not null,
  end_date           date not null,
  is_stage_race      boolean not null,
  -- cierre de inscripciones = salida de la 1.ª etapa. Hasta que el planificador lee la hora real,
  -- vale el día de salida a las 11:00 (Madrid).
  entries_close_at   timestamptz not null,
  auto_lineup_done   boolean not null default false,
  unique (pcs_slug, season)
);
create index on public.race (start_date);

create table public.stage (
  id              bigserial primary key,
  race_id         bigint not null references public.race(id) on delete cascade,
  number          smallint not null,                 -- 0 = prólogo; clásica = 1
  date            date not null,
  start_at        timestamptz,
  est_finish_at   timestamptz,
  distance_km     numeric(6,1),
  is_itt          boolean not null default false,
  status          text not null default 'scheduled'
                  check (status in ('scheduled','finished','scored')),
  scored_at       timestamptz,
  unique (race_id, number)
);
create index on public.stage (date);

create table public.startlist (
  race_id   bigint not null references public.race(id) on delete cascade,
  rider_id  bigint not null references public.rider(id) on delete cascade,
  primary key (race_id, rider_id)
);

-- Resultados tal cual los publica PCS, por etapa.
--   stage      = resultado de la etapa (o de la clásica)
--   gc/points/kom = clasificación tras esta etapa (la final es la de la última etapa)
--   kom_leader = quien lleva el maillot de la montaña tras la etapa (position 1)
create table public.result (
  stage_id  bigint not null references public.stage(id) on delete cascade,
  kind      text not null check (kind in ('stage','gc','points','kom','kom_leader')),
  rider_id  bigint not null references public.rider(id) on delete cascade,
  position  smallint not null check (position >= 1),
  primary key (stage_id, kind, rider_id)
);

-- Puntos del juego por ciclista y etapa (iguales para todas las ligas)
create table public.rider_score (
  stage_id  bigint not null references public.stage(id) on delete cascade,
  rider_id  bigint not null references public.rider(id) on delete cascade,
  kind      text not null,
  points    integer not null,
  primary key (stage_id, rider_id, kind)
);
create index on public.rider_score (rider_id);

-- Puntos por ciclista y temporada
create or replace view public.rider_season_points with (security_invoker = true) as
  select rs.rider_id, extract(year from s.date)::smallint as season, sum(rs.points)::integer as points
  from public.rider_score rs join public.stage s on s.id = rs.stage_id
  group by rs.rider_id, extract(year from s.date);

-- ---------------------------------------------------------------- parámetros del valor de mercado
create table public.value_params (
  id               boolean primary key default true check (id),
  floor_value      bigint  not null default 30000,      -- valor mínimo
  floor_points     numeric not null default 30,         -- puntos que valen el mínimo
  exponent         numeric not null default 1,          -- k (lo calcula seed_initial_values)
  anchor_slug      text    not null default 'tadej-pogacar',
  anchor_value     bigint  not null default 10000000,
  age_pivot        numeric not null default 28,
  age_step         numeric not null default 0.02,       -- ±2 % por año
  age_cap          numeric not null default 0.20,       -- tope ±20 %
  initial_round    bigint  not null default 10000,
  daily_round      bigint  not null default 1000,
  reversion        numeric not null default 0.10,       -- se acerca un 10 % al objetivo cada día
  hype_scale       numeric not null default 0.30,
  hype_cap         numeric not null default 0.03,       -- hype: ±3 %/día como mucho
  daily_cap        numeric not null default 0.05,       -- cambio diario máximo ±5 %
  game_start       date    not null default date '2027-01-01'  -- desde aquí pesan los puntos del juego
);
insert into public.value_params default values;

-- Estado de tareas periódicas (para no repetirlas)
create table public.job_state (
  key        text primary key,
  last_day   date,
  updated_at timestamptz not null default now()
);
