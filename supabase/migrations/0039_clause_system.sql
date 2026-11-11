-- =====================================================================================
-- 0039 · Nuevo sistema de cláusulas.
--   · La cláusula se calcula sobre una base: lo que se pagó por el ciclista o, si su valor de mercado (en el
--     sistema de la liga) es mayor, su valor de mercado. Se actualiza sola cada día con el valor.
--   · Escalones (clause_level): 0 = 130 % de la base (el de partida), 1 = 150 %, 2 = 200 % … 8 = 500 %. Subir
--     cuesta la mitad de lo que sube; bajar devuelve un cuarto de lo que baja (como antes).
--   · Bloqueo: el dueño puede blindar un ciclista la semana siguiente pagando el 8 % de su valor de mercado;
--     esa semana nadie puede pagar su cláusula (sí hacerle ofertas). Se paga durante la semana anterior.
--   · Los clausulazos están cerrados los domingos de 14:00 a 24:00.
-- =====================================================================================

alter table public.ownership add column if not exists clause_level smallint not null default 0
  check (clause_level between 0 and 8);
alter table public.ownership add column if not exists locked_week date;   -- lunes de la semana blindada

alter table public.ledger drop constraint if exists ledger_kind_check;
alter table public.ledger add constraint ledger_kind_check check (kind in (
  'initial','market_buy','market_sale','clause_paid','clause_received','clause_raise','clause_lower','clause_lock',
  'sale_game','offer_paid','offer_received','payout_points','payout_position','adjustment'));

-- Porcentaje de un escalón: 0 = 130 %, 1 = 150 %, 2 = 200 % … 8 = 500 %
create or replace function public.clause_pct(p_level integer) returns numeric
language sql immutable as $$
  select case when p_level <= 0 then 1.3 else 1.5 + 0.5 * (p_level - 1) end
$$;

-- Base de la cláusula: lo pagado o, si es mayor, el valor de mercado en el sistema de la liga
create or replace function public.clause_base(p_price bigint, p_rider bigint, p_league uuid) returns bigint
language sql stable as $$
  select greatest(coalesce(p_price, 0), public.rider_value(p_rider, public.league_scheme(p_league)))
$$;

create or replace function public.clause_value(p_price bigint, p_rider bigint, p_league uuid, p_level integer)
returns bigint language sql stable as $$
  select round(public.clause_base(p_price, p_rider, p_league) * public.clause_pct(p_level))::bigint
$$;

-- La cláusula guardada siempre cuadra con su escalón y su base; con un nuevo dueño, vuelve al 130 % y sin bloqueo
create or replace function public.ownership_clause_trg() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.member_id is distinct from old.member_id then
    new.clause_level := 0;
    new.locked_week := null;
  end if;
  new.clause := public.clause_value(new.price_paid, new.rider_id, new.league_id, new.clause_level);
  return new;
end $$;
drop trigger if exists ownership_clause on public.ownership;
create trigger ownership_clause before insert or update of price_paid, clause_level, member_id, clause
  on public.ownership for each row execute function public.ownership_clause_trg();

-- Escalón de las cláusulas que ya había (antes: 150 % … 500 % de lo pagado). El 150 % de partida pasa al 130 %
update public.ownership
   set clause_level = case when price_paid <= 0 or clause <= round(price_paid * 1.5) then 0
                           else least(8, greatest(1, round((clause::numeric / price_paid - 1.5) / 0.5)::int + 1)) end;

-- Al cambiar los valores de mercado, las cláusulas indexadas cambian con ellos
create or replace function public.refresh_clauses() returns integer
language plpgsql as $$
declare n integer;
begin
  update public.ownership o
     set clause = public.clause_value(o.price_paid, o.rider_id, o.league_id, o.clause_level)
   where o.clause <> public.clause_value(o.price_paid, o.rider_id, o.league_id, o.clause_level);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.refresh_clauses_after_values() returns trigger
language plpgsql as $$
begin
  perform public.refresh_clauses();
  return null;
end $$;
drop trigger if exists rider_value_clauses on public.rider_value;
create trigger rider_value_clauses after update on public.rider_value
  for each statement execute function public.refresh_clauses_after_values();

-- Cambiar el escalón de la cláusula de uno de mis ciclistas
create or replace function public.set_clause(p_ownership bigint, p_level integer) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  o public.ownership;
  m public.league_member;
  v_new bigint; v_amount bigint;
