-- 0046: tendencia del valor también en la plantilla.
--        rider_trend(ciclista, sistema): 1 si su valor es mayor que hace 7 días, -1 si es menor, 0 si no ha cambiado
--        o aún no hay historial de hace una semana. get_roster devuelve además `trend`.
create or replace function public.rider_trend(p_rider bigint, p_scheme text) returns integer
language sql stable set search_path = public as $$
  select coalesce((select sign(public.rider_value(p_rider, p_scheme) - h.value)::int
                   from public.rider_value_history h
                   where h.rider_id = p_rider and h.scheme = p_scheme
                     and h.day <= (public.app_now() at time zone 'Europe/Madrid')::date - 7
                   order by h.day desc limit 1), 0)
$$;
revoke all on function public.rider_trend(bigint, text) from public, anon;
grant execute on function public.rider_trend(bigint, text) to authenticated;

drop function if exists public.get_roster(uuid, uuid);
create function public.get_roster(p_league uuid, p_member uuid DEFAULT NULL::uuid)
 RETURNS TABLE(ownership_id bigint, rider_id bigint, rider_name text, pro_team text, nationality text, age integer, market_value bigint, price_paid bigint, clause bigint, clause_base bigint, locked boolean, locked_next boolean, lock_cost bigint, season_points integer, league_points integer, status text, available_from timestamp with time zone, for_sale boolean, game_offer_id bigint, game_offer_amount bigint, game_offer_expires timestamp with time zone, transferable boolean, photo_url text, trend integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_scheme text := public.league_scheme(p_league);
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
         public.rider_value(r.id, v_scheme), o.price_paid, o.clause,
         public.clause_base(o.price_paid, r.id, p_league),                   -- base de la cláusula
         coalesce(o.locked_week = public.week_start(v_now), false),         -- blindado esta semana
         coalesce(o.locked_week = public.week_start(v_now) + 7, false),     -- blindado la que viene
         round(public.rider_value(r.id, v_scheme) * 0.08)::bigint,          -- lo que cuesta blindarlo
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
         r.photo_url,
         public.rider_trend(r.id, v_scheme)
  from public.ownership o
  join public.rider r on r.id = o.rider_id
  left join public.team t on t.id = r.team_id
  left join public.rider_season_points sp on sp.rider_id = r.id and sp.season = v_season and sp.scheme = v_scheme
  left join lateral (select go.id, go.amount, go.expires_at from public.game_offer go
                     where v_mine and go.ownership_id = o.id and go.status = 'open' and go.expires_at > v_now
                     order by go.created_at desc limit 1) g on true
  where o.league_id = p_league and (o.member_id = v_target or o.pending_member_id = v_target)
  order by public.rider_value(r.id, v_scheme) desc;
end $function$;

revoke all on function public.get_roster(uuid, uuid) from public, anon;
grant execute on function public.get_roster(uuid, uuid) to authenticated;
