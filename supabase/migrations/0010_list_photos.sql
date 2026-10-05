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