begin
  if p_level is null or p_level < 0 or p_level > 8 then
    raise exception 'El escalón de la cláusula va de 0 (130 %%) a 8 (500 %%)';
  end if;
  select * into o from public.ownership where id = p_ownership for update;
  if not found then raise exception 'Ese ciclista ya no está en tu plantilla'; end if;
  m := public.my_member(o.league_id);
  if o.member_id <> m.id or o.pending_member_id is not null then
    raise exception 'Solo puedes cambiar la cláusula de tus ciclistas que no tengan un traspaso pendiente';
  end if;
  if p_level = o.clause_level then raise exception 'La cláusula ya está en ese escalón'; end if;
  v_new := public.clause_value(o.price_paid, o.rider_id, o.league_id, p_level);
  if v_new > o.clause then
    v_amount := ceil((v_new - o.clause) / 2.0)::bigint;                 -- subir: la mitad de la subida
    if not public.can_spend(m.id, v_amount) then raise exception 'No tienes saldo suficiente'; end if;
    perform public.post_ledger(m.id, -v_amount, 'clause_raise', o.rider_id, 'Subida de cláusula');
  else
    v_amount := floor((o.clause - v_new) / 4.0)::bigint;               -- bajar: un cuarto de la bajada
    perform public.post_ledger(m.id, v_amount, 'clause_lower', o.rider_id, 'Bajada de cláusula');
  end if;
  update public.ownership set clause_level = p_level where id = o.id;
  return v_new;
end $$;
grant execute on function public.set_clause(bigint, integer) to authenticated;

-- Blindar uno de mis ciclistas la semana que viene: el 8 % de su valor de mercado
create or replace function public.lock_rider(p_ownership bigint) returns date
language plpgsql security definer set search_path = public as $$
declare
  o public.ownership;
  m public.league_member;
  v_week date := public.week_start(public.app_now()) + 7;
  v_cost bigint;
begin
  select * into o from public.ownership where id = p_ownership for update;
  if not found then raise exception 'Ese ciclista ya no está en tu plantilla'; end if;
  m := public.my_member(o.league_id);
  if o.member_id <> m.id or o.pending_member_id is not null then
    raise exception 'Solo puedes blindar tus ciclistas que no tengan un traspaso pendiente';
  end if;
  if o.locked_week = v_week then raise exception 'Este ciclista ya está blindado la semana que viene'; end if;
  v_cost := round(public.rider_value(o.rider_id, public.league_scheme(o.league_id)) * 0.08)::bigint;
  if not public.can_spend(m.id, v_cost) then raise exception 'No tienes saldo suficiente'; end if;
  perform public.post_ledger(m.id, -v_cost, 'clause_lock', o.rider_id, 'Blindaje de una semana');
  update public.ownership set locked_week = v_week where id = o.id;
  return v_week;
end $$;
revoke all on function public.lock_rider(bigint) from public, anon;
grant execute on function public.lock_rider(bigint) to authenticated;

-- Pagar la cláusula: cerrado los domingos de 14:00 a 24:00 y con el ciclista blindado esa semana
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
  if extract(isodow from madrid) = 7 and extract(hour from madrid) >= 14 then
    raise exception 'Los clausulazos están cerrados los domingos de 14:00 a 24:00';
  end if;
  if o.locked_week = public.week_start(public.app_now()) then
    raise exception 'Este ciclista está blindado esta semana: no se puede pagar su cláusula';
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

-- las cláusulas de todos, ya con su base y su escalón
select public.refresh_clauses();

