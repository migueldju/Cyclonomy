-- =====================================================================================
-- 0023 · Movimientos de la liga (noticias del inicio e histórico del mercado), sacados del libro de cuentas:
--        fichajes del mercado, compras a otros jugadores, clausulazos, ofertas aceptadas y ventas al juego
-- =====================================================================================

create or replace function public.get_league_moves(p_league uuid, p_member uuid default null,
                                                   p_limit integer default 50, p_before timestamptz default null)
returns table (id bigint, created_at timestamptz, kind text, amount bigint, rider_id bigint, rider_name text,
               nationality text, pro_team text, buyer_id uuid, buyer_team text, seller_id uuid, seller_team text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare me public.league_member := public.my_member(p_league);   -- solo para los miembros de la liga
begin
  return query
  with moves as (
    -- el lado que compra (o el que vende al juego) da el movimiento; la otra parte, el apunte gemelo
    select l.id, l.created_at, l.rider_id, abs(l.amount)::bigint as amount,
           case l.kind
             when 'market_buy' then case when s.id is null then 'signing' else 'purchase' end
             when 'clause_paid' then 'clause'
             when 'offer_paid' then 'offer'
             else 'sale_game' end as kind,
           case when l.kind = 'sale_game' then null else l.member_id end as buyer_id,
           case when l.kind = 'sale_game' then l.member_id else s.member_id end as seller_id
    from public.ledger l
    join public.league_member m on m.id = l.member_id and m.league_id = p_league
    left join lateral (
      select x.id, x.member_id from public.ledger x
      join public.league_member xm on xm.id = x.member_id and xm.league_id = p_league
      where x.rider_id = l.rider_id and x.created_at = l.created_at
        and x.kind = case l.kind when 'market_buy' then 'market_sale' when 'clause_paid' then 'clause_received'
                                 when 'offer_paid' then 'offer_received' end
      limit 1) s on true
    where l.kind in ('market_buy', 'clause_paid', 'offer_paid', 'sale_game')
      and (p_before is null or l.created_at < p_before)
  )
  select mv.id, mv.created_at, mv.kind, mv.amount, mv.rider_id, r.name, r.nationality, t.name,
         mv.buyer_id, b.team_name, mv.seller_id, sl.team_name
  from moves mv
  join public.rider r on r.id = mv.rider_id
  left join public.team t on t.id = r.team_id
  left join public.league_member b on b.id = mv.buyer_id
  left join public.league_member sl on sl.id = mv.seller_id
  where p_member is null or mv.buyer_id = p_member or mv.seller_id = p_member
  order by mv.created_at desc, mv.id desc
  limit least(greatest(p_limit, 1), 200);
end $$;

revoke all on function public.get_league_moves(uuid, uuid, integer, timestamptz) from public, anon;
grant execute on function public.get_league_moves(uuid, uuid, integer, timestamptz) to authenticated;
