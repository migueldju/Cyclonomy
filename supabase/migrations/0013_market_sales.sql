-- =====================================================================================
-- 0013 · Ventas en el mercado
--   · Al poner un ciclista a la venta sale al mercado al momento y se queda 48 horas; los demás pujan a ciegas.
--   · 12 horas antes del cierre el juego hace su oferta (valor ±10 %), que el dueño puede aceptar hasta el cierre.
--   · Al cierre gana la puja más alta que se pueda pagar: el comprador paga, el vendedor cobra y el ciclista
--     cambia de dueño el lunes (como las ofertas aceptadas). Sin pujas, el ciclista sigue siendo suyo.
--   · El mercado diario ya no hace las ofertas del juego.
-- =====================================================================================

alter table public.market_listing add column if not exists seller_member_id uuid
  references public.league_member(id) on delete cascade;
alter table public.market_listing add column if not exists seller_ownership_id bigint
  references public.ownership(id) on delete cascade;          -- vendido al juego o traspasado: la venta desaparece
create index if not exists market_listing_seller on public.market_listing (seller_ownership_id) where not resolved;

-- Cobro de una venta en el mercado
alter table public.ledger drop constraint if exists ledger_kind_check;
alter table public.ledger add constraint ledger_kind_check check (kind in (
  'initial','market_buy','market_sale','clause_paid','clause_received','clause_raise','clause_lower',
  'sale_game','offer_paid','offer_received','payout_points','payout_position','adjustment'));

-- Abre la venta de un ciclista: 48 horas, puja mínima su valor de mercado
create or replace function public.open_sale_listing(p_ownership bigint) returns bigint
language plpgsql as $$
declare
  o public.ownership;
  v_id bigint;
begin
  select * into o from public.ownership where id = p_ownership;
  select id into v_id from public.market_listing where seller_ownership_id = o.id and not resolved;
  if v_id is not null then return v_id; end if;
  insert into public.market_listing (league_id, rider_id, base_value, opened_at, closes_at,
                                     seller_member_id, seller_ownership_id)
  select o.league_id, o.rider_id, r.market_value, public.app_now(), public.app_now() + interval '48 hours',
         o.member_id, o.id
  from public.rider r where r.id = o.rider_id
  returning id into v_id;
  return v_id;
end $$;

-- Oferta del juego para cada venta a la que le quedan 12 horas o menos (una por venta)
create or replace function public.make_sale_game_offers() returns integer
language plpgsql as $$
declare n integer;
begin
  insert into public.game_offer (ownership_id, member_id, rider_id, amount, created_at, expires_at)
  select o.id, o.member_id, o.rider_id, (round(r.market_value * (0.9 + random() * 0.2) / 1000) * 1000)::bigint,
         public.app_now(), l.closes_at
  from public.market_listing l
  join public.ownership o on o.id = l.seller_ownership_id
  join public.rider r on r.id = o.rider_id
  where not l.resolved and l.closes_at > public.app_now()
    and l.closes_at - interval '12 hours' <= public.app_now()
    and o.for_sale and o.pending_member_id is null
    and not exists (select 1 from public.game_offer g where g.ownership_id = o.id and g.created_at >= l.opened_at);
  get diagnostics n = row_count;
  return n;
end $$;

-- Cierre de las ventas vencidas
create or replace function public.close_sale_listings() returns integer
language plpgsql as $$
declare
  l record; b record; o public.ownership; lg public.league;
  v_now timestamptz := public.app_now();
  n integer := 0;
  sold boolean;
begin
  for l in
    select * from public.market_listing
    where seller_ownership_id is not null and not resolved and closes_at <= v_now
    order by closes_at
  loop
    select * into o from public.ownership where id = l.seller_ownership_id for update;
    select * into lg from public.league where id = l.league_id;
    sold := false;
    if o.id is not null and o.member_id = l.seller_member_id and o.pending_member_id is null and o.for_sale then
      for b in select * from public.bid where listing_id = l.id order by amount desc, placed_at asc loop
        if public.roster_count(b.member_id) < lg.max_riders and public.can_spend(b.member_id, b.amount, l.id) then
          perform public.post_ledger(b.member_id, -b.amount, 'market_buy', o.rider_id, 'Compra en el mercado');
          perform public.post_ledger(o.member_id, b.amount, 'market_sale', o.rider_id, 'Venta en el mercado');
          update public.ownership
             set pending_member_id = b.member_id, pending_price = b.amount, transfer_at = public.next_monday(v_now)
           where id = o.id;
          update public.market_listing set resolved = true, winner_member_id = b.member_id, price = b.amount
           where id = l.id;
          update public.transfer_offer set status = 'cancelled' where ownership_id = o.id and status = 'open';
          sold := true;
          exit;
        end if;
      end loop;
    end if;
    if not sold then
      update public.market_listing set resolved = true where id = l.id;
    end if;
    -- la venta ha terminado (vendido o no): deja de estar en venta y caduca la oferta del juego
    update public.ownership set for_sale = false where id = l.seller_ownership_id;
    update public.game_offer set status = 'expired' where ownership_id = l.seller_ownership_id and status = 'open';
    n := n + 1;
  end loop;
  return n;