-- Plantilla: el escalón de la cláusula y el blindaje de cada ciclista (sustituye a next_clause)
drop function if exists public.get_roster(uuid, uuid);
create function public.get_roster(p_league uuid, p_member uuid default null)
returns table (ownership_id bigint, rider_id bigint, rider_name text, pro_team text, nationality text, age integer,
               market_value bigint, price_paid bigint, clause bigint, clause_level smallint, locked boolean,
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
         o.clause_level,
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

create or replace function public.get_rider(p_league uuid, p_rider bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me public.league_member := public.my_member(p_league);
  v_scheme text := public.league_scheme(p_league);
  v_season integer := extract(year from public.app_now() at time zone 'Europe/Madrid');
  v_today date := (public.app_now() at time zone 'Europe/Madrid')::date;
begin
  if not exists (select 1 from public.rider where id = p_rider) then
    raise exception 'El ciclista no existe';
  end if;
  return jsonb_build_object(
    'rider', (select jsonb_build_object(
                'id', r.id, 'name', r.name, 'pro_team', t.name, 'nationality', r.nationality,
                'age', public.age_at(r.birthdate)::int, 'market_value', public.rider_value(r.id, v_scheme),
                'season_points', coalesce((select sp.points from public.rider_season_points sp
                                           where sp.rider_id = r.id and sp.season = v_season and sp.scheme = v_scheme), 0),
                'photo', case when r.photo_url is null then null else jsonb_build_object(
                           'url', r.photo_url, 'author', r.photo_author, 'license', r.photo_license,
                           'license_url', r.photo_license_url, 'page_url', r.photo_page_url) end)
              from public.rider r left join public.team t on t.id = r.team_id where r.id = p_rider),
    'owner', (select jsonb_build_object('member_id', m.id, 'team_name', m.team_name, 'is_mine', m.id = me.id,
                                        'clause', o.clause,
                                        'locked', coalesce(o.locked_week = public.week_start(public.app_now()), false))
              from public.ownership o join public.league_member m on m.id = o.member_id
              where o.league_id = p_league and o.rider_id = p_rider),
    'values', coalesce((
      select jsonb_agg(jsonb_build_object('day', h.day, 'value', h.value) order by h.day)
      from public.rider_value_history h
      where h.rider_id = p_rider and h.scheme = v_scheme and h.day > v_today - 365 and h.day <= v_today), '[]'::jsonb),
    'results', coalesce((
      select jsonb_agg(jsonb_build_object(
               'stage_id', x.stage_id, 'race_key', x.race_key, 'race_start', x.race_start, 'race_end', x.race_end,
               'race_name', x.race_name, 'country', x.country, 'category', x.category,
               'is_stage_race', x.is_stage_race, 'number', x.number, 'date', x.date, 'kind', x.kind,
               'position', x.position, 'points', x.points)
             order by x.date desc, x.kind_order)
      from (
        -- resultados del juego
        (select s.id stage_id, 'g' || rc.id race_key, rc.start_date race_start, rc.end_date race_end, rc.name race_name, rc.country, rc.category, rc.is_stage_race, s.number, s.date,
                res.kind, res.position,
                case res.kind when 'stage' then 0 when 'gc' then 1 when 'points' then 2 else 3 end kind_order,
                coalesce((select sum(rs.points)::int from public.rider_score rs
                          where rs.stage_id = s.id and rs.rider_id = p_rider and rs.scheme = v_scheme
                            and rs.kind = case res.kind when 'stage' then (case when rc.is_stage_race then 'stage' else 'oneday' end)
                                                        when 'gc' then 'gc' when 'points' then 'points_final'
                                                        else 'kom_final' end), 0) points
         from public.result res
         join public.stage s on s.id = res.stage_id
         join public.race rc on rc.id = s.race_id
         where res.rider_id = p_rider and s.date <= v_today
           and (res.kind = 'stage'
                or (rc.is_stage_race and res.kind in ('gc', 'points', 'kom')
                    and s.number = (select max(s2.number) from public.stage s2 where s2.race_id = rc.id))))
        union all
        -- historial: los puntos son los que daría la tabla de puntuación de la liga
        (select null::bigint, 'h' || h.season || '-' || h.race_slug,
                min(h.date) over (partition by h.season, h.race_slug), max(h.date) over (partition by h.season, h.race_slug),
                h.race_name, h.country, h.category, h.is_stage_race, h.number, h.date, h.kind, h.position,
                case h.kind when 'stage' then 0 when 'gc' then 1 when 'points' then 2 else 3 end,
                coalesce((select sr.points from public.scoring_points sr
                          where sr.scheme = v_scheme and sr.grp = public.scoring_group(v_scheme, h.category, h.race_slug)
                            and sr.position = h.position
                            and sr.kind = case h.kind when 'stage' then (case when h.is_stage_race then 'stage' else 'oneday' end)
                                                      when 'gc' then 'gc' when 'points' then 'points_final'
                                                      else 'kom_final' end), 0)
         from public.rider_history_result h
         where h.rider_id = p_rider and h.date <= v_today
           -- si la carrera también está en el calendario del juego, valen sus resultados (no se repiten)
           and not exists (select 1 from public.race g where g.pcs_slug = h.race_slug and g.season = h.season))
        order by 10 desc
        limit 600) x), '[]'::jsonb));
end $$;
