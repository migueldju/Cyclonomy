-- =====================================================================================
-- 0040 · Cláusula libre: sin escalones ni máximo. El dueño la pone en la cantidad que quiera, con un mínimo del
--        130 % de la base (lo pagado o, si es mayor, el valor de mercado). Se guarda como porcentaje de la base,
--        así sigue indexada al valor de mercado. Subir cuesta la mitad de lo que sube; bajar devuelve un cuarto.
-- =====================================================================================

alter table public.ownership add column if not exists clause_pct numeric not null default 1.3 check (clause_pct >= 1.3);
update public.ownership set clause_pct = public.clause_pct(clause_level);

create or replace function public.ownership_clause_trg() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.member_id is distinct from old.member_id then
    new.clause_pct := 1.3;
    new.locked_week := null;
  end if;
  new.clause := round(public.clause_base(new.price_paid, new.rider_id, new.league_id) * new.clause_pct)::bigint;
  return new;
end $$;
drop trigger if exists ownership_clause on public.ownership;
create trigger ownership_clause before insert or update of price_paid, clause_pct, member_id, clause
  on public.ownership for each row execute function public.ownership_clause_trg();

create or replace function public.refresh_clauses() returns integer
language plpgsql as $$
declare n integer;
begin
  update public.ownership o
     set clause = round(public.clause_base(o.price_paid, o.rider_id, o.league_id) * o.clause_pct)::bigint
   where o.clause <> round(public.clause_base(o.price_paid, o.rider_id, o.league_id) * o.clause_pct)::bigint;
  get diagnostics n = row_count;
  return n;
end $$;

-- Poner la cláusula de uno de mis ciclistas en una cantidad (mínimo, el 130 % de su base)
drop function if exists public.set_clause(bigint, integer);
create or replace function public.set_clause(p_ownership bigint, p_amount bigint) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  o public.ownership;
  m public.league_member;
  v_base bigint; v_min bigint; v_amount bigint;
begin
  select * into o from public.ownership where id = p_ownership for update;
  if not found then raise exception 'Ese ciclista ya no está en tu plantilla'; end if;
  m := public.my_member(o.league_id);
  if o.member_id <> m.id or o.pending_member_id is not null then
    raise exception 'Solo puedes cambiar la cláusula de tus ciclistas que no tengan un traspaso pendiente';
  end if;
  v_base := public.clause_base(o.price_paid, o.rider_id, o.league_id);
  v_min := ceil(v_base * 1.3)::bigint;
  if p_amount is null or p_amount < v_min then
    raise exception 'La cláusula no puede bajar del 130 %% de su base (%)', v_min;
  end if;
  if p_amount = o.clause then raise exception 'La cláusula ya es esa'; end if;
  if p_amount > o.clause then
    v_amount := ceil((p_amount - o.clause) / 2.0)::bigint;                -- subir: la mitad de la subida
    if not public.can_spend(m.id, v_amount) then raise exception 'No tienes saldo suficiente'; end if;
    perform public.post_ledger(m.id, -v_amount, 'clause_raise', o.rider_id, 'Subida de cláusula');
  else
    v_amount := floor((o.clause - p_amount) / 4.0)::bigint;              -- bajar: un cuarto de la bajada
    perform public.post_ledger(m.id, v_amount, 'clause_lower', o.rider_id, 'Bajada de cláusula');
  end if;
  update public.ownership set clause_pct = greatest(1.3, p_amount::numeric / v_base) where id = o.id;
  return p_amount;
end $$;
revoke all on function public.set_clause(bigint, bigint) from public, anon;
grant execute on function public.set_clause(bigint, bigint) to authenticated;

-- Plantilla: la base de la cláusula (en vez del escalón)
drop function if exists public.get_roster(uuid, uuid);
create function public.get_roster(p_league uuid, p_member uuid default null)
returns table (ownership_id bigint, rider_id bigint, rider_name text, pro_team text, nationality text, age integer,
               market_value bigint, price_paid bigint, clause bigint, clause_base bigint, locked boolean,
               locked_next boolean, lock_cost bigint,
               season_points integer, league_points integer, status text, available_from timestamptz,
               for_sale boolean, game_offer_id bigint, game_offer_amount bigint, game_offer_expires timestamptz,
               transferable boolean, photo_url text)
language plpgsql stable security definer set search_path = public as $$
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
         r.photo_url
  from public.ownership o
  join public.rider r on r.id = o.rider_id
  left join public.team t on t.id = r.team_id
  left join public.rider_season_points sp on sp.rider_id = r.id and sp.season = v_season and sp.scheme = v_scheme
  left join lateral (select go.id, go.amount, go.expires_at from public.game_offer go
                     where v_mine and go.ownership_id = o.id and go.status = 'open' and go.expires_at > v_now
                     order by go.created_at desc limit 1) g on true
  where o.league_id = p_league and (o.member_id = v_target or o.pending_member_id = v_target)
  order by public.rider_value(r.id, v_scheme) desc;
end $$;
revoke all on function public.get_roster(uuid, uuid) from public, anon;
grant execute on function public.get_roster(uuid, uuid) to authenticated;

alter table public.ownership drop column if exists clause_level;
drop function if exists public.clause_value(bigint, bigint, uuid, integer);
