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
