-- =====================================================================================
-- 0003 · Lógica interna y tareas programadas. Ninguna de estas funciones se expone a la app
--        (0005 les quita el permiso de ejecución); las llaman las RPC, pg_cron o la ingesta.
-- =====================================================================================

-- ---------------------------------------------------------------- dinero y plantilla
create or replace function public.post_ledger(p_member uuid, p_amount bigint, p_kind text,
                                              p_rider bigint default null, p_note text default null)
returns void language plpgsql as $$
begin
  insert into public.ledger (member_id, amount, kind, rider_id, note, created_at)
  values (p_member, p_amount, p_kind, p_rider, p_note, public.app_now());
  update public.league_member set balance = balance + p_amount where id = p_member;
end $$;

-- Plantilla efectiva: lo que tengo y no se va + lo que me llega
create or replace function public.roster_count(p_member uuid) returns integer
language sql stable as $$
  select count(*)::int from public.ownership
  where (member_id = p_member and pending_member_id is null) or pending_member_id = p_member
$$;

create or replace function public.team_value(p_member uuid) returns bigint
language sql stable as $$
  select coalesce(sum(r.market_value), 0)::bigint
  from public.ownership o join public.rider r on r.id = o.rider_id
  where (o.member_id = p_member and o.pending_member_id is null) or o.pending_member_id = p_member
$$;

create or replace function public.committed_bids(p_member uuid, p_except_listing bigint default null)
returns bigint language sql stable as $$
  select coalesce(sum(b.amount), 0)::bigint
  from public.bid b join public.market_listing l on l.id = b.listing_id
  where b.member_id = p_member and not l.resolved and l.id is distinct from p_except_listing
$$;

-- Límite de deuda: el saldo, descontando pujas abiertas, no puede bajar de −20 % del valor de la plantilla
create or replace function public.debt_limit(p_member uuid) returns bigint
language sql stable as $$
  select (public.team_value(p_member) * 0.20)::bigint
$$;

create or replace function public.can_spend(p_member uuid, p_amount bigint, p_except_listing bigint default null)
returns boolean language sql stable as $$
  select m.balance - public.committed_bids(p_member, p_except_listing) - p_amount >= -public.debt_limit(p_member)
  from public.league_member m where m.id = p_member
$$;

-- ---------------------------------------------------------------- utilidades
create or replace function public.next_market_time(p_hour int, p_after timestamptz default null)
returns timestamptz language plpgsql stable as $$
declare
  base timestamptz := coalesce(p_after, public.app_now());
  d date := (base at time zone 'Europe/Madrid')::date;
  t timestamptz;
begin
  t := (d::timestamp + make_interval(hours => p_hour)) at time zone 'Europe/Madrid';
  if t <= base then
    t := ((d + 1)::timestamp + make_interval(hours => p_hour)) at time zone 'Europe/Madrid';
  end if;
  return t;
end $$;

create or replace function public.gen_invite_code() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.league where invite_code = code);
  end loop;
  return code;
end $$;

create or replace function public.age_at(p_birth date, p_day date default null) returns numeric
language sql stable as $$
  select date_part('year', age(coalesce(p_day, (public.app_now() at time zone 'Europe/Madrid')::date), p_birth))::numeric
$$;

-- Ciclistas libres en una liga (sin dueño y fuera del mercado abierto)
create or replace function public.free_riders(p_league uuid)
returns table (id bigint, market_value bigint) language sql stable as $$
  select r.id, r.market_value from public.rider r
  where r.active and r.team_id is not null
    and not exists (select 1 from public.ownership o where o.league_id = p_league and o.rider_id = r.id)
    and not exists (select 1 from public.market_listing l
                    where l.league_id = p_league and l.rider_id = r.id and not l.resolved)
$$;

-- ---------------------------------------------------------------- valor de mercado
create or replace function public.value_from_points(p_points numeric, p_age numeric, p_round bigint default null)
returns bigint language sql stable as $$
  -- 30 puntos o menos = valor mínimo exacto (sin ajuste por edad)
  select case when coalesce(p_points, 0) <= vp.floor_points then vp.floor_value
         else greatest(vp.floor_value,
           (round(
              vp.floor_value * power(p_points / vp.floor_points, vp.exponent)
              * (1 + case when p_age is null then 0
                          else greatest(-vp.age_cap, least(vp.age_cap, vp.age_step * (vp.age_pivot - p_age))) end)
              / coalesce(p_round, vp.initial_round)) * coalesce(p_round, vp.initial_round))::bigint) end
  from public.value_params vp
