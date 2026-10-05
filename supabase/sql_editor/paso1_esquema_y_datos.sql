-- PASO 1 de 2 · Fantasy Ciclismo: esquema, lógica del juego, seguridad y datos iniciales.
-- Pégalo entero en Supabase → SQL Editor → New query → Run. Ejecútalo UNA sola vez en un proyecto vacío.


-- ============================================================ migrations/0001_catalog.sql
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

-- ============================================================ migrations/0002_game.sql
-- =====================================================================================
-- 0002 · Juego: perfiles, ligas, jugadores, dinero, plantillas, mercado, ofertas,
--        inscripciones y puntos por liga
-- =====================================================================================

create table public.profile (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default 'Jugador' check (length(display_name) between 1 and 40),
  avatar_url    text,
  created_at    timestamptz not null default now()
);

create type public.payout_mode as enum ('per_point', 'by_position', 'mixed');

create table public.league (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (length(name) between 1 and 60),
  admin_id            uuid not null references auth.users(id),
  invite_code         text not null unique,
  max_riders          smallint not null default 22 check (max_riders between 16 and 60),
  calendar_depth      smallint not null default 2 check (calendar_depth between 1 and 4),
  market_size         smallint not null default 10 check (market_size between 1 and 30),
  market_hour         smallint not null default 8 check (market_hour between 0 and 23),
  clauses_enabled     boolean not null default true,
  payout_mode         public.payout_mode not null default 'per_point',
  payout_per_point    integer not null default 100 check (payout_per_point >= 0),
  payout_by_position  bigint[] not null default '{}',   -- importe por puesto semanal: {1.º, 2.º, ...}
  next_market_at      timestamptz not null,
  created_at          timestamptz not null default now()
);

create table public.league_member (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null references public.league(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  team_name  text not null check (length(team_name) between 1 and 40),
  balance    bigint not null default 0,      -- caché de sum(ledger.amount); solo lo cambia post_ledger()
  joined_at  timestamptz not null default now(),
  unique (league_id, user_id)
);
create index on public.league_member (user_id);

-- Libro de movimientos: TODO cambio de dinero pasa por aquí (post_ledger)
create table public.ledger (
  id          bigserial primary key,
  member_id   uuid not null references public.league_member(id) on delete cascade,
  amount      bigint not null,
  kind        text not null check (kind in (
                'initial','market_buy','clause_paid','clause_received','clause_raise',
                'sale_game','offer_paid','offer_received','payout_points','payout_position','adjustment')),
  rider_id    bigint references public.rider(id) on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);
create index on public.ledger (member_id);
create index on public.ledger (rider_id, created_at);

-- Plantillas. Un ciclista tiene como mucho un dueño por liga.
--   naranja (llega el lunes): eligible_from > ahora  ·  o pending_member_id = yo
--   rojo (se va el lunes):    pending_member_id no nulo y member_id = yo
create table public.ownership (
  id                 bigserial primary key,
  league_id          uuid not null references public.league(id) on delete cascade,
  rider_id           bigint not null references public.rider(id) on delete cascade,
  member_id          uuid not null references public.league_member(id) on delete cascade,
  price_paid         bigint not null check (price_paid >= 0),
  clause             bigint not null check (clause >= 0),
  acquired_at        timestamptz not null,
  eligible_from      timestamptz not null,
  pending_member_id  uuid references public.league_member(id) on delete cascade,
  pending_price      bigint,
  transfer_at        timestamptz,
  for_sale           boolean not null default false,
  unique (league_id, rider_id),
  check ((pending_member_id is null) = (transfer_at is null))
);
create index on public.ownership (member_id);
create index on public.ownership (pending_member_id) where pending_member_id is not null;

-- Mercado diario
create table public.market_listing (
  id                bigserial primary key,
  league_id         uuid not null references public.league(id) on delete cascade,
  rider_id          bigint not null references public.rider(id) on delete cascade,
  base_value        bigint not null,
  opened_at         timestamptz not null,
  closes_at         timestamptz not null,
  resolved          boolean not null default false,
  winner_member_id  uuid references public.league_member(id) on delete set null,
  price             bigint
);
create unique index market_listing_open_uq on public.market_listing (league_id, rider_id) where not resolved;
create index on public.market_listing (league_id, resolved);

create table public.bid (
  listing_id  bigint not null references public.market_listing(id) on delete cascade,
  member_id   uuid not null references public.league_member(id) on delete cascade,
  amount      bigint not null check (amount > 0),
  placed_at   timestamptz not null default clock_timestamp(),   -- hora en que se fijó esta cantidad
  primary key (listing_id, member_id)
);

-- Oferta del juego por un ciclista puesto a la venta (valor ±10 %)
create table public.game_offer (
  id            bigserial primary key,
  ownership_id  bigint references public.ownership(id) on delete set null,
  member_id     uuid not null references public.league_member(id) on delete cascade,
  rider_id      bigint not null references public.rider(id) on delete cascade,
  amount        bigint not null,
  created_at    timestamptz not null,
  expires_at    timestamptz not null,
  status        text not null default 'open' check (status in ('open','accepted','expired'))
);
create index on public.game_offer (member_id, status);

-- Ofertas entre jugadores
create table public.transfer_offer (
  id              bigserial primary key,
  league_id       uuid not null references public.league(id) on delete cascade,
  ownership_id    bigint references public.ownership(id) on delete set null,
  rider_id        bigint not null references public.rider(id) on delete cascade,
  from_member_id  uuid not null references public.league_member(id) on delete cascade,  -- comprador
  to_member_id    uuid not null references public.league_member(id) on delete cascade,  -- dueño
  amount          bigint not null check (amount > 0),
  created_at      timestamptz not null,
  expires_at      timestamptz not null,
  status          text not null default 'open'
                  check (status in ('open','accepted','rejected','expired','cancelled'))
);
create unique index transfer_offer_open_uq on public.transfer_offer (ownership_id, from_member_id)
  where status = 'open';

-- Inscripciones por carrera
create table public.race_entry (
  id          bigserial primary key,
  league_id   uuid not null references public.league(id) on delete cascade,
  race_id     bigint not null references public.race(id) on delete cascade,
  member_id   uuid not null references public.league_member(id) on delete cascade,
  auto        boolean not null default false,
  updated_at  timestamptz not null default now(),
  unique (league_id, race_id, member_id)
);
create table public.race_entry_rider (
  entry_id  bigint not null references public.race_entry(id) on delete cascade,
  rider_id  bigint not null references public.rider(id) on delete cascade,
  primary key (entry_id, rider_id)
);

-- Semana de cada jugador: si el lunes tenía saldo negativo, no puntúa esa semana
create table public.member_week (
  member_id   uuid not null references public.league_member(id) on delete cascade,
  week_start  date not null,
  eligible    boolean not null,
  primary key (member_id, week_start)
);

-- Puntos de cada jugador por etapa y ciclista inscrito
create table public.member_score (
  league_id  uuid not null references public.league(id) on delete cascade,
  member_id  uuid not null references public.league_member(id) on delete cascade,
  stage_id   bigint not null references public.stage(id) on delete cascade,
  rider_id   bigint not null references public.rider(id) on delete cascade,
  points     integer not null,
  primary key (member_id, stage_id, rider_id)
);
create index on public.member_score (league_id, stage_id);

-- Cambio de semana hecho (pagos + traspasos + control de deuda), uno por liga y semana
create table public.week_run (
  league_id   uuid not null references public.league(id) on delete cascade,
  week_start  date not null,
  done_at     timestamptz not null default now(),
  primary key (league_id, week_start)
);

-- ============================================================ migrations/0003_logic.sql
-- =====================================================================================
-- 0003 · Lógica interna y tareas programadas. Ninguna de estas funciones se expone a la app
--        (0005 les quita el permiso de ejecución); las llaman las RPC, pg_cron o la ingesta.
-- =====================================================================================

-- ---------------------------------------------------------------- dinero y plantilla
create or replace function public.post_ledger(p_member uuid, p_amount bigint, p_kind text,
                                              p_rider bigint default null, p_note text default null)
returns void language plpgsql as $$
begin
  insert into public.ledger (member_id, amount, kind, rider_id, note, created_at)
  values (p_member, p_amount, p_kind, p_rider, p_note, public.app_now());
  update public.league_member set balance = balance + p_amount where id = p_member;
end $$;

-- Plantilla efectiva: lo que tengo y no se va + lo que me llega
create or replace function public.roster_count(p_member uuid) returns integer
language sql stable as $$
  select count(*)::int from public.ownership
  where (member_id = p_member and pending_member_id is null) or pending_member_id = p_member
$$;

create or replace function public.team_value(p_member uuid) returns bigint
language sql stable as $$
  select coalesce(sum(r.market_value), 0)::bigint
  from public.ownership o join public.rider r on r.id = o.rider_id
  where (o.member_id = p_member and o.pending_member_id is null) or o.pending_member_id = p_member
$$;

create or replace function public.committed_bids(p_member uuid, p_except_listing bigint default null)
returns bigint language sql stable as $$
  select coalesce(sum(b.amount), 0)::bigint
  from public.bid b join public.market_listing l on l.id = b.listing_id
  where b.member_id = p_member and not l.resolved and l.id is distinct from p_except_listing
$$;

-- Límite de deuda: el saldo, descontando pujas abiertas, no puede bajar de −20 % del valor de la plantilla
create or replace function public.debt_limit(p_member uuid) returns bigint
language sql stable as $$
  select (public.team_value(p_member) * 0.20)::bigint
$$;

create or replace function public.can_spend(p_member uuid, p_amount bigint, p_except_listing bigint default null)
returns boolean language sql stable as $$
  select m.balance - public.committed_bids(p_member, p_except_listing) - p_amount >= -public.debt_limit(p_member)
  from public.league_member m where m.id = p_member
$$;

-- ---------------------------------------------------------------- utilidades
create or replace function public.next_market_time(p_hour int, p_after timestamptz default null)
returns timestamptz language plpgsql stable as $$
declare
  base timestamptz := coalesce(p_after, public.app_now());
  d date := (base at time zone 'Europe/Madrid')::date;
  t timestamptz;
begin
  t := (d::timestamp + make_interval(hours => p_hour)) at time zone 'Europe/Madrid';
  if t <= base then
    t := ((d + 1)::timestamp + make_interval(hours => p_hour)) at time zone 'Europe/Madrid';
  end if;
  return t;
end $$;

create or replace function public.gen_invite_code() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.league where invite_code = code);
  end loop;
  return code;
end $$;

create or replace function public.age_at(p_birth date, p_day date default null) returns numeric
language sql stable as $$
  select date_part('year', age(coalesce(p_day, (public.app_now() at time zone 'Europe/Madrid')::date), p_birth))::numeric
$$;

-- Ciclistas libres en una liga (sin dueño y fuera del mercado abierto)
create or replace function public.free_riders(p_league uuid)
returns table (id bigint, market_value bigint) language sql stable as $$
  select r.id, r.market_value from public.rider r
  where r.active and r.team_id is not null
    and not exists (select 1 from public.ownership o where o.league_id = p_league and o.rider_id = r.id)
    and not exists (select 1 from public.market_listing l
                    where l.league_id = p_league and l.rider_id = r.id and not l.resolved)
$$;

-- ---------------------------------------------------------------- valor de mercado
create or replace function public.value_from_points(p_points numeric, p_age numeric, p_round bigint default null)
returns bigint language sql stable as $$
  -- 30 puntos o menos = valor mínimo exacto (sin ajuste por edad)
  select case when coalesce(p_points, 0) <= vp.floor_points then vp.floor_value
         else greatest(vp.floor_value,
           (round(
              vp.floor_value * power(p_points / vp.floor_points, vp.exponent)
              * (1 + case when p_age is null then 0
                          else greatest(-vp.age_cap, least(vp.age_cap, vp.age_step * (vp.age_pivot - p_age))) end)
              / coalesce(p_round, vp.initial_round)) * coalesce(p_round, vp.initial_round))::bigint) end
  from public.value_params vp
