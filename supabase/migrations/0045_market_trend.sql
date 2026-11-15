-- 0045: tendencia del valor en el mercado.
--        get_market devuelve además `trend`: 1 si el valor del ciclista (en el sistema de la liga) es mayor que hace
--        7 días, -1 si es menor y 0 si no ha cambiado o aún no hay historial de hace una semana.
drop function if exists public.get_market(uuid);
create function public.get_market(p_league uuid)
returns table (listing_id bigint, rider_id bigint, rider_name text, pro_team text, nationality text, age integer,
               base_value bigint, market_value bigint, season_points integer, closes_at timestamptz, bid_count integer,
               my_bid bigint, photo_url text, seller_member_id uuid, seller_team text, is_mine boolean,
               seller_ownership_id bigint, game_offer_id bigint, game_offer_amount bigint,
               game_offer_expires timestamptz, trend integer)
language plpgsql stable security definer set search_path = public as $function$
declare
  v_scheme text := public.league_scheme(p_league);
  me public.league_member := public.my_member(p_league);
  v_season integer := extract(year from public.app_now() at time zone 'Europe/Madrid');
  v_today date := (public.app_now() at time zone 'Europe/Madrid')::date;
begin
  return query
  select l.id, r.id, r.name, t.name, r.nationality, public.age_at(r.birthdate)::int, l.base_value, public.rider_value(r.id, v_scheme),
         coalesce(sp.points, 0), l.closes_at,
         (select count(*)::int from public.bid b where b.listing_id = l.id),
         (select b.amount from public.bid b where b.listing_id = l.id and b.member_id = me.id),
         r.photo_url, l.seller_member_id, sm.team_name, coalesce(l.seller_member_id = me.id, false),
         case when l.seller_member_id = me.id then l.seller_ownership_id end,
         g.id, g.amount, g.expires_at,
         coalesce((select sign(public.rider_value(r.id, v_scheme) - h.value)::int
                   from public.rider_value_history h
                   where h.rider_id = r.id and h.scheme = v_scheme and h.day <= v_today - 7
                   order by h.day desc limit 1), 0)
  from public.market_listing l
  join public.rider r on r.id = l.rider_id
  left join public.team t on t.id = r.team_id
  left join public.rider_season_points sp on sp.rider_id = r.id and sp.season = v_season and sp.scheme = v_scheme
  left join public.league_member sm on sm.id = l.seller_member_id
  left join public.ownership o on o.id = l.seller_ownership_id
  left join lateral (select go.id, go.amount, go.expires_at from public.game_offer go
                     where l.seller_member_id = me.id and go.ownership_id = l.seller_ownership_id
                       and go.status = 'open' and go.expires_at > public.app_now()
                     order by go.created_at desc limit 1) g on true
  where l.league_id = p_league and not l.resolved
    and (l.seller_ownership_id is null or (o.for_sale and o.pending_member_id is null))
  order by l.closes_at, l.base_value desc;
end $function$;

grant execute on function public.get_market(uuid) to authenticated;