$$;

-- Valores iniciales a partir de pcs_points_base. Calcula k para que el ancla (Pogačar) valga anchor_value.
create or replace function public.seed_initial_values() returns integer
language plpgsql as $$
declare
  vp public.value_params;
  p_anchor numeric;
  n integer;
  today date := (public.app_now() at time zone 'Europe/Madrid')::date;
begin
  select * into vp from public.value_params;
  select pcs_points_base into p_anchor from public.rider where pcs_slug = vp.anchor_slug;
  if p_anchor is null or p_anchor <= vp.floor_points then
    select max(pcs_points_base) into p_anchor from public.rider;      -- sin ancla: el mejor ciclista
  end if;
  if p_anchor > vp.floor_points then
    update public.value_params
       set exponent = ln(vp.anchor_value::numeric / vp.floor_value) / ln(p_anchor / vp.floor_points);
  end if;
  update public.rider r
     set market_value = public.value_from_points(r.pcs_points_base, public.age_at(r.birthdate)),
         updated_at = now();
  get diagnostics n = row_count;
  update public.rider set market_value = vp.anchor_value where pcs_slug = vp.anchor_slug;
  insert into public.rider_value_history (rider_id, day, value)
  select id, today, market_value from public.rider
  on conflict (rider_id, day) do update set value = excluded.value;
  return n;
end $$;

-- Actualización diaria: rendimiento (365 días) + hype (fichajes y clausulazos en todas las ligas)
create or replace function public.update_rider_values() returns integer
language plpgsql as $$
declare
  vp public.value_params;
  today date := (public.app_now() at time zone 'Europe/Madrid')::date;
  base_w numeric;
  n_leagues integer;
  n integer;
begin
  select * into vp from public.value_params;
  -- peso de los puntos PCS base: 1 antes de empezar el juego, baja a 0 en 365 días
  base_w := greatest(0, 1 - greatest(0, today - vp.game_start)::numeric / 365);
  select greatest(count(*), 1) into n_leagues from public.league;

  with pts as (
    select rs.rider_id, sum(rs.points) as p
    from public.rider_score rs join public.stage s on s.id = rs.stage_id
    where s.date > today - 365 and s.date <= today
    group by rs.rider_id
  ), hype as (
    select l.rider_id,
           sum(case l.kind when 'market_buy' then 1 when 'clause_paid' then 2 when 'sale_game' then -1 end)::numeric as h
    from public.ledger l
    where l.created_at > public.app_now() - interval '7 days'
      and l.kind in ('market_buy', 'clause_paid', 'sale_game') and l.rider_id is not null
    group by l.rider_id
  ), calc as (
    select r.id, r.market_value::numeric as v,
           public.value_from_points(coalesce(pts.p, 0) + r.pcs_points_base * base_w,
                                    public.age_at(r.birthdate, today), vp.daily_round)::numeric as target,
           greatest(-vp.hype_cap, least(vp.hype_cap, coalesce(hype.h, 0) / n_leagues * vp.hype_scale)) as hype_pct
    from public.rider r
    left join pts on pts.rider_id = r.id
    left join hype on hype.rider_id = r.id
    where r.active
  )
  update public.rider r
     set market_value = greatest(vp.floor_value,
           round((c.v + greatest(-vp.daily_cap * c.v,
                                 least(vp.daily_cap * c.v, vp.reversion * (c.target - c.v) + c.hype_pct * c.v)))
                 / vp.daily_round) * vp.daily_round)::bigint,
         updated_at = now()
  from calc c where c.id = r.id;
  get diagnostics n = row_count;

  insert into public.rider_value_history (rider_id, day, value)
  select id, today, market_value from public.rider where active
  on conflict (rider_id, day) do update set value = excluded.value;
  insert into public.job_state (key, last_day) values ('rider_values', today)
  on conflict (key) do update set last_day = excluded.last_day, updated_at = now();
  return n;
end $$;