$$;

-- Valores iniciales a partir de pcs_points_base. Calcula k para que el ancla (Pogačar) valga anchor_value.
create or replace function public.seed_initial_values() returns integer
language plpgsql as $$
declare
  vp public.value_params;
  p_anchor numeric;
  n integer;
  today date := (public.app_now() at time zone 'Europe/Madrid')::date;
begin
  select * into vp from public.value_params;
  select pcs_points_base into p_anchor from public.rider where pcs_slug = vp.anchor_slug;
  if p_anchor is null or p_anchor <= vp.floor_points then
    select max(pcs_points_base) into p_anchor from public.rider;      -- sin ancla: el mejor ciclista
  end if;
  if p_anchor > vp.floor_points then
    update public.value_params
       set exponent = ln(vp.anchor_value::numeric / vp.floor_value) / ln(p_anchor / vp.floor_points);
  end if;
  update public.rider r
     set market_value = public.value_from_points(r.pcs_points_base, public.age_at(r.birthdate)),
         updated_at = now();
  get diagnostics n = row_count;
  update public.rider set market_value = vp.anchor_value where pcs_slug = vp.anchor_slug;
  insert into public.rider_value_history (rider_id, day, value)
  select id, today, market_value from public.rider
  on conflict (rider_id, day) do update set value = excluded.value;
  return n;
end $$;

-- Actualización diaria: rendimiento (365 días) + hype (fichajes y clausulazos en todas las ligas)
create or replace function public.update_rider_values() returns integer
language plpgsql as $$
declare
  vp public.value_params;
  today date := (public.app_now() at time zone 'Europe/Madrid')::date;
  base_w numeric;
  n_leagues integer;
  n integer;
begin
  select * into vp from public.value_params;
  -- peso de los puntos PCS base: 1 antes de empezar el juego, baja a 0 en 365 días
  base_w := greatest(0, 1 - greatest(0, today - vp.game_start)::numeric / 365);
  select greatest(count(*), 1) into n_leagues from public.league;

  with pts as (
    select rs.rider_id, sum(rs.points) as p
    from public.rider_score rs join public.stage s on s.id = rs.stage_id
    where s.date > today - 365 and s.date <= today
    group by rs.rider_id
  ), hype as (
    select l.rider_id,
           sum(case l.kind when 'market_buy' then 1 when 'clause_paid' then 2 when 'sale_game' then -1 end)::numeric as h
    from public.ledger l
    where l.created_at > public.app_now() - interval '7 days'
      and l.kind in ('market_buy', 'clause_paid', 'sale_game') and l.rider_id is not null
    group by l.rider_id
  ), calc as (
    select r.id, r.market_value::numeric as v,
           public.value_from_points(coalesce(pts.p, 0) + r.pcs_points_base * base_w,
                                    public.age_at(r.birthdate, today), vp.daily_round)::numeric as target,
           greatest(-vp.hype_cap, least(vp.hype_cap, coalesce(hype.h, 0) / n_leagues * vp.hype_scale)) as hype_pct
    from public.rider r
    left join pts on pts.rider_id = r.id
    left join hype on hype.rider_id = r.id
    where r.active
  )
  update public.rider r
     set market_value = greatest(vp.floor_value,
           round((c.v + greatest(-vp.daily_cap * c.v,
                                 least(vp.daily_cap * c.v, vp.reversion * (c.target - c.v) + c.hype_pct * c.v)))
                 / vp.daily_round) * vp.daily_round)::bigint,
         updated_at = now()
  from calc c where c.id = r.id;
  get diagnostics n = row_count;

  insert into public.rider_value_history (rider_id, day, value)
  select id, today, market_value from public.rider where active
  on conflict (rider_id, day) do update set value = excluded.value;
  insert into public.job_state (key, last_day) values ('rider_values', today)
  on conflict (key) do update set last_day = excluded.last_day, updated_at = now();
  return n;
end $$;

-- ---------------------------------------------------------------- plantilla inicial
-- 16 ciclistas libres al azar que sumen ~4.000.000 € (±100.000). Intercambia ciclistas hasta acercarse.
create or replace function public.assign_initial_team(p_member uuid, p_count int default 16,
    p_target bigint default 4000000, p_tol bigint default 100000, p_cap bigint default 1500000)
returns void language plpgsql as $$
declare
  v_league uuid;
  picked bigint[];
  s bigint; x bigint; xv bigint; y bigint; yv bigint; desired bigint;
begin
  select league_id into v_league from public.league_member where id = p_member;
  select array_agg(f.id) into picked
  from (select f.id from public.free_riders(v_league) f where f.market_value <= p_cap order by random() limit p_count) f;
  if picked is null then return; end if;

  for i in 1..400 loop
    select sum(market_value) into s from public.rider where id = any (picked);
    exit when abs(s - p_target) <= p_tol;
    x := picked[1 + floor(random() * array_length(picked, 1))::int];
    select market_value into xv from public.rider where id = x;
    desired := xv + (p_target - s);
    select c.id, c.market_value into y, yv
    from (select f.id, f.market_value from public.free_riders(v_league) f
          where f.market_value <= p_cap and not (f.id = any (picked))
          order by abs(f.market_value - desired) limit 5) c
    order by random() limit 1;
    if y is not null and abs(s - xv + yv - p_target) < abs(s - p_target) then
      picked := array_replace(picked, x, y);
    end if;
  end loop;

  insert into public.ownership (league_id, rider_id, member_id, price_paid, clause, acquired_at, eligible_from)
  select v_league, r.id, p_member, r.market_value, round(r.market_value * 1.5), public.app_now(), public.app_now()
  from public.rider r where r.id = any (picked);
end $$;

-- Alta de un jugador: 8.000.000 € + 16 ciclistas
create or replace function public.add_member(p_league uuid, p_user uuid, p_team_name text)
returns uuid language plpgsql as $$
declare v_member uuid;
begin
  insert into public.league_member (league_id, user_id, team_name)
  values (p_league, p_user, p_team_name) returning id into v_member;
  perform public.post_ledger(v_member, 8000000, 'initial', null, 'Presupuesto inicial');
  perform public.assign_initial_team(v_member);
  return v_member;
end $$;

-- ---------------------------------------------------------------- mercado
create or replace function public.resolve_market(p_league uuid) returns void
language plpgsql as $$
declare
  lg public.league;
  l record; b record;
  v_now timestamptz := public.app_now();
  v_next timestamptz;
  won boolean;
begin
  select * into lg from public.league where id = p_league for update;

  -- 1. Cerrar subastas vencidas, empezando por las de puja más alta
  for l in
    select ml.* from public.market_listing ml
    where ml.league_id = p_league and not ml.resolved and ml.closes_at <= v_now
    order by (select max(amount) from public.bid where listing_id = ml.id) desc nulls last, ml.id
  loop
    won := false;
    for b in select * from public.bid where listing_id = l.id order by amount desc, placed_at asc loop
      if public.roster_count(b.member_id) < lg.max_riders and public.can_spend(b.member_id, b.amount, l.id) then
        perform public.post_ledger(b.member_id, -b.amount, 'market_buy', l.rider_id, 'Subasta del mercado');
        insert into public.ownership (league_id, rider_id, member_id, price_paid, clause, acquired_at, eligible_from)
        values (p_league, l.rider_id, b.member_id, b.amount, round(b.amount * 1.5), v_now, public.next_monday(v_now));
        update public.market_listing set resolved = true, winner_member_id = b.member_id, price = b.amount
        where id = l.id;
        won := true;
        exit;
      end if;
    end loop;
    if not won then
      update public.market_listing set resolved = true where id = l.id;
    end if;
  end loop;

  v_next := public.next_market_time(lg.market_hour, v_now);

  -- 2. Ofertas del juego: caducan las anteriores y se hacen nuevas para lo que está a la venta
  update public.game_offer g set status = 'expired'
  from public.league_member m
  where g.member_id = m.id and m.league_id = p_league and g.status = 'open';
  insert into public.game_offer (ownership_id, member_id, rider_id, amount, created_at, expires_at)
  select o.id, o.member_id, o.rider_id, (round(r.market_value * (0.9 + random() * 0.2) / 1000) * 1000)::bigint,
         v_now, v_next
  from public.ownership o join public.rider r on r.id = o.rider_id
  where o.league_id = p_league and o.for_sale and o.pending_member_id is null;

  -- 3. Nuevos ciclistas al mercado
  insert into public.market_listing (league_id, rider_id, base_value, opened_at, closes_at)
  select p_league, f.id, f.market_value, v_now, v_next
  from public.free_riders(p_league) f order by random() limit lg.market_size;

  update public.league set next_market_at = v_next where id = p_league;
end $$;

-- ---------------------------------------------------------------- cambio de semana (lunes 00:00)
create or replace function public.rollover_league(p_league uuid, p_week date) returns void
language plpgsql as $$
declare
  lg public.league;
  prev date := p_week - 7;
  v_now timestamptz := public.app_now();
  r record;
  n_pos integer;
begin
  select * into lg from public.league where id = p_league for update;
  if exists (select 1 from public.week_run where league_id = p_league and week_start = p_week) then
    return;
  end if;
  n_pos := coalesce(array_length(lg.payout_by_position, 1), 0);

  -- 1. Pago de la semana anterior
  for r in
    with pts as (
      select m.id as member_id, coalesce(sum(ms.points), 0)::bigint as pts
      from public.league_member m
      left join public.member_score ms
             on ms.member_id = m.id
            and ms.stage_id in (select s.id from public.stage s where s.date >= prev and s.date < p_week)
      where m.league_id = p_league
      group by m.id
    )
    select member_id, pts, rank() over (order by pts desc) as rk from pts
  loop
    if lg.payout_mode in ('per_point', 'mixed') and r.pts > 0 and lg.payout_per_point > 0 then
      perform public.post_ledger(r.member_id, r.pts * lg.payout_per_point, 'payout_points', null,
                                 r.pts || ' puntos, semana del ' || to_char(prev, 'DD/MM'));
    end if;
    if lg.payout_mode in ('by_position', 'mixed') and r.pts > 0 and r.rk <= n_pos
       and lg.payout_by_position[r.rk] > 0 then
      perform public.post_ledger(r.member_id, lg.payout_by_position[r.rk], 'payout_position', null,
                                 r.rk || '.º de la semana del ' || to_char(prev, 'DD/MM'));
    end if;
  end loop;

  -- 2. Traspasos pendientes (clausulazos y ofertas aceptadas)
  update public.ownership
     set member_id = pending_member_id, price_paid = pending_price, clause = round(pending_price * 1.5),
         acquired_at = transfer_at, eligible_from = transfer_at,
         pending_member_id = null, pending_price = null, transfer_at = null, for_sale = false
   where league_id = p_league and pending_member_id is not null and transfer_at <= v_now;

  -- 3. Control de deuda: saldo negativo = sin puntos esta semana
  insert into public.member_week (member_id, week_start, eligible)
  select id, p_week, balance >= 0 from public.league_member where league_id = p_league
  on conflict (member_id, week_start) do update set eligible = excluded.eligible;

  insert into public.week_run (league_id, week_start) values (p_league, p_week);
end $$;

-- ---------------------------------------------------------------- puntuación
create or replace function public.score_stage(p_stage bigint) returns integer
language plpgsql as $$
declare
  s public.stage;
  rc public.race;
  is_last boolean;
  n integer;