end $$;

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
  if o.for_sale = p_for_sale then return; end if;
  update public.ownership set for_sale = p_for_sale where id = o.id;
  if p_for_sale then
    perform public.open_sale_listing(o.id);       -- sale al mercado al momento, durante 48 horas
  else
    -- retirada: fuera del mercado, se anulan las pujas y la oferta del juego
    delete from public.bid where listing_id in
      (select id from public.market_listing where seller_ownership_id = o.id and not resolved);
    update public.market_listing set resolved = true where seller_ownership_id = o.id and not resolved;
    update public.game_offer set status = 'expired' where ownership_id = o.id and status = 'open';
  end if;
end $$;

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
  if l.seller_member_id = m.id then raise exception 'No puedes pujar por tu propio ciclista'; end if;
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

  -- 1. Cerrar subastas vencidas del mercado diario (ciclistas libres), empezando por las de puja más alta.
  --    Las ventas de los jugadores se cierran aparte (close_sale_listings), cada una a sus 48 horas.
  for l in
    select ml.* from public.market_listing ml
    where ml.league_id = p_league and not ml.resolved and ml.closes_at <= v_now and ml.seller_member_id is null
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

  -- 2. Nuevos ciclistas al mercado (las ofertas del juego ya no van aquí: ver make_sale_game_offers)
  insert into public.market_listing (league_id, rider_id, base_value, opened_at, closes_at)
  select p_league, f.id, f.market_value, v_now, v_next
  from public.free_riders(p_league) f order by random() limit lg.market_size;

  update public.league set next_market_at = v_next where id = p_league;
end $$;

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

  -- Ventas de los jugadores: oferta del juego 12 h antes del cierre y cierre a las 48 h
  perform public.make_sale_game_offers();
  perform public.close_sale_listings();

  -- Ofertas entre jugadores caducadas
  update public.transfer_offer set status = 'expired' where status = 'open' and expires_at <= v_now;

  -- Valores de mercado, una vez al día desde las 05:00
  if extract(hour from v_now at time zone 'Europe/Madrid') >= 5
     and not exists (select 1 from public.job_state where key = 'rider_values' and last_day = today) then
    perform public.update_rider_values();
  end if;
end $$;

-- Mercado: ciclistas libres y ventas de los jugadores (con su vendedor y, si es mía, la oferta del juego)
drop function if exists public.get_market(uuid);
create function public.get_market(p_league uuid)
returns table (listing_id bigint, rider_id bigint, rider_name text, pro_team text, nationality text, age integer,
               base_value bigint, market_value bigint, season_points integer, closes_at timestamptz,
               bid_count integer, my_bid bigint, photo_url text, seller_member_id uuid, seller_team text,
               is_mine boolean, seller_ownership_id bigint, game_offer_id bigint, game_offer_amount bigint,
               game_offer_expires timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  me public.league_member := public.my_member(p_league);
  v_season integer := extract(year from public.app_now() at time zone 'Europe/Madrid');
begin
  return query
  select l.id, r.id, r.name, t.name, r.nationality, public.age_at(r.birthdate)::int, l.base_value, r.market_value,
         coalesce(sp.points, 0), l.closes_at,
         (select count(*)::int from public.bid b where b.listing_id = l.id),
         (select b.amount from public.bid b where b.listing_id = l.id and b.member_id = me.id),
         r.photo_url, l.seller_member_id, sm.team_name, coalesce(l.seller_member_id = me.id, false),
         case when l.seller_member_id = me.id then l.seller_ownership_id end,
         g.id, g.amount, g.expires_at
  from public.market_listing l
  join public.rider r on r.id = l.rider_id
  left join public.team t on t.id = r.team_id
  left join public.rider_season_points sp on sp.rider_id = r.id and sp.season = v_season
  left join public.league_member sm on sm.id = l.seller_member_id
  left join public.ownership o on o.id = l.seller_ownership_id
  left join lateral (select go.id, go.amount, go.expires_at from public.game_offer go
                     where l.seller_member_id = me.id and go.ownership_id = l.seller_ownership_id
                       and go.status = 'open' and go.expires_at > public.app_now()
                     order by go.created_at desc limit 1) g on true
  where l.league_id = p_league and not l.resolved
    and (l.seller_ownership_id is null or (o.for_sale and o.pending_member_id is null))
  order by l.closes_at, l.base_value desc;
end $$;

grant execute on function public.get_market(uuid) to authenticated;

-- Lo que ya estaba a la venta sale al mercado ahora (48 horas desde ya)
do $$
declare x record;
begin
  for x in select id from public.ownership where for_sale and pending_member_id is null loop
    perform public.open_sale_listing(x.id);
  end loop;
end $$;
