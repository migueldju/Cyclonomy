-- =====================================================================================
-- 0048 · Los fichajes del mercado llegan al cerrar el mercado: los ciclistas libres se pueden inscribir desde ese
--        momento y los que vendía otro jugador cambian de equipo al cierre (antes, el lunes siguiente).
--        Las ofertas aceptadas entre jugadores siguen haciéndose efectivas el lunes.
-- =====================================================================================

CREATE OR REPLACE FUNCTION public.resolve_market(p_league uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
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
        values (p_league, l.rider_id, b.member_id, b.amount, round(b.amount * 1.5), v_now, v_now);
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
end $function$;

CREATE OR REPLACE FUNCTION public.close_sale_listings()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
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
          -- cambia de equipo al cierre: fuera de las inscripciones del vendedor que siguen abiertas
          delete from public.race_entry_rider er
           using public.race_entry e, public.race rc
           where er.entry_id = e.id and rc.id = e.race_id and er.rider_id = o.rider_id
             and e.league_id = o.league_id and e.member_id = o.member_id and rc.entries_close_at > v_now;
          update public.ownership
             set member_id = b.member_id, price_paid = b.amount, acquired_at = v_now, eligible_from = v_now
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
end $function$;

-- los que estaban esperando al lunes ya se pueden inscribir
update public.ownership set eligible_from = public.app_now()
 where pending_member_id is null and eligible_from > public.app_now();