-- ---------------------------------------------------------------- plantilla inicial
-- 16 ciclistas libres al azar que sumen ~4.000.000 € (±100.000). Intercambia ciclistas hasta acercarse.
create or replace function public.assign_initial_team(p_member uuid, p_count int default 16,
    p_target bigint default 4000000, p_tol bigint default 100000, p_cap bigint default 1500000)
returns void language plpgsql as $$
declare
  v_league uuid;
  picked bigint[];
  s bigint; x bigint; xv bigint; y bigint; yv bigint; desired bigint;
begin
  select league_id into v_league from public.league_member where id = p_member;
  select array_agg(f.id) into picked
  from (select f.id from public.free_riders(v_league) f where f.market_value <= p_cap order by random() limit p_count) f;
  if picked is null then return; end if;

  for i in 1..400 loop
    select sum(market_value) into s from public.rider where id = any (picked);
    exit when abs(s - p_target) <= p_tol;
    x := picked[1 + floor(random() * array_length(picked, 1))::int];
    select market_value into xv from public.rider where id = x;
    desired := xv + (p_target - s);
    select c.id, c.market_value into y, yv
    from (select f.id, f.market_value from public.free_riders(v_league) f
          where f.market_value <= p_cap and not (f.id = any (picked))
          order by abs(f.market_value - desired) limit 5) c
    order by random() limit 1;
    if y is not null and abs(s - xv + yv - p_target) < abs(s - p_target) then
      picked := array_replace(picked, x, y);
    end if;
  end loop;

  insert into public.ownership (league_id, rider_id, member_id, price_paid, clause, acquired_at, eligible_from)
  select v_league, r.id, p_member, r.market_value, round(r.market_value * 1.5), public.app_now(), public.app_now()
  from public.rider r where r.id = any (picked);
end $$;

-- Alta de un jugador: 8.000.000 € + 16 ciclistas
create or replace function public.add_member(p_league uuid, p_user uuid, p_team_name text)
returns uuid language plpgsql as $$
declare v_member uuid;
begin
  insert into public.league_member (league_id, user_id, team_name)
  values (p_league, p_user, p_team_name) returning id into v_member;
  perform public.post_ledger(v_member, 8000000, 'initial', null, 'Presupuesto inicial');
  perform public.assign_initial_team(v_member);
  return v_member;
end $$;

-- ---------------------------------------------------------------- mercado
create or replace function public.resolve_market(p_league uuid) returns void
language plpgsql as $$
declare
  lg public.league;
  l record; b record;
  v_now timestamptz := public.app_now();
  v_next timestamptz;
  won boolean;
begin
  select * into lg from public.league where id = p_league for update;

  -- 1. Cerrar subastas vencidas, empezando por las de puja más alta
  for l in
    select ml.* from public.market_listing ml
    where ml.league_id = p_league and not ml.resolved and ml.closes_at <= v_now
    order by (select max(amount) from public.bid where listing_id = ml.id) desc nulls last, ml.id
  loop
    won := false;
    for b in select * from public.bid where listing_id = l.id order by amount desc, placed_at asc loop
      if public.roster_count(b.member_id) < lg.max_riders and public.can_spend(b.member_id, b.amount, l.id) then
        perform public.post_ledger(b.member_id, -b.amount, 'market_buy', l.rider_id, 'Subasta del mercado');
        insert into public.ownership (league_id, rider_id, member_id, price_paid, clause, acquired_at, eligible_from)
        values (p_league, l.rider_id, b.member_id, b.amount, round(b.amount * 1.5), v_now, public.next_monday(v_now));
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

  -- 2. Ofertas del juego: caducan las anteriores y se hacen nuevas para lo que está a la venta
  update public.game_offer g set status = 'expired'
  from public.league_member m
  where g.member_id = m.id and m.league_id = p_league and g.status = 'open';
  insert into public.game_offer (ownership_id, member_id, rider_id, amount, created_at, expires_at)
  select o.id, o.member_id, o.rider_id, (round(r.market_value * (0.9 + random() * 0.2) / 1000) * 1000)::bigint,
         v_now, v_next
  from public.ownership o join public.rider r on r.id = o.rider_id
  where o.league_id = p_league and o.for_sale and o.pending_member_id is null;

  -- 3. Nuevos ciclistas al mercado
  insert into public.market_listing (league_id, rider_id, base_value, opened_at, closes_at)
  select p_league, f.id, f.market_value, v_now, v_next
  from public.free_riders(p_league) f order by random() limit lg.market_size;

  update public.league set next_market_at = v_next where id = p_league;