begin
  select * into s from public.stage where id = p_stage;
  if not found then raise exception 'Etapa % no existe', p_stage; end if;
  select * into rc from public.race where id = s.race_id;
  is_last := s.number = (select max(number) from public.stage where race_id = s.race_id);

  delete from public.member_score where stage_id = p_stage;
  delete from public.rider_score where stage_id = p_stage;

  if not rc.is_stage_race then
    insert into public.rider_score (stage_id, rider_id, kind, points)
    select p_stage, r.rider_id, 'oneday', sr.points
    from public.result r
    join public.scoring_rule sr on sr.category = rc.category and sr.kind = 'oneday' and sr.position = r.position
    where r.stage_id = p_stage and r.kind = 'stage';
  else
    insert into public.rider_score (stage_id, rider_id, kind, points)
    select p_stage, r.rider_id, x.score_kind, sr.points
    from public.result r
    join (values ('stage', 'stage', false), ('kom_leader', 'kom_jersey', false),
                 ('gc', 'gc', true), ('points', 'points_final', true), ('kom', 'kom_final', true))
         as x(result_kind, score_kind, only_last) on x.result_kind = r.kind
    join public.scoring_rule sr on sr.category = rc.category and sr.kind = x.score_kind and sr.position = r.position
    where r.stage_id = p_stage and (not x.only_last or is_last);
  end if;
  get diagnostics n = row_count;

  -- Puntos de cada jugador: ciclistas inscritos, ligas cuya profundidad incluye la carrera,
  -- y solo si el jugador no está sancionado por deuda esa semana
  insert into public.member_score (league_id, member_id, stage_id, rider_id, points)
  select e.league_id, e.member_id, p_stage, rs.rider_id, sum(rs.points)
  from public.race_entry e
  join public.league lg on lg.id = e.league_id
  join public.race_category c on c.code = rc.category and c.depth_level <= lg.calendar_depth
  join public.race_entry_rider er on er.entry_id = e.id
  join public.rider_score rs on rs.rider_id = er.rider_id and rs.stage_id = p_stage
  left join public.member_week mw on mw.member_id = e.member_id
                                 and mw.week_start = date_trunc('week', s.date)::date
  where e.race_id = rc.id and coalesce(mw.eligible, true)
  group by e.league_id, e.member_id, rs.rider_id;

  update public.stage set status = 'scored', scored_at = public.app_now() where id = p_stage;
  return n;
end $$;

-- ---------------------------------------------------------------- alineación automática
-- Se lanza al empezar la carrera, con la lista de salida ya cargada.
create or replace function public.auto_lineup(p_race bigint) returns integer
language plpgsql as $$
declare
  rc public.race;
  cat public.race_category;
  m record;
  v_entry bigint;
  v_season integer;
  n integer := 0;
begin
  select * into rc from public.race where id = p_race for update;
  select * into cat from public.race_category where code = rc.category;
  v_season := extract(year from rc.start_date);

  for m in
    select lm.id as member_id, lm.league_id
    from public.league_member lm join public.league lg on lg.id = lm.league_id
    where cat.depth_level <= lg.calendar_depth
      and not exists (select 1 from public.race_entry e where e.race_id = p_race and e.member_id = lm.id)
  loop
    insert into public.race_entry (league_id, race_id, member_id, auto, updated_at)
    values (m.league_id, p_race, m.member_id, true, public.app_now())
    returning id into v_entry;

    insert into public.race_entry_rider (entry_id, rider_id)
    select v_entry, q.rider_id from (
      select o.rider_id
      from public.ownership o
      join public.startlist sl on sl.race_id = p_race and sl.rider_id = o.rider_id
      join public.rider r on r.id = o.rider_id
      left join public.rider_season_points sp on sp.rider_id = o.rider_id and sp.season = v_season
      where o.league_id = m.league_id and o.member_id = m.member_id
        and o.pending_member_id is null and o.eligible_from <= public.app_now()
      order by coalesce(sp.points, 0) desc, r.market_value desc, random()
      limit cat.max_entries
    ) q;
    n := n + 1;
  end loop;

  update public.race set auto_lineup_done = true where id = p_race;
  return n;
end $$;

-- ---------------------------------------------------------------- tarea cada minuto (pg_cron)
create or replace function public.run_due_jobs() returns void
language plpgsql as $$
declare
  l record;
  v_now timestamptz := public.app_now();
  v_week date := public.week_start(public.app_now());
  today date := (public.app_now() at time zone 'Europe/Madrid')::date;
begin
  -- Cambio de semana (una vez por liga y semana)
  for l in
    select lg.id from public.league lg
    where not exists (select 1 from public.week_run w where w.league_id = lg.id and w.week_start = v_week)
  loop
    perform public.rollover_league(l.id, v_week);
  end loop;

  -- Mercados que tocan
  for l in select id from public.league where next_market_at <= v_now order by next_market_at loop
    perform public.resolve_market(l.id);
  end loop;

  -- Ofertas entre jugadores caducadas
  update public.transfer_offer set status = 'expired' where status = 'open' and expires_at <= v_now;

  -- Valores de mercado, una vez al día desde las 05:00
  if extract(hour from v_now at time zone 'Europe/Madrid') >= 5
     and not exists (select 1 from public.job_state where key = 'rider_values' and last_day = today) then
    perform public.update_rider_values();
  end if;
end $$;

-- ============================================================ migrations/0004_rpc.sql
-- =====================================================================================
-- 0004 · Funciones que llama la app (supabase.rpc). Todas comprueban quién llama con auth.uid()
--        y hacen el trabajo en una sola transacción. Los errores llevan un mensaje para el jugador.
-- =====================================================================================

create or replace function public.my_member(p_league uuid) returns public.league_member
language plpgsql stable security definer set search_path = public as $$
declare m public.league_member;
begin
  select * into m from public.league_member where league_id = p_league and user_id = auth.uid();
  if not found then
    raise exception 'No perteneces a esta liga' using errcode = '42501';
  end if;
  return m;
end $$;

create or replace function public.is_member(p_league uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.league_member where league_id = p_league and user_id = auth.uid())
$$;

create or replace function public.require_admin(p_league uuid) returns public.league
language plpgsql stable security definer set search_path = public as $$
declare lg public.league;
begin
  select * into lg from public.league where id = p_league;
  if not found or lg.admin_id is distinct from auth.uid() then
    raise exception 'Solo el administrador de la liga puede hacer esto' using errcode = '42501';
  end if;
  return lg;
end $$;

-- =============================================================== ligas
create or replace function public.create_league(p_name text, p_team_name text, p_settings jsonb default '{}')
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
  perform public.add_member(v_id, auth.uid(), trim(p_team_name));
  perform public.resolve_market(v_id);          -- primer mercado
  return v_id;
end $$;

