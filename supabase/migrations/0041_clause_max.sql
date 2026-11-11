-- =====================================================================================
-- 0041 · Cláusula: tope del 700 % de su base (se elige con una barra de 1 en 1 %, del 130 % al 700 %).
-- =====================================================================================

update public.ownership set clause_pct = 7 where clause_pct > 7;
alter table public.ownership drop constraint if exists ownership_clause_pct_max;
alter table public.ownership add constraint ownership_clause_pct_max check (clause_pct <= 7);

create or replace function public.set_clause(p_ownership bigint, p_amount bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  o public.ownership;
  m public.league_member;
  v_base bigint; v_min bigint; v_max bigint; v_amount bigint;
begin
  select * into o from public.ownership where id = p_ownership for update;
  if not found then raise exception 'Ese ciclista ya no está en tu plantilla'; end if;
  m := public.my_member(o.league_id);
  if o.member_id <> m.id or o.pending_member_id is not null then
    raise exception 'Solo puedes cambiar la cláusula de tus ciclistas que no tengan un traspaso pendiente';
  end if;
  v_base := public.clause_base(o.price_paid, o.rider_id, o.league_id);
  v_min := ceil(v_base * 1.3)::bigint;
  v_max := floor(v_base * 7)::bigint;
  if p_amount is null or p_amount < v_min then
    raise exception 'La cláusula no puede bajar del 130 %% de su base (%)', v_min;
  end if;
  if p_amount > v_max then raise exception 'La cláusula no puede pasar del 700 %% de su base (%)', v_max; end if;
  if p_amount = o.clause then raise exception 'La cláusula ya es esa'; end if;
  if p_amount > o.clause then
    v_amount := ceil((p_amount - o.clause) / 2.0)::bigint;                -- subir: la mitad de la subida
    if not public.can_spend(m.id, v_amount) then raise exception 'No tienes saldo suficiente'; end if;
    perform public.post_ledger(m.id, -v_amount, 'clause_raise', o.rider_id, 'Subida de cláusula');
  else
    v_amount := floor((o.clause - p_amount) / 4.0)::bigint;              -- bajar: un cuarto de la bajada
    perform public.post_ledger(m.id, v_amount, 'clause_lower', o.rider_id, 'Bajada de cláusula');
  end if;
  update public.ownership set clause_pct = least(7, greatest(1.3, p_amount::numeric / v_base)) where id = o.id;
  return p_amount;
end $$;