end $$;

-- ---------------------------------------------------------------- cambio de semana (lunes 00:00)
create or replace function public.rollover_league(p_league uuid, p_week date) returns void
language plpgsql as $$
declare
  lg public.league;
  prev date := p_week - 7;
  v_now timestamptz := public.app_now();
  r record;
  n_pos integer;
begin
  select * into lg from public.league where id = p_league for update;
  if exists (select 1 from public.week_run where league_id = p_league and week_start = p_week) then
    return;
  end if;
  n_pos := coalesce(array_length(lg.payout_by_position, 1), 0);

  -- 1. Pago de la semana anterior
  for r in
    with pts as (
      select m.id as member_id, coalesce(sum(ms.points), 0)::bigint as pts
      from public.league_member m
      left join public.member_score ms
             on ms.member_id = m.id
            and ms.stage_id in (select s.id from public.stage s where s.date >= prev and s.date < p_week)
      where m.league_id = p_league
      group by m.id
    )
    select member_id, pts, rank() over (order by pts desc) as rk from pts
  loop
    if lg.payout_mode in ('per_point', 'mixed') and r.pts > 0 and lg.payout_per_point > 0 then
      perform public.post_ledger(r.member_id, r.pts * lg.payout_per_point, 'payout_points', null,
                                 r.pts || ' puntos, semana del ' || to_char(prev, 'DD/MM'));
    end if;
    if lg.payout_mode in ('by_position', 'mixed') and r.pts > 0 and r.rk <= n_pos
       and lg.payout_by_position[r.rk] > 0 then
      perform public.post_ledger(r.member_id, lg.payout_by_position[r.rk], 'payout_position', null,
                                 r.rk || '.º de la semana del ' || to_char(prev, 'DD/MM'));
    end if;
  end loop;

  -- 2. Traspasos pendientes (clausulazos y ofertas aceptadas)
  update public.ownership
     set member_id = pending_member_id, price_paid = pending_price, clause = round(pending_price * 1.5),
         acquired_at = transfer_at, eligible_from = transfer_at,
         pending_member_id = null, pending_price = null, transfer_at = null, for_sale = false
   where league_id = p_league and pending_member_id is not null and transfer_at <= v_now;

  -- 3. Control de deuda: saldo negativo = sin puntos esta semana
  insert into public.member_week (member_id, week_start, eligible)
  select id, p_week, balance >= 0 from public.league_member where league_id = p_league
  on conflict (member_id, week_start) do update set eligible = excluded.eligible;

  insert into public.week_run (league_id, week_start) values (p_league, p_week);
end $$;

-- ---------------------------------------------------------------- puntuación
create or replace function public.score_stage(p_stage bigint) returns integer
language plpgsql as $$
declare
  s public.stage;
  rc public.race;
  is_last boolean;
  n integer;
