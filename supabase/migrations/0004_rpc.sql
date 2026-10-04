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
