-- =====================================================================================
-- 0012 · Cláusula por escalones: del 150 % al 500 % del precio pagado, de 50 en 50 puntos (8 niveles: 0 a 7)
--   subir: se paga la mitad de lo que sube · bajar: se recibe un cuarto de lo que baja (nunca por debajo del 150 %)
-- Sustituye a raise_clause (que solo subía un 50 % cada vez, con tope en el 300 %).
-- =====================================================================================

-- Las bajadas se apuntan en el libro de cuentas como 'clause_lower'
alter table public.ledger drop constraint if exists ledger_kind_check;
alter table public.ledger add constraint ledger_kind_check check (kind in (
  'initial','market_buy','clause_paid','clause_received','clause_raise','clause_lower',
  'sale_game','offer_paid','offer_received','payout_points','payout_position','adjustment'));

-- Cláusula de un escalón: 0 = 150 % del precio pagado … 7 = 500 %
create or replace function public.clause_level_value(p_price bigint, p_level integer) returns bigint
language sql immutable as $$
  select round(p_price * (1.5 + 0.5 * p_level))::bigint
$$;

drop function if exists public.raise_clause(bigint, integer);
drop function if exists public.raise_clause(bigint);

create or replace function public.set_clause(p_ownership bigint, p_level integer) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  o public.ownership;
  m public.league_member;
  v_new bigint; v_amount bigint;
begin
  if p_level is null or p_level < 0 or p_level > 7 then
    raise exception 'El escalón de la cláusula va de 0 (150 %%) a 7 (500 %% del precio pagado)';
  end if;
  select * into o from public.ownership where id = p_ownership for update;
  if not found then raise exception 'Ese ciclista ya no está en tu plantilla'; end if;
  m := public.my_member(o.league_id);
  if o.member_id <> m.id or o.pending_member_id is not null then
    raise exception 'Solo puedes cambiar la cláusula de tus ciclistas que no tengan un traspaso pendiente';
  end if;
  v_new := public.clause_level_value(o.price_paid, p_level);
  if v_new = o.clause then raise exception 'La cláusula ya está en ese escalón'; end if;
  if v_new > o.clause then
    v_amount := ceil((v_new - o.clause) / 2.0)::bigint;                 -- subir: la mitad de la subida
    if not public.can_spend(m.id, v_amount) then raise exception 'No tienes saldo suficiente'; end if;
    perform public.post_ledger(m.id, -v_amount, 'clause_raise', o.rider_id, 'Subida de cláusula');
  else
    v_amount := floor((o.clause - v_new) / 4.0)::bigint;               -- bajar: un cuarto de la bajada
    perform public.post_ledger(m.id, v_amount, 'clause_lower', o.rider_id, 'Bajada de cláusula');
  end if;
  update public.ownership set clause = v_new where id = o.id;
  return v_new;
end $$;

grant execute on function public.set_clause(bigint, integer) to authenticated;