begin
  select * into s from public.stage where id = p_stage;
  if not found then raise exception 'Etapa % no existe', p_stage; end if;
  select * into rc from public.race where id = s.race_id;
  is_last := s.number = (select max(number) from public.stage where race_id = s.race_id);

  delete from public.member_score where stage_id = p_stage;
  delete from public.rider_score where stage_id = p_stage;

  if not rc.is_stage_race then
    insert into public.rider_score (stage_id, rider_id, kind, points)
    select p_stage, r.rider_id, 'oneday', sr.points
    from public.result r
    join public.scoring_rule sr on sr.category = rc.category and sr.kind = 'oneday' and sr.position = r.position
    where r.stage_id = p_stage and r.kind = 'stage';
  else
    insert into public.rider_score (stage_id, rider_id, kind, points)
    select p_stage, r.rider_id, x.score_kind, sr.points
    from public.result r
    join (values ('stage', 'stage', false), ('kom_leader', 'kom_jersey', false),
                 ('gc', 'gc', true), ('points', 'points_final', true), ('kom', 'kom_final', true))
         as x(result_kind, score_kind, only_last) on x.result_kind = r.kind
    join public.scoring_rule sr on sr.category = rc.category and sr.kind = x.score_kind and sr.position = r.position
    where r.stage_id = p_stage and (not x.only_last or is_last);
  end if;
  get diagnostics n = row_count;

  -- Puntos de cada jugador: ciclistas inscritos, ligas cuya profundidad incluye la carrera,
  -- y solo si el jugador no está sancionado por deuda esa semana
  insert into public.member_score (league_id, member_id, stage_id, rider_id, points)
  select e.league_id, e.member_id, p_stage, rs.rider_id, sum(rs.points)
  from public.race_entry e
  join public.league lg on lg.id = e.league_id
  join public.race_category c on c.code = rc.category and c.depth_level <= lg.calendar_depth
  join public.race_entry_rider er on er.entry_id = e.id
  join public.rider_score rs on rs.rider_id = er.rider_id and rs.stage_id = p_stage
  left join public.member_week mw on mw.member_id = e.member_id
                                 and mw.week_start = date_trunc('week', s.date)::date
  where e.race_id = rc.id and coalesce(mw.eligible, true)
  group by e.league_id, e.member_id, rs.rider_id;

  update public.stage set status = 'scored', scored_at = public.app_now() where id = p_stage;
  return n;
end $$;

-- ---------------------------------------------------------------- alineación automática
-- Se lanza al empezar la carrera, con la lista de salida ya cargada.
create or replace function public.auto_lineup(p_race bigint) returns integer
language plpgsql as $$
declare
  rc public.race;
  cat public.race_category;
  m record;
  v_entry bigint;
  v_season integer;
  n integer := 0;
begin
  select * into rc from public.race where id = p_race for update;
  select * into cat from public.race_category where code = rc.category;
  v_season := extract(year from rc.start_date);

  for m in
    select lm.id as member_id, lm.league_id
    from public.league_member lm join public.league lg on lg.id = lm.league_id
    where cat.depth_level <= lg.calendar_depth
      and not exists (select 1 from public.race_entry e where e.race_id = p_race and e.member_id = lm.id)
  loop
    insert into public.race_entry (league_id, race_id, member_id, auto, updated_at)
    values (m.league_id, p_race, m.member_id, true, public.app_now())
    returning id into v_entry;

    insert into public.race_entry_rider (entry_id, rider_id)
    select v_entry, q.rider_id from (
      select o.rider_id
      from public.ownership o
      join public.startlist sl on sl.race_id = p_race and sl.rider_id = o.rider_id
      join public.rider r on r.id = o.rider_id
      left join public.rider_season_points sp on sp.rider_id = o.rider_id and sp.season = v_season
      where o.league_id = m.league_id and o.member_id = m.member_id
        and o.pending_member_id is null and o.eligible_from <= public.app_now()
      order by coalesce(sp.points, 0) desc, r.market_value desc, random()
      limit cat.max_entries
    ) q;
    n := n + 1;
  end loop;

  update public.race set auto_lineup_done = true where id = p_race;
  return n;
end $$;

-- ---------------------------------------------------------------- tarea cada minuto (pg_cron)
create or replace function public.run_due_jobs() returns void
language plpgsql as $$
declare
  l record;
  v_now timestamptz := public.app_now();
  v_week date := public.week_start(public.app_now());
  today date := (public.app_now() at time zone 'Europe/Madrid')::date;
begin
  -- Cambio de semana (una vez por liga y semana)
  for l in
    select lg.id from public.league lg
    where not exists (select 1 from public.week_run w where w.league_id = lg.id and w.week_start = v_week)
  loop
    perform public.rollover_league(l.id, v_week);
  end loop;

  -- Mercados que tocan
  for l in select id from public.league where next_market_at <= v_now order by next_market_at loop
    perform public.resolve_market(l.id);
  end loop;

  -- Ofertas entre jugadores caducadas
  update public.transfer_offer set status = 'expired' where status = 'open' and expires_at <= v_now;

  -- Valores de mercado, una vez al día desde las 05:00
  if extract(hour from v_now at time zone 'Europe/Madrid') >= 5
     and not exists (select 1 from public.job_state where key = 'rider_values' and last_day = today) then
    perform public.update_rider_values();
  end if;
end $$;