create or replace function public.join_league(p_code text, p_team_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare lg public.league;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para unirte a una liga'; end if;
  select * into lg from public.league where invite_code = upper(trim(p_code)) for update;
  if not found then raise exception 'No hay ninguna liga con ese código'; end if;
  if exists (select 1 from public.league_member where league_id = lg.id and user_id = auth.uid()) then
    return lg.id;
  end if;
  perform public.add_member(lg.id, auth.uid(), trim(p_team_name));
  return lg.id;
end $$;

create or replace function public.update_league_settings(p_league uuid, p_settings jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  lg public.league := public.require_admin(p_league);
  s jsonb := coalesce(p_settings, '{}');
  v_max smallint := coalesce((s->>'max_riders')::smallint, lg.max_riders);
  v_hour smallint := coalesce((s->>'market_hour')::smallint, lg.market_hour);
  v_biggest integer;
  v_next timestamptz;
begin
  select coalesce(max(public.roster_count(id)), 0) into v_biggest from public.league_member where league_id = p_league;
  if v_max < v_biggest then
    raise exception 'El máximo no puede ser menor que la plantilla más grande de la liga (% ciclistas)', v_biggest;
  end if;
  update public.league set
    name               = coalesce(nullif(trim(s->>'name'), ''), name),
    max_riders         = v_max,
    calendar_depth     = coalesce((s->>'calendar_depth')::smallint, calendar_depth),
    market_size        = coalesce((s->>'market_size')::smallint, market_size),
    market_hour        = v_hour,
    clauses_enabled    = coalesce((s->>'clauses_enabled')::boolean, clauses_enabled),
    payout_mode        = coalesce((s->>'payout_mode')::public.payout_mode, payout_mode),
    payout_per_point   = coalesce((s->>'payout_per_point')::integer, payout_per_point),
    payout_by_position = coalesce((select array_agg(x::bigint) from jsonb_array_elements_text(s->'payout_by_position') x),
                                  case when s ? 'payout_by_position' then '{}'::bigint[] else payout_by_position end)
  where id = p_league;
  if v_hour <> lg.market_hour then
    v_next := public.next_market_time(v_hour);
    update public.league set next_market_at = v_next where id = p_league;
    update public.market_listing set closes_at = v_next where league_id = p_league and not resolved;
  end if;
end $$;

create or replace function public.regenerate_invite_code(p_league uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  perform public.require_admin(p_league);
  v_code := public.gen_invite_code();
  update public.league set invite_code = v_code where id = p_league;
  return v_code;
end $$;

create or replace function public.rename_team(p_league uuid, p_team_name text) returns void
language plpgsql security definer set search_path = public as $$
declare m public.league_member := public.my_member(p_league);
begin
  update public.league_member set team_name = trim(p_team_name) where id = m.id;
end $$;

create or replace function public.update_profile(p_display_name text default null, p_avatar_url text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  insert into public.profile (user_id, display_name, avatar_url)
  values (auth.uid(), coalesce(nullif(trim(p_display_name), ''), 'Jugador'), p_avatar_url)
  on conflict (user_id) do update set
    display_name = coalesce(nullif(trim(p_display_name), ''), public.profile.display_name),
    avatar_url   = coalesce(p_avatar_url, public.profile.avatar_url);
end $$;

-- =============================================================== mercado
create or replace function public.place_bid(p_listing bigint, p_amount bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  l public.market_listing;
  lg public.league;
  m public.league_member;
begin
  select * into l from public.market_listing where id = p_listing for update;
  if not found then raise exception 'Ese ciclista ya no está en el mercado'; end if;
  m := public.my_member(l.league_id);
  select * into lg from public.league where id = l.league_id;
  if l.resolved or l.closes_at <= public.app_now() then raise exception 'La subasta ya ha cerrado'; end if;
  if p_amount < l.base_value then
    raise exception 'La puja mínima es su valor de mercado: % €', to_char(l.base_value, 'FM999G999G999G999');
  end if;
  if public.roster_count(m.id) >= lg.max_riders then
    raise exception 'No tienes hueco en la plantilla (máximo % ciclistas)', lg.max_riders;
  end if;
  if not public.can_spend(m.id, p_amount, l.id) then
    raise exception 'No tienes saldo suficiente: puedes endeudarte hasta el 20 %% del valor de tu plantilla, contando tus otras pujas';
  end if;
  insert into public.bid (listing_id, member_id, amount, placed_at)
  values (p_listing, m.id, p_amount, clock_timestamp())
  on conflict (listing_id, member_id) do update
    set amount = excluded.amount,
        placed_at = case when public.bid.amount = excluded.amount then public.bid.placed_at else excluded.placed_at end;
end $$;

create or replace function public.cancel_bid(p_listing bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  l public.market_listing;
  m public.league_member;
begin
  select * into l from public.market_listing where id = p_listing;
  if not found then raise exception 'Ese ciclista ya no está en el mercado'; end if;
  m := public.my_member(l.league_id);
  if l.resolved or l.closes_at <= public.app_now() then raise exception 'La subasta ya ha cerrado'; end if;
  delete from public.bid where listing_id = p_listing and member_id = m.id;
end $$;

-- =============================================================== cláusulas
create or replace function public.raise_clause(p_ownership bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  o public.ownership;
  m public.league_member;
  v_new bigint; v_cost bigint;
begin
  select * into o from public.ownership where id = p_ownership for update;
  if not found then raise exception 'Ese ciclista ya no está en tu plantilla'; end if;
  m := public.my_member(o.league_id);
  if o.member_id <> m.id or o.pending_member_id is not null then
    raise exception 'Solo puedes subir la cláusula de tus ciclistas que no tengan un traspaso pendiente';
  end if;
  v_new := least(round(o.clause * 1.5), o.price_paid * 3);
  if v_new <= o.clause then raise exception 'La cláusula ya está en el máximo (300 %% del precio pagado)'; end if;
  v_cost := ceil((v_new - o.clause) / 2.0);
  if not public.can_spend(m.id, v_cost) then raise exception 'No tienes saldo suficiente'; end if;
  perform public.post_ledger(m.id, -v_cost, 'clause_raise', o.rider_id, 'Subida de cláusula');
  update public.ownership set clause = v_new where id = o.id;
  return v_new;
end $$;

create or replace function public.pay_clause(p_ownership bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.ownership;
  lg public.league;
  m public.league_member;
  madrid timestamp := public.app_now() at time zone 'Europe/Madrid';
begin
  select * into o from public.ownership where id = p_ownership for update;
  if not found then raise exception 'Ese ciclista ya no pertenece a ese jugador'; end if;
  m := public.my_member(o.league_id);
  select * into lg from public.league where id = o.league_id;
  if not lg.clauses_enabled then raise exception 'Los clausulazos están desactivados en esta liga'; end if;
  if extract(isodow from madrid) = 7 and extract(hour from madrid) >= 21 then
    raise exception 'Los clausulazos están bloqueados los domingos de 21:00 a 24:00';
  end if;
  if o.member_id = m.id then raise exception 'Este ciclista ya es tuyo'; end if;
  if o.pending_member_id is not null then raise exception 'Este ciclista ya tiene un traspaso pendiente'; end if;
  if public.roster_count(m.id) >= lg.max_riders then
    raise exception 'No tienes hueco en la plantilla (máximo % ciclistas)', lg.max_riders;
  end if;
  if not public.can_spend(m.id, o.clause) then raise exception 'No tienes saldo suficiente para pagar la cláusula'; end if;

  perform public.post_ledger(m.id, -o.clause, 'clause_paid', o.rider_id, 'Clausulazo');
  perform public.post_ledger(o.member_id, o.clause, 'clause_received', o.rider_id, 'Clausulazo recibido');
  update public.ownership
     set pending_member_id = m.id, pending_price = o.clause, transfer_at = public.next_monday(), for_sale = false
   where id = o.id;
  update public.game_offer set status = 'expired' where ownership_id = o.id and status = 'open';
  update public.transfer_offer set status = 'cancelled' where ownership_id = o.id and status = 'open';
end $$;

-- =============================================================== ventas
create or replace function public.set_for_sale(p_ownership bigint, p_for_sale boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.ownership;
  m public.league_member;
begin
  select * into o from public.ownership where id = p_ownership for update;
  if not found then raise exception 'Ese ciclista ya no está en tu plantilla'; end if;
  m := public.my_member(o.league_id);
  if o.member_id <> m.id or o.pending_member_id is not null then
    raise exception 'No puedes vender un ciclista con un traspaso pendiente';
  end if;
  update public.ownership set for_sale = p_for_sale where id = o.id;
  if not p_for_sale then
    update public.game_offer set status = 'expired' where ownership_id = o.id and status = 'open';
  end if;
end $$;

create or replace function public.accept_game_offer(p_offer bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  g public.game_offer;
  o public.ownership;
  m public.league_member;
begin
  select * into g from public.game_offer where id = p_offer for update;
  if not found or g.status <> 'open' or g.expires_at <= public.app_now() then
    raise exception 'La oferta ha caducado';
  end if;
  select * into o from public.ownership where id = g.ownership_id for update;
  if not found then raise exception 'Ese ciclista ya no está en tu plantilla'; end if;
  m := public.my_member(o.league_id);
  if o.member_id <> m.id or o.pending_member_id is not null then
    raise exception 'No puedes vender un ciclista con un traspaso pendiente';
  end if;
  perform public.post_ledger(m.id, g.amount, 'sale_game', o.rider_id, 'Venta al juego');
  update public.game_offer set status = 'accepted' where id = g.id;
  update public.transfer_offer set status = 'cancelled' where ownership_id = o.id and status = 'open';
  delete from public.ownership where id = o.id;   -- queda libre; sus inscripciones en curso siguen puntuando
end $$;

-- =============================================================== ofertas entre jugadores
create or replace function public.make_offer(p_ownership bigint, p_amount bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  o public.ownership;
  lg public.league;
  m public.league_member;
  v_id bigint;
begin
  select * into o from public.ownership where id = p_ownership;
  if not found then raise exception 'Ese ciclista ya no pertenece a ese jugador'; end if;
  m := public.my_member(o.league_id);
  select * into lg from public.league where id = o.league_id;
  if o.member_id = m.id then raise exception 'Este ciclista ya es tuyo'; end if;
  if o.pending_member_id is not null then raise exception 'Este ciclista ya tiene un traspaso pendiente'; end if;
  if p_amount <= 0 then raise exception 'La oferta debe ser mayor que 0'; end if;
  if public.roster_count(m.id) >= lg.max_riders then
    raise exception 'No tienes hueco en la plantilla (máximo % ciclistas)', lg.max_riders;
  end if;
  if not public.can_spend(m.id, p_amount) then raise exception 'No tienes saldo suficiente para esa oferta'; end if;
  insert into public.transfer_offer (league_id, ownership_id, rider_id, from_member_id, to_member_id, amount,
                                     created_at, expires_at)
  values (o.league_id, o.id, o.rider_id, m.id, o.member_id, p_amount, public.app_now(),
          public.app_now() + interval '48 hours')
  on conflict (ownership_id, from_member_id) where status = 'open'
  do update set amount = excluded.amount, created_at = excluded.created_at, expires_at = excluded.expires_at
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.cancel_offer(p_offer bigint) returns void
language plpgsql security definer set search_path = public as $$
declare t public.transfer_offer; m public.league_member;
begin
  select * into t from public.transfer_offer where id = p_offer for update;
  if not found then raise exception 'La oferta no existe'; end if;
  m := public.my_member(t.league_id);
  if t.from_member_id <> m.id or t.status <> 'open' then raise exception 'No puedes retirar esta oferta'; end if;
  update public.transfer_offer set status = 'cancelled' where id = t.id;
end $$;

create or replace function public.respond_offer(p_offer bigint, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  t public.transfer_offer;
  o public.ownership;
  lg public.league;
  m public.league_member;
begin
  select * into t from public.transfer_offer where id = p_offer for update;
  if not found or t.status <> 'open' or t.expires_at <= public.app_now() then
    raise exception 'La oferta ya no está disponible';
  end if;
  m := public.my_member(t.league_id);
  if t.to_member_id <> m.id then raise exception 'Esta oferta no es para ti'; end if;
  if not p_accept then
    update public.transfer_offer set status = 'rejected' where id = t.id;
    return;
  end if;
  select * into o from public.ownership where id = t.ownership_id for update;
  if not found or o.member_id <> m.id or o.pending_member_id is not null then
    raise exception 'El ciclista ya no está disponible';
  end if;
  select * into lg from public.league where id = t.league_id;
  if public.roster_count(t.from_member_id) >= lg.max_riders then
    raise exception 'El comprador ya no tiene hueco en su plantilla';
  end if;
  if not public.can_spend(t.from_member_id, t.amount) then
    raise exception 'El comprador ya no tiene saldo suficiente';
  end if;
  perform public.post_ledger(t.from_member_id, -t.amount, 'offer_paid', o.rider_id, 'Oferta aceptada');
  perform public.post_ledger(m.id, t.amount, 'offer_received', o.rider_id, 'Venta a otro jugador');
  update public.ownership
     set pending_member_id = t.from_member_id, pending_price = t.amount, transfer_at = public.next_monday(),
         for_sale = false
   where id = o.id;
  update public.transfer_offer set status = case when id = t.id then 'accepted' else 'cancelled' end
   where ownership_id = o.id and status = 'open';
  update public.game_offer set status = 'expired' where ownership_id = o.id and status = 'open';
end $$;

-- =============================================================== inscripciones
create or replace function public.save_entry(p_league uuid, p_race bigint, p_riders bigint[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  m public.league_member := public.my_member(p_league);
  lg public.league;
  rc public.race;
  cat public.race_category;
  v_riders bigint[] := array(select distinct x from unnest(coalesce(p_riders, '{}')) x);
  v_entry bigint;
begin
  select * into lg from public.league where id = p_league;
  select * into rc from public.race where id = p_race;
  if not found then raise exception 'La carrera no existe'; end if;
  select * into cat from public.race_category where code = rc.category;
  if cat.depth_level > lg.calendar_depth then
    raise exception 'Esta carrera no entra en el calendario de tu liga';
  end if;
  if public.app_now() >= rc.entries_close_at then raise exception 'La inscripción ya está cerrada'; end if;
  if cardinality(v_riders) > cat.max_entries then
    raise exception 'En esta carrera puedes inscribir como máximo % ciclistas', cat.max_entries;
  end if;
  if exists (
    select 1 from unnest(v_riders) x
    where not exists (select 1 from public.ownership o
                      where o.league_id = p_league and o.rider_id = x and o.member_id = m.id
                        and o.pending_member_id is null and o.eligible_from <= public.app_now())
  ) then
    raise exception 'Solo puedes inscribir ciclistas tuyos sin punto naranja ni rojo';
  end if;

  if cardinality(v_riders) = 0 then
    delete from public.race_entry where league_id = p_league and race_id = p_race and member_id = m.id;
    return;
  end if;
  insert into public.race_entry (league_id, race_id, member_id, auto, updated_at)
  values (p_league, p_race, m.id, false, public.app_now())
  on conflict (league_id, race_id, member_id) do update set auto = false, updated_at = excluded.updated_at
  returning id into v_entry;
  delete from public.race_entry_rider where entry_id = v_entry;
  insert into public.race_entry_rider (entry_id, rider_id) select v_entry, x from unnest(v_riders) x;
end $$;

-- =============================================================== lecturas para la app
create or replace function public.my_leagues()
returns table (league_id uuid, name text, team_name text, member_id uuid, is_admin boolean, members integer)
language sql stable security definer set search_path = public as $$
  select lg.id, lg.name, m.team_name, m.id, lg.admin_id = auth.uid(),
         (select count(*)::int from public.league_member x where x.league_id = lg.id)
  from public.league_member m join public.league lg on lg.id = m.league_id
  where m.user_id = auth.uid()
  order by m.joined_at
$$;

create or replace function public.get_standings(p_league uuid)
returns table (pos integer, member_id uuid, user_id uuid, team_name text, display_name text, avatar_url text,
               points_total integer, points_week integer, team_value bigint)
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
         pts.total, pts.week, public.team_value(m.id)
  from pts join public.league_member m on m.id = pts.id
  left join public.profile p on p.user_id = m.user_id
  order by pts.total desc, m.joined_at;
end $$;

create or replace function public.get_me(p_league uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  m public.league_member := public.my_member(p_league);
  lg public.league;
  st record;
begin
  select * into lg from public.league where id = p_league;
  select * into st from public.get_standings(p_league) g where g.member_id = m.id;
  return jsonb_build_object(
    'member_id', m.id, 'league_id', lg.id, 'league_name', lg.name, 'invite_code', lg.invite_code,
    'is_admin', lg.admin_id = auth.uid(), 'team_name', m.team_name,
    'display_name', st.display_name, 'avatar_url', st.avatar_url,
    'position', st.pos, 'members', (select count(*) from public.league_member where league_id = p_league),
    'points_total', st.points_total, 'points_week', st.points_week,
    'balance', m.balance, 'team_value', public.team_value(m.id),
    'committed_bids', public.committed_bids(m.id), 'debt_limit', public.debt_limit(m.id),
    'available', m.balance - public.committed_bids(m.id) + public.debt_limit(m.id),
    'roster_count', public.roster_count(m.id), 'max_riders', lg.max_riders,
    'sanctioned_this_week', exists (select 1 from public.member_week w where w.member_id = m.id
                                     and w.week_start = public.week_start(public.app_now()) and not w.eligible),
    'next_market_at', lg.next_market_at);
end $$;

-- Plantilla de un jugador (la mía si p_member es null). Estado: ok · incoming (naranja) · leaving (rojo)
create or replace function public.get_roster(p_league uuid, p_member uuid default null)
returns table (ownership_id bigint, rider_id bigint, rider_name text, pro_team text, nationality text, age integer,
               market_value bigint, price_paid bigint, clause bigint, next_clause bigint, next_clause_cost bigint,
               season_points integer, league_points integer, status text, available_from timestamptz,
               for_sale boolean, game_offer_id bigint, game_offer_amount bigint, game_offer_expires timestamptz,
               transferable boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  me public.league_member := public.my_member(p_league);
  v_target uuid := coalesce(p_member, me.id);
  v_mine boolean := coalesce(p_member, me.id) = me.id;
  v_now timestamptz := public.app_now();
  v_season integer := extract(year from public.app_now() at time zone 'Europe/Madrid');
begin
  if not exists (select 1 from public.league_member where id = v_target and league_id = p_league) then
    raise exception 'Ese jugador no está en esta liga';
  end if;
  return query
  select o.id, r.id, r.name, t.name, r.nationality, public.age_at(r.birthdate)::int,
         r.market_value, o.price_paid, o.clause,
         greatest(o.clause, least(round(o.clause * 1.5)::bigint, o.price_paid * 3)),
         ceil((greatest(o.clause, least(round(o.clause * 1.5)::bigint, o.price_paid * 3)) - o.clause) / 2.0)::bigint,
         coalesce(sp.points, 0),
         coalesce((select sum(ms.points)::int from public.member_score ms
                   where ms.member_id = v_target and ms.rider_id = r.id), 0),
         case when o.pending_member_id = v_target then 'incoming'
              when o.pending_member_id is not null then 'leaving'
              when o.eligible_from > v_now then 'incoming'
              else 'ok' end,
         coalesce(o.transfer_at, case when o.eligible_from > v_now then o.eligible_from end),
         case when v_mine then o.for_sale else false end,
         g.id, g.amount, g.expires_at,
         o.member_id = v_target and o.pending_member_id is null   -- se puede ofertar o pagar su cláusula
  from public.ownership o
  join public.rider r on r.id = o.rider_id
  left join public.team t on t.id = r.team_id
  left join public.rider_season_points sp on sp.rider_id = r.id and sp.season = v_season
  left join lateral (select go.id, go.amount, go.expires_at from public.game_offer go
                     where v_mine and go.ownership_id = o.id and go.status = 'open' and go.expires_at > v_now
                     order by go.created_at desc limit 1) g on true
  where o.league_id = p_league and (o.member_id = v_target or o.pending_member_id = v_target)
  order by r.market_value desc;
end $$;

create or replace function public.get_market(p_league uuid)
returns table (listing_id bigint, rider_id bigint, rider_name text, pro_team text, nationality text, age integer,
               base_value bigint, market_value bigint, season_points integer, closes_at timestamptz,
               bid_count integer, my_bid bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  me public.league_member := public.my_member(p_league);
  v_season integer := extract(year from public.app_now() at time zone 'Europe/Madrid');
begin
  return query
  select l.id, r.id, r.name, t.name, r.nationality, public.age_at(r.birthdate)::int, l.base_value, r.market_value,
         coalesce(sp.points, 0), l.closes_at,
         (select count(*)::int from public.bid b where b.listing_id = l.id),
         (select b.amount from public.bid b where b.listing_id = l.id and b.member_id = me.id)
  from public.market_listing l
  join public.rider r on r.id = l.rider_id
  left join public.team t on t.id = r.team_id
  left join public.rider_season_points sp on sp.rider_id = r.id and sp.season = v_season
  where l.league_id = p_league and not l.resolved
  order by l.base_value desc;
end $$;

create or replace function public.get_offers(p_league uuid)
returns table (offer_id bigint, direction text, ownership_id bigint, rider_id bigint, rider_name text,
               other_team text, amount bigint, expires_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare me public.league_member := public.my_member(p_league);
begin
  return query
  select t.id, case when t.to_member_id = me.id then 'received' else 'sent' end, t.ownership_id, r.id, r.name,
         (select x.team_name from public.league_member x
           where x.id = case when t.to_member_id = me.id then t.from_member_id else t.to_member_id end),
         t.amount, t.expires_at
  from public.transfer_offer t join public.rider r on r.id = t.rider_id
  where t.league_id = p_league and t.status = 'open' and t.expires_at > public.app_now()
    and (t.to_member_id = me.id or t.from_member_id = me.id)
  order by t.created_at desc;
end $$;

create or replace function public.get_calendar(p_league uuid, p_from date default null)
returns table (race_id bigint, name text, category text, category_name text, country text,
               start_date date, end_date date, is_stage_race boolean, n_stages integer,
               entries_close_at timestamptz, entries_open boolean, max_entries integer,
               my_entry_count integer, status text)
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
              else 'upcoming' end
  from public.race rc join public.race_category c on c.code = rc.category
  where c.depth_level <= lg.calendar_depth
    and rc.start_date >= coalesce(p_from, make_date(extract(year from v_today)::int, 1, 1))
  order by rc.start_date, rc.name;
end $$;

-- Etapas de hoy con los puntos que llevo en cada una
create or replace function public.get_today(p_league uuid)
returns table (stage_id bigint, race_id bigint, race_name text, category text, number integer, start_at timestamptz,
               est_finish_at timestamptz, distance_km numeric, status text, my_points integer)
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
           where ms.stage_id = s.id and ms.member_id = me.id)
  from public.stage s join public.race rc on rc.id = s.race_id
  join public.race_category c on c.code = rc.category
  where s.date = v_today and c.depth_level <= lg.calendar_depth
  order by s.start_at nulls last, rc.name;
end $$;

-- Puntos de una etapa: por ciclista (con su dueño en la liga) y por jugador
create or replace function public.get_stage_scores(p_league uuid, p_stage bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.league_member := public.my_member(p_league);
begin
  return jsonb_build_object(
    'stage', (select jsonb_build_object('id', s.id, 'number', s.number, 'date', s.date, 'status', s.status,
                                        'race_id', rc.id, 'race_name', rc.name, 'is_stage_race', rc.is_stage_race)
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

-- Desplegable del calendario: puntos de cada etapa y total de la carrera por jugador + general de la carrera
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
      select jsonb_agg(jsonb_build_object('position', r.position, 'rider_id', rd.id, 'name', rd.name)
                       order by r.position)
      from public.result r join public.rider rd on rd.id = r.rider_id
      where r.stage_id = v_last
        and r.kind = case when (select is_stage_race from public.race where id = p_race) then 'gc' else 'stage' end
        and r.position <= 10), '[]'::jsonb));
end $$;

-- Pantalla de inscripción: mis ciclistas inscribibles y los ya inscritos
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
                               'start_date', rc.start_date, 'end_date', rc.end_date,
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

-- =============================================================== administración (carga manual, plan B)
create table if not exists public.app_admin (user_id uuid primary key references auth.users(id) on delete cascade);

create or replace function public.is_app_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admin where user_id = auth.uid())
$$;

create or replace function public.require_app_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.app_admin where user_id = auth.uid()) then
    raise exception 'Solo los administradores de la app pueden hacer esto' using errcode = '42501';
  end if;
end $$;

-- Carga una lista de salida a partir de slugs de PCS y lanza la alineación automática si la carrera ya empezó
create or replace function public.admin_load_startlist(p_race bigint, p_slugs text[]) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform public.require_app_admin();
  delete from public.startlist where race_id = p_race;
  insert into public.startlist (race_id, rider_id)
  select p_race, r.id from public.rider r where r.pcs_slug = any (p_slugs);
  get diagnostics n = row_count;
  if public.app_now() >= (select entries_close_at from public.race where id = p_race) then
    perform public.auto_lineup(p_race);
  end if;
  return n;
end $$;

-- Carga un tipo de resultado de una etapa (slugs en orden de llegada) y recalcula sus puntos
create or replace function public.admin_load_results(p_stage bigint, p_kind text, p_slugs text[]) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform public.require_app_admin();
  delete from public.result where stage_id = p_stage and kind = p_kind;
  insert into public.result (stage_id, kind, rider_id, position)
  select p_stage, p_kind, r.id, x.ord::smallint
  from unnest(p_slugs) with ordinality as x(slug, ord)
  join public.rider r on r.pcs_slug = x.slug;
  get diagnostics n = row_count;
  perform public.score_stage(p_stage);
  return n;
end $$;

-- ============================================================ migrations/0005_security.sql
-- =====================================================================================
-- 0005 · Seguridad: RLS, permisos y alta automática del perfil
-- La app escribe SOLO a través de las RPC (security definer). Las tablas son de solo lectura
-- para los jugadores, y solo en lo que les toca. La ingesta usa el rol de servicio.
-- =====================================================================================

-- ---------------------------------------------------------------- perfil al registrarse
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profile (user_id, display_name, avatar_url)
  values (new.id,
          left(coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''),
                        split_part(coalesce(new.email, ''), '@', 1), 'Jugador'), 40),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array[
    'race_category','scoring_rule','category_rule','team','rider','rider_value_history','race','stage','startlist',
    'result','rider_score','value_params','job_state','profile','league','league_member','ledger','ownership',
    'market_listing','bid','game_offer','transfer_offer','race_entry','race_entry_rider','member_week',
    'member_score','week_run','app_admin']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Catálogo: lectura para cualquier usuario con sesión
do $$
declare t text;
begin
  foreach t in array array['race_category','scoring_rule','category_rule','team','rider','rider_value_history',
                           'race','stage','startlist','result','rider_score','value_params']
  loop
    execute format('create policy read_all on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;

create policy read_all on public.profile for select to authenticated using (true);
create policy update_own on public.profile for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy member_read on public.league for select to authenticated using (public.is_member(id));
create policy member_read on public.league_member for select to authenticated using (public.is_member(league_id));
create policy member_read on public.ownership for select to authenticated using (public.is_member(league_id));
create policy member_read on public.market_listing for select to authenticated using (public.is_member(league_id));
create policy member_read on public.member_score for select to authenticated using (public.is_member(league_id));

create policy own_read on public.ledger for select to authenticated
  using (member_id in (select id from public.league_member where user_id = auth.uid()));
create policy own_read on public.bid for select to authenticated
  using (member_id in (select id from public.league_member where user_id = auth.uid()));
create policy own_read on public.game_offer for select to authenticated
  using (member_id in (select id from public.league_member where user_id = auth.uid()));
create policy own_read on public.member_week for select to authenticated
  using (member_id in (select id from public.league_member where user_id = auth.uid()));
create policy own_read on public.transfer_offer for select to authenticated
  using (from_member_id in (select id from public.league_member where user_id = auth.uid())
      or to_member_id in (select id from public.league_member where user_id = auth.uid()));

-- Inscripciones: las mías siempre; las de los demás, cuando la inscripción ya ha cerrado
create policy entry_read on public.race_entry for select to authenticated using (
  member_id in (select id from public.league_member where user_id = auth.uid())
  or (public.is_member(league_id)
      and public.app_now() >= (select r.entries_close_at from public.race r where r.id = race_id)));
create policy entry_read on public.race_entry_rider for select to authenticated using (
  exists (select 1 from public.race_entry e where e.id = entry_id));   -- hereda la política de race_entry

-- ---------------------------------------------------------------- permisos
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
revoke select on public.job_state, public.week_run, public.app_admin from authenticated;
-- El saldo de los demás no se ve: league_member sin la columna balance (el mío llega por get_me)
revoke select on public.league_member from authenticated;
grant select (id, league_id, user_id, team_name, joined_at) on public.league_member to authenticated;
grant update (display_name, avatar_url) on public.profile to authenticated;

-- Funciones: nada ejecutable por defecto; solo las RPC de la app
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.app_now(), public.week_start(timestamptz), public.is_member(uuid),
  public.create_league(text, text, jsonb), public.join_league(text, text),
  public.update_league_settings(uuid, jsonb), public.regenerate_invite_code(uuid),
  public.rename_team(uuid, text), public.update_profile(text, text),
  public.place_bid(bigint, bigint), public.cancel_bid(bigint),
  public.raise_clause(bigint), public.pay_clause(bigint),
  public.set_for_sale(bigint, boolean), public.accept_game_offer(bigint),
  public.make_offer(bigint, bigint), public.cancel_offer(bigint), public.respond_offer(bigint, boolean),
  public.save_entry(uuid, bigint, bigint[]),
  public.my_leagues(), public.get_standings(uuid), public.get_me(uuid), public.get_roster(uuid, uuid),
  public.get_market(uuid), public.get_offers(uuid), public.get_calendar(uuid, date), public.get_today(uuid),
  public.get_stage_scores(uuid, bigint), public.get_race_detail(uuid, bigint), public.get_entry(uuid, bigint),
  public.is_app_admin(), public.admin_load_startlist(bigint, text[]), public.admin_load_results(bigint, text, text[])
to authenticated;

-- Las funciones nuevas que se creen después tampoco serán públicas por defecto
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ============================================================ migrations/0007_ingest.sql
-- =====================================================================================
-- 0007 · Cola de tareas de la ingesta (lecturas programadas de PCS). Solo la usa la ingesta.
-- =====================================================================================
create table public.ingest_task (
  id          bigserial primary key,
  kind        text not null check (kind in ('startlist', 'results', 'recheck')),
  race_id     bigint not null references public.race(id) on delete cascade,
  stage_id    bigint references public.stage(id) on delete cascade,
  due_at      timestamptz not null,
  attempts    integer not null default 0,
  max_attempts integer not null,
  retry_every interval not null,
  status      text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  last_error  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index ingest_task_pending_uq on public.ingest_task (kind, race_id, coalesce(stage_id, 0))
  where status = 'pending';
create index on public.ingest_task (status, due_at);
alter table public.ingest_task enable row level security;   -- sin políticas: invisible para la app
revoke all on public.ingest_task from anon, authenticated;

-- ============================================================ migrations/0008_riders.sql
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


-- ============================================================ migrations/0009_history_photos.sql
-- =====================================================================================
-- 0009 · Historial de resultados (temporadas anteriores al juego) y fotos de los ciclistas
-- =====================================================================================

-- Resultados de temporadas pasadas, solo para enseñarlos en la ficha del ciclista.
-- Van aparte de race/stage/result para no tocar el calendario, la puntuación de las ligas ni los valores.
create table if not exists public.rider_history_result (
  rider_id       bigint not null references public.rider(id) on delete cascade,
  season         smallint not null,
  race_slug      text not null,
  race_name      text not null,
  uci_class      text not null,
  category       text references public.race_category(code) on update cascade,
  is_stage_race  boolean not null,
  number         smallint not null,          -- etapa (0 = prólogo); clásica y clasificaciones finales = 1
  date           date not null,
  kind           text not null check (kind in ('stage','gc','points','kom')),
  position       smallint not null check (position >= 1),
  primary key (rider_id, season, race_slug, kind, number)
);
create index if not exists rider_history_result_rider on public.rider_history_result (rider_id, date desc);

alter table public.rider_history_result enable row level security;
drop policy if exists read_all on public.rider_history_result;
create policy read_all on public.rider_history_result for select to authenticated using (true);
revoke all on public.rider_history_result from anon, authenticated;
grant select on public.rider_history_result to authenticated;

-- Foto de Wikimedia Commons (vía Wikidata) y lo que exige su licencia: autor, licencia y enlace
alter table public.rider add column if not exists pcs_id integer;              -- id numérico de PCS (Wikidata P1663)
alter table public.rider add column if not exists photo_author text;
alter table public.rider add column if not exists photo_license text;
alter table public.rider add column if not exists photo_license_url text;
alter table public.rider add column if not exists photo_page_url text;     -- página del archivo en Commons

-- Ficha del ciclista: añade la foto y los resultados del historial (sin stage_id: no hay etapa del juego).
-- race_key agrupa los resultados por carrera; race_start/race_end dicen si sigue en marcha.
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
               'race_name', x.race_name, 'category', x.category,
               'is_stage_race', x.is_stage_race, 'number', x.number, 'date', x.date, 'kind', x.kind,
               'position', x.position, 'points', x.points)
             order by x.date desc, x.kind_order)
      from (
        -- resultados del juego
        (select s.id stage_id, 'g' || rc.id race_key, rc.start_date race_start, rc.end_date race_end, rc.name race_name, rc.category, rc.is_stage_race, s.number, s.date,
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
                h.race_name, h.category, h.is_stage_race, h.number, h.date, h.kind, h.position,
                case h.kind when 'stage' then 0 when 'gc' then 1 when 'points' then 2 else 3 end,
                coalesce((select sr.points from public.scoring_rule sr
                          where sr.category = h.category and sr.position = h.position
                            and sr.kind = case h.kind when 'stage' then (case when h.is_stage_race then 'stage' else 'oneday' end)
                                                      when 'gc' then 'gc' when 'points' then 'points_final'
                                                      else 'kom_final' end), 0)
         from public.rider_history_result h
         where h.rider_id = p_rider)
        order by 9 desc
        limit 600) x), '[]'::jsonb));
end $$;


-- ============================================================ migrations/0010_list_photos.sql
-- =====================================================================================
-- 0010 · Foto del ciclista en las listas (plantillas y ranking)
-- =====================================================================================

-- La 0010 anterior creaba colores de equipo; ya no se usan
drop table if exists public.team_color;

-- get_roster + foto del ciclista (cambia el tipo de salida: hay que recrearla)
drop function if exists public.get_roster(uuid, uuid);
create function public.get_roster(p_league uuid, p_member uuid default null)
returns table (ownership_id bigint, rider_id bigint, rider_name text, pro_team text, nationality text, age integer,
               market_value bigint, price_paid bigint, clause bigint, next_clause bigint, next_clause_cost bigint,
               season_points integer, league_points integer, status text, available_from timestamptz,
               for_sale boolean, game_offer_id bigint, game_offer_amount bigint, game_offer_expires timestamptz,
               transferable boolean, photo_url text)
language plpgsql stable security definer set search_path = public as $$
declare
  me public.league_member := public.my_member(p_league);
  v_target uuid := coalesce(p_member, me.id);
  v_mine boolean := coalesce(p_member, me.id) = me.id;
  v_now timestamptz := public.app_now();
  v_season integer := extract(year from public.app_now() at time zone 'Europe/Madrid');
begin
  if not exists (select 1 from public.league_member where id = v_target and league_id = p_league) then
    raise exception 'Ese jugador no está en esta liga';
  end if;
  return query
  select o.id, r.id, r.name, t.name, r.nationality, public.age_at(r.birthdate)::int,
         r.market_value, o.price_paid, o.clause,
         greatest(o.clause, least(round(o.clause * 1.5)::bigint, o.price_paid * 3)),
         ceil((greatest(o.clause, least(round(o.clause * 1.5)::bigint, o.price_paid * 3)) - o.clause) / 2.0)::bigint,
         coalesce(sp.points, 0),
         coalesce((select sum(ms.points)::int from public.member_score ms
                   where ms.member_id = v_target and ms.rider_id = r.id), 0),
         case when o.pending_member_id = v_target then 'incoming'
              when o.pending_member_id is not null then 'leaving'
              when o.eligible_from > v_now then 'incoming'
              else 'ok' end,
         coalesce(o.transfer_at, case when o.eligible_from > v_now then o.eligible_from end),
         case when v_mine then o.for_sale else false end,
         g.id, g.amount, g.expires_at,
         o.member_id = v_target and o.pending_member_id is null,   -- se puede ofertar o pagar su cláusula
         r.photo_url
  from public.ownership o
  join public.rider r on r.id = o.rider_id
  left join public.team t on t.id = r.team_id
  left join public.rider_season_points sp on sp.rider_id = r.id and sp.season = v_season
  left join lateral (select go.id, go.amount, go.expires_at from public.game_offer go
                     where v_mine and go.ownership_id = o.id and go.status = 'open' and go.expires_at > v_now
                     order by go.created_at desc limit 1) g on true
  where o.league_id = p_league and (o.member_id = v_target or o.pending_member_id = v_target)
  order by r.market_value desc;
end $$;

grant execute on function public.get_roster(uuid, uuid) to authenticated;

-- get_ranking + foto del ciclista
drop function if exists public.get_ranking(uuid, integer);
create function public.get_ranking(p_league uuid, p_limit integer default null)
returns table (rider_id bigint, name text, pro_team text, nationality text, age integer, market_value bigint,
               season_points integer, owner_member_id uuid, owner_team text, is_mine boolean, photo_url text)
language plpgsql stable security definer set search_path = public as $$
declare
  me public.league_member := public.my_member(p_league);
  v_season integer := extract(year from public.app_now() at time zone 'Europe/Madrid');
begin
  return query
  select r.id, r.name, t.name, r.nationality, public.age_at(r.birthdate)::int, r.market_value,
         coalesce(sp.points, 0), m.id, m.team_name, coalesce(m.id = me.id, false), r.photo_url
  from public.rider r
  left join public.team t on t.id = r.team_id
  left join public.rider_season_points sp on sp.rider_id = r.id and sp.season = v_season
  left join public.ownership o on o.league_id = p_league and o.rider_id = r.id
  left join public.league_member m on m.id = o.member_id
  where r.active
  order by coalesce(sp.points, 0) desc, r.market_value desc, r.name
  limit p_limit;
end $$;

grant execute on function public.get_ranking(uuid, integer) to authenticated;


-- ============================================================ seed.sql
-- Generado por tools/build_seed.py. No editar a mano: edita los CSV de supabase/seed/.
begin;
delete from public.scoring_rule;
delete from public.category_rule;
insert into public.race_category (code, name, depth_level, max_entries, is_itt) values ('TDF', 'Tour de France', 1, 8, false) on conflict (code) do update set name = excluded.name, depth_level = excluded.depth_level, max_entries = excluded.max_entries, is_itt = excluded.is_itt;
insert into public.race_category (code, name, depth_level, max_entries, is_itt) values ('GT', 'Grandes Vueltas (Giro, Vuelta)', 1, 8, false) on conflict (code) do update set name = excluded.name, depth_level = excluded.depth_level, max_entries = excluded.max_entries, is_itt = excluded.is_itt;
insert into public.race_category (code, name, depth_level, max_entries, is_itt) values ('WC', 'Campeonato del Mundo', 1, 6, false) on conflict (code) do update set name = excluded.name, depth_level = excluded.depth_level, max_entries = excluded.max_entries, is_itt = excluded.is_itt;
insert into public.race_category (code, name, depth_level, max_entries, is_itt) values ('WC_ITT', 'Mundial CRI', 1, 3, true) on conflict (code) do update set name = excluded.name, depth_level = excluded.depth_level, max_entries = excluded.max_entries, is_itt = excluded.is_itt;
insert into public.race_category (code, name, depth_level, max_entries, is_itt) values ('MON', 'Monumentos', 1, 7, false) on conflict (code) do update set name = excluded.name, depth_level = excluded.depth_level, max_entries = excluded.max_entries, is_itt = excluded.is_itt;
insert into public.race_category (code, name, depth_level, max_entries, is_itt) values ('MWT', 'WT principal (1.MWT / 2.MWT)', 1, 7, false) on conflict (code) do update set name = excluded.name, depth_level = excluded.depth_level, max_entries = excluded.max_entries, is_itt = excluded.is_itt;
insert into public.race_category (code, name, depth_level, max_entries, is_itt) values ('SWT', 'WT secundaria (1.SWT / 2.SWT)', 2, 7, false) on conflict (code) do update set name = excluded.name, depth_level = excluded.depth_level, max_entries = excluded.max_entries, is_itt = excluded.is_itt;
insert into public.race_category (code, name, depth_level, max_entries, is_itt) values ('CC', 'Campeonato continental', 2, 6, false) on conflict (code) do update set name = excluded.name, depth_level = excluded.depth_level, max_entries = excluded.max_entries, is_itt = excluded.is_itt;
insert into public.race_category (code, name, depth_level, max_entries, is_itt) values ('CC_ITT', 'Campeonato continental CRI', 2, 3, true) on conflict (code) do update set name = excluded.name, depth_level = excluded.depth_level, max_entries = excluded.max_entries, is_itt = excluded.is_itt;
insert into public.race_category (code, name, depth_level, max_entries, is_itt) values ('NC', 'Campeonato nacional', 2, 6, false) on conflict (code) do update set name = excluded.name, depth_level = excluded.depth_level, max_entries = excluded.max_entries, is_itt = excluded.is_itt;
insert into public.race_category (code, name, depth_level, max_entries, is_itt) values ('NC_ITT', 'Campeonato nacional CRI', 2, 3, true) on conflict (code) do update set name = excluded.name, depth_level = excluded.depth_level, max_entries = excluded.max_entries, is_itt = excluded.is_itt;
insert into public.race_category (code, name, depth_level, max_entries, is_itt) values ('PRO', '.Pro (1.Pro / 2.Pro)', 3, 6, false) on conflict (code) do update set name = excluded.name, depth_level = excluded.depth_level, max_entries = excluded.max_entries, is_itt = excluded.is_itt;
insert into public.race_category (code, name, depth_level, max_entries, is_itt) values ('C1', '.1 (1.1 / 2.1)', 4, 6, false) on conflict (code) do update set name = excluded.name, depth_level = excluded.depth_level, max_entries = excluded.max_entries, is_itt = excluded.is_itt;
insert into public.scoring_rule (category, kind, position, points) values
  ('TDF', 'gc', 1, 500),
  ('TDF', 'gc', 2, 380),
  ('TDF', 'gc', 3, 340),
  ('TDF', 'gc', 4, 300),
  ('TDF', 'gc', 5, 280),
  ('TDF', 'gc', 6, 260),
  ('TDF', 'gc', 7, 240),
  ('TDF', 'gc', 8, 220),
  ('TDF', 'gc', 9, 200),
  ('TDF', 'gc', 10, 180),
  ('TDF', 'gc', 11, 160),
  ('TDF', 'gc', 12, 140),
  ('TDF', 'gc', 13, 130),
  ('TDF', 'gc', 14, 120),
  ('TDF', 'gc', 15, 110),
  ('TDF', 'gc', 16, 100),
  ('TDF', 'gc', 17, 90),
  ('TDF', 'gc', 18, 80),
  ('TDF', 'gc', 19, 70),
  ('TDF', 'gc', 20, 60),
  ('TDF', 'gc', 21, 50),
  ('TDF', 'gc', 22, 40),
  ('TDF', 'gc', 23, 35),
  ('TDF', 'gc', 24, 30),
  ('TDF', 'gc', 25, 25),
  ('TDF', 'stage', 1, 100),
  ('TDF', 'stage', 2, 80),
  ('TDF', 'stage', 3, 65),
  ('TDF', 'stage', 4, 55),
  ('TDF', 'stage', 5, 45),
  ('TDF', 'stage', 6, 35),
  ('TDF', 'stage', 7, 30),
  ('TDF', 'stage', 8, 25),
  ('TDF', 'stage', 9, 20),
  ('TDF', 'stage', 10, 17),
  ('TDF', 'stage', 11, 15),
  ('TDF', 'stage', 12, 12),
  ('TDF', 'stage', 13, 10),
  ('TDF', 'stage', 14, 7),
  ('TDF', 'stage', 15, 5),
  ('TDF', 'points_final', 1, 100),
  ('TDF', 'points_final', 2, 60),
  ('TDF', 'points_final', 3, 40),
  ('TDF', 'kom_final', 1, 100),
  ('TDF', 'kom_final', 2, 60),
  ('TDF', 'kom_final', 3, 40),
  ('TDF', 'kom_jersey', 1, 10),
  ('GT', 'gc', 1, 400),
  ('GT', 'gc', 2, 304),
  ('GT', 'gc', 3, 272),
  ('GT', 'gc', 4, 240),
  ('GT', 'gc', 5, 224),
  ('GT', 'gc', 6, 208),
  ('GT', 'gc', 7, 192),
  ('GT', 'gc', 8, 176),
  ('GT', 'gc', 9, 160),
  ('GT', 'gc', 10, 144),
  ('GT', 'gc', 11, 128),
  ('GT', 'gc', 12, 112),
  ('GT', 'gc', 13, 104),
  ('GT', 'gc', 14, 96),
  ('GT', 'gc', 15, 88),
  ('GT', 'gc', 16, 80),
  ('GT', 'gc', 17, 72),
  ('GT', 'gc', 18, 64),
  ('GT', 'gc', 19, 56),
  ('GT', 'gc', 20, 48),
  ('GT', 'gc', 21, 40),
  ('GT', 'gc', 22, 32),
  ('GT', 'gc', 23, 28),
  ('GT', 'gc', 24, 24),
  ('GT', 'gc', 25, 20),
  ('GT', 'stage', 1, 80),
  ('GT', 'stage', 2, 64),
  ('GT', 'stage', 3, 52),
  ('GT', 'stage', 4, 44),
  ('GT', 'stage', 5, 36),
  ('GT', 'stage', 6, 28),
  ('GT', 'stage', 7, 24),
  ('GT', 'stage', 8, 20),
  ('GT', 'stage', 9, 16),
  ('GT', 'stage', 10, 14),
  ('GT', 'stage', 11, 12),
  ('GT', 'stage', 12, 10),
  ('GT', 'stage', 13, 8),
  ('GT', 'stage', 14, 6),
  ('GT', 'stage', 15, 4),
  ('GT', 'points_final', 1, 80),
  ('GT', 'points_final', 2, 48),
  ('GT', 'points_final', 3, 32),
  ('GT', 'kom_final', 1, 80),
  ('GT', 'kom_final', 2, 48),
  ('GT', 'kom_final', 3, 32),
  ('GT', 'kom_jersey', 1, 8),
  ('WC', 'oneday', 1, 350),
  ('WC', 'oneday', 2, 266),
  ('WC', 'oneday', 3, 238),
  ('WC', 'oneday', 4, 210),
  ('WC', 'oneday', 5, 196),
  ('WC', 'oneday', 6, 182),
  ('WC', 'oneday', 7, 168),
  ('WC', 'oneday', 8, 154),
  ('WC', 'oneday', 9, 140),
  ('WC', 'oneday', 10, 126),
  ('WC', 'oneday', 11, 112),
  ('WC', 'oneday', 12, 98),
  ('WC', 'oneday', 13, 91),
  ('WC', 'oneday', 14, 84),
  ('WC', 'oneday', 15, 77),
  ('WC', 'oneday', 16, 70),
  ('WC', 'oneday', 17, 63),
  ('WC', 'oneday', 18, 56),
  ('WC', 'oneday', 19, 49),
  ('WC', 'oneday', 20, 42),
  ('WC', 'oneday', 21, 35),
  ('WC', 'oneday', 22, 28),
  ('WC', 'oneday', 23, 24),
  ('WC', 'oneday', 24, 21),
  ('WC', 'oneday', 25, 18),
  ('WC_ITT', 'oneday', 1, 250),
  ('WC_ITT', 'oneday', 2, 190),
  ('WC_ITT', 'oneday', 3, 170),
  ('WC_ITT', 'oneday', 4, 150),
  ('WC_ITT', 'oneday', 5, 140),
  ('WC_ITT', 'oneday', 6, 130),
  ('WC_ITT', 'oneday', 7, 120),
  ('WC_ITT', 'oneday', 8, 110),
  ('WC_ITT', 'oneday', 9, 100),
  ('WC_ITT', 'oneday', 10, 90),
  ('WC_ITT', 'oneday', 11, 80),
  ('WC_ITT', 'oneday', 12, 70),
  ('WC_ITT', 'oneday', 13, 65),
  ('WC_ITT', 'oneday', 14, 60),
  ('WC_ITT', 'oneday', 15, 55),
  ('MON', 'oneday', 1, 275),
  ('MON', 'oneday', 2, 209),
  ('MON', 'oneday', 3, 187),
  ('MON', 'oneday', 4, 165),
  ('MON', 'oneday', 5, 154),
  ('MON', 'oneday', 6, 143),
  ('MON', 'oneday', 7, 132),
  ('MON', 'oneday', 8, 121),
  ('MON', 'oneday', 9, 110),
  ('MON', 'oneday', 10, 99),
  ('MON', 'oneday', 11, 88),
  ('MON', 'oneday', 12, 77),
  ('MON', 'oneday', 13, 72),
  ('MON', 'oneday', 14, 66),
  ('MON', 'oneday', 15, 60),
  ('MON', 'oneday', 16, 55),
  ('MON', 'oneday', 17, 50),
  ('MON', 'oneday', 18, 44),
  ('MON', 'oneday', 19, 38),
  ('MON', 'oneday', 20, 33),
  ('MON', 'oneday', 21, 28),
  ('MON', 'oneday', 22, 22),
  ('MON', 'oneday', 23, 19),
  ('MON', 'oneday', 24, 16),
  ('MON', 'oneday', 25, 14),
  ('MWT', 'oneday', 1, 225),
  ('MWT', 'oneday', 2, 171),
  ('MWT', 'oneday', 3, 153),
  ('MWT', 'oneday', 4, 135),
  ('MWT', 'oneday', 5, 126),
  ('MWT', 'oneday', 6, 117),
  ('MWT', 'oneday', 7, 108),
  ('MWT', 'oneday', 8, 99),
  ('MWT', 'oneday', 9, 90),
  ('MWT', 'oneday', 10, 81),
  ('MWT', 'oneday', 11, 72),
  ('MWT', 'oneday', 12, 63),
  ('MWT', 'oneday', 13, 58),
  ('MWT', 'oneday', 14, 54),
  ('MWT', 'oneday', 15, 50),
  ('MWT', 'oneday', 16, 45),
  ('MWT', 'oneday', 17, 40),
  ('MWT', 'oneday', 18, 36),
  ('MWT', 'oneday', 19, 32),
  ('MWT', 'oneday', 20, 27),
  ('MWT', 'gc', 1, 250),
  ('MWT', 'gc', 2, 190),
  ('MWT', 'gc', 3, 170),
  ('MWT', 'gc', 4, 150),
  ('MWT', 'gc', 5, 140),
  ('MWT', 'gc', 6, 130),
  ('MWT', 'gc', 7, 120),
  ('MWT', 'gc', 8, 110),
  ('MWT', 'gc', 9, 100),
  ('MWT', 'gc', 10, 90),
  ('MWT', 'gc', 11, 80),
  ('MWT', 'gc', 12, 70),
  ('MWT', 'gc', 13, 65),
  ('MWT', 'gc', 14, 60),
  ('MWT', 'gc', 15, 55),
  ('MWT', 'gc', 16, 50),
  ('MWT', 'gc', 17, 45),
  ('MWT', 'gc', 18, 40),
  ('MWT', 'gc', 19, 35),
  ('MWT', 'gc', 20, 30),
  ('MWT', 'stage', 1, 50),
  ('MWT', 'stage', 2, 40),
  ('MWT', 'stage', 3, 32),
  ('MWT', 'stage', 4, 28),
  ('MWT', 'stage', 5, 22),
  ('MWT', 'stage', 6, 18),
  ('MWT', 'stage', 7, 15),
  ('MWT', 'stage', 8, 12),
  ('MWT', 'stage', 9, 10),
  ('MWT', 'stage', 10, 8),
  ('MWT', 'points_final', 1, 50),
  ('MWT', 'points_final', 2, 30),
  ('MWT', 'points_final', 3, 20),
  ('MWT', 'kom_final', 1, 50),
  ('MWT', 'kom_final', 2, 30),
  ('MWT', 'kom_final', 3, 20),
  ('SWT', 'oneday', 1, 180),
  ('SWT', 'oneday', 2, 137),
  ('SWT', 'oneday', 3, 122),
  ('SWT', 'oneday', 4, 108),
  ('SWT', 'oneday', 5, 101),
  ('SWT', 'oneday', 6, 94),
  ('SWT', 'oneday', 7, 86),
  ('SWT', 'oneday', 8, 79),
  ('SWT', 'oneday', 9, 72),
  ('SWT', 'oneday', 10, 65),
  ('SWT', 'oneday', 11, 58),
  ('SWT', 'oneday', 12, 50),
  ('SWT', 'oneday', 13, 47),
  ('SWT', 'oneday', 14, 43),
  ('SWT', 'oneday', 15, 40),
  ('SWT', 'oneday', 16, 36),
  ('SWT', 'oneday', 17, 32),
  ('SWT', 'oneday', 18, 29),
  ('SWT', 'oneday', 19, 25),
  ('SWT', 'oneday', 20, 22),
  ('SWT', 'gc', 1, 200),
  ('SWT', 'gc', 2, 152),
  ('SWT', 'gc', 3, 136),
  ('SWT', 'gc', 4, 120),
  ('SWT', 'gc', 5, 112),
  ('SWT', 'gc', 6, 104),
  ('SWT', 'gc', 7, 96),
  ('SWT', 'gc', 8, 88),
  ('SWT', 'gc', 9, 80),
  ('SWT', 'gc', 10, 72),
  ('SWT', 'gc', 11, 64),
  ('SWT', 'gc', 12, 56),
  ('SWT', 'gc', 13, 52),
  ('SWT', 'gc', 14, 48),
  ('SWT', 'gc', 15, 44),
  ('SWT', 'gc', 16, 40),
  ('SWT', 'gc', 17, 36),
  ('SWT', 'gc', 18, 32),
  ('SWT', 'gc', 19, 28),
  ('SWT', 'gc', 20, 24),
  ('SWT', 'stage', 1, 40),
  ('SWT', 'stage', 2, 32),
  ('SWT', 'stage', 3, 26),
  ('SWT', 'stage', 4, 22),
  ('SWT', 'stage', 5, 18),
  ('SWT', 'stage', 6, 14),
  ('SWT', 'stage', 7, 12),
  ('SWT', 'stage', 8, 10),
  ('SWT', 'stage', 9, 8),
  ('SWT', 'stage', 10, 7),
  ('SWT', 'points_final', 1, 40),
  ('SWT', 'points_final', 2, 24),
  ('SWT', 'points_final', 3, 16),
  ('SWT', 'kom_final', 1, 40),
  ('SWT', 'kom_final', 2, 24),
  ('SWT', 'kom_final', 3, 16),
  ('CC', 'oneday', 1, 150),
  ('CC', 'oneday', 2, 114),
  ('CC', 'oneday', 3, 102),
  ('CC', 'oneday', 4, 90),
  ('CC', 'oneday', 5, 84),
  ('CC', 'oneday', 6, 78),
  ('CC', 'oneday', 7, 72),
  ('CC', 'oneday', 8, 66),
  ('CC', 'oneday', 9, 60),
  ('CC', 'oneday', 10, 54),
  ('CC', 'oneday', 11, 48),
  ('CC', 'oneday', 12, 42),
  ('CC', 'oneday', 13, 39),
  ('CC', 'oneday', 14, 36),
  ('CC', 'oneday', 15, 33),
  ('CC_ITT', 'oneday', 1, 60),
  ('CC_ITT', 'oneday', 2, 46),
  ('CC_ITT', 'oneday', 3, 41),
  ('CC_ITT', 'oneday', 4, 36),
  ('CC_ITT', 'oneday', 5, 34),
  ('CC_ITT', 'oneday', 6, 31),
  ('CC_ITT', 'oneday', 7, 29),
  ('CC_ITT', 'oneday', 8, 26),
  ('CC_ITT', 'oneday', 9, 24),
  ('CC_ITT', 'oneday', 10, 22),
  ('NC', 'oneday', 1, 50),
  ('NC', 'oneday', 2, 38),
  ('NC', 'oneday', 3, 34),
  ('NC', 'oneday', 4, 30),
  ('NC', 'oneday', 5, 28),
  ('NC', 'oneday', 6, 26),
  ('NC', 'oneday', 7, 24),
  ('NC', 'oneday', 8, 22),
  ('NC', 'oneday', 9, 20),
  ('NC', 'oneday', 10, 18),
  ('NC_ITT', 'oneday', 1, 25),
  ('NC_ITT', 'oneday', 2, 19),
  ('NC_ITT', 'oneday', 3, 17),
  ('NC_ITT', 'oneday', 4, 15),
  ('NC_ITT', 'oneday', 5, 14),
  ('PRO', 'oneday', 1, 125),
  ('PRO', 'oneday', 2, 95),
  ('PRO', 'oneday', 3, 85),
  ('PRO', 'oneday', 4, 75),
  ('PRO', 'oneday', 5, 70),
  ('PRO', 'oneday', 6, 65),
  ('PRO', 'oneday', 7, 60),
  ('PRO', 'oneday', 8, 55),
  ('PRO', 'oneday', 9, 50),
  ('PRO', 'oneday', 10, 45),
  ('PRO', 'oneday', 11, 40),
  ('PRO', 'oneday', 12, 35),
  ('PRO', 'oneday', 13, 32),
  ('PRO', 'oneday', 14, 30),
  ('PRO', 'oneday', 15, 28),
  ('PRO', 'gc', 1, 150),
  ('PRO', 'gc', 2, 114),
  ('PRO', 'gc', 3, 102),
  ('PRO', 'gc', 4, 90),
  ('PRO', 'gc', 5, 84),
  ('PRO', 'gc', 6, 78),
  ('PRO', 'gc', 7, 72),
  ('PRO', 'gc', 8, 66),
  ('PRO', 'gc', 9, 60),
  ('PRO', 'gc', 10, 54),
  ('PRO', 'gc', 11, 48),
  ('PRO', 'gc', 12, 42),
  ('PRO', 'gc', 13, 39),
  ('PRO', 'gc', 14, 36),
  ('PRO', 'gc', 15, 33),
  ('PRO', 'stage', 1, 30),
  ('PRO', 'stage', 2, 24),
  ('PRO', 'stage', 3, 20),
  ('PRO', 'stage', 4, 16),
  ('PRO', 'stage', 5, 14),
  ('PRO', 'points_final', 1, 30),
  ('PRO', 'points_final', 2, 18),
  ('PRO', 'points_final', 3, 12),
  ('PRO', 'kom_final', 1, 30),
  ('PRO', 'kom_final', 2, 18),
  ('PRO', 'kom_final', 3, 12),
  ('C1', 'oneday', 1, 75),
  ('C1', 'oneday', 2, 57),
  ('C1', 'oneday', 3, 51),
  ('C1', 'oneday', 4, 45),
  ('C1', 'oneday', 5, 42),
  ('C1', 'oneday', 6, 39),
  ('C1', 'oneday', 7, 36),
  ('C1', 'oneday', 8, 33),
  ('C1', 'oneday', 9, 30),
  ('C1', 'oneday', 10, 27),
  ('C1', 'gc', 1, 100),
  ('C1', 'gc', 2, 76),
  ('C1', 'gc', 3, 68),
  ('C1', 'gc', 4, 60),
  ('C1', 'gc', 5, 56),
  ('C1', 'gc', 6, 52),
  ('C1', 'gc', 7, 48),
  ('C1', 'gc', 8, 44),
  ('C1', 'gc', 9, 40),
  ('C1', 'gc', 10, 36),
  ('C1', 'stage', 1, 20),
  ('C1', 'stage', 2, 16),
  ('C1', 'stage', 3, 13),
  ('C1', 'stage', 4, 11),
  ('C1', 'stage', 5, 9),
  ('C1', 'points_final', 1, 20),
  ('C1', 'points_final', 2, 12),
  ('C1', 'points_final', 3, 8),
  ('C1', 'kom_final', 1, 20),
  ('C1', 'kom_final', 2, 12),
  ('C1', 'kom_final', 3, 8);
insert into public.category_rule (priority, category, uci_classes, pattern, itt) values (10, 'TDF', array['2.UWT'], '^tour-de-france', null);
insert into public.category_rule (priority, category, uci_classes, pattern, itt) values (20, 'GT', array['2.UWT'], '^(giro-d-italia|vuelta-a-espana)', null);
insert into public.category_rule (priority, category, uci_classes, pattern, itt) values (30, 'MON', array['1.UWT'], '^(milano-sanremo|ronde-van-vlaanderen|paris-roubaix|liege-bastogne-liege|il-lombardia)', null);
insert into public.category_rule (priority, category, uci_classes, pattern, itt) values (40, 'MWT', array['1.UWT', '2.UWT'], '^(paris-nice|tirreno-adriatico|volta-a-catalunya|itzulia|tour-de-romandie|dauphine|tour-auvergne-rhone-alpes|tour-de-suisse|uae-tour|omloop-het-nieuwsblad|strade-bianche|e3-|gent-wevelgem|amstel-gold-race|la-fleche-wallonne|fleche-wallonne|san-sebastian)', null);
insert into public.category_rule (priority, category, uci_classes, pattern, itt) values (50, 'SWT', array['1.UWT', '2.UWT'], null, null);
insert into public.category_rule (priority, category, uci_classes, pattern, itt) values (60, 'WC_ITT', array['WC'], null, true);
insert into public.category_rule (priority, category, uci_classes, pattern, itt) values (61, 'WC', array['WC'], null, false);
insert into public.category_rule (priority, category, uci_classes, pattern, itt) values (70, 'CC_ITT', array['CC'], null, true);
insert into public.category_rule (priority, category, uci_classes, pattern, itt) values (71, 'CC', array['CC'], null, false);
insert into public.category_rule (priority, category, uci_classes, pattern, itt) values (80, 'NC_ITT', array['NC'], null, true);
insert into public.category_rule (priority, category, uci_classes, pattern, itt) values (81, 'NC', array['NC'], null, false);
insert into public.category_rule (priority, category, uci_classes, pattern, itt) values (90, 'PRO', array['1.PRO', '2.PRO'], null, null);
insert into public.category_rule (priority, category, uci_classes, pattern, itt) values (100, 'C1', array['1.1', '2.1'], null, null);
commit;
