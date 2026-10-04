-- Tests de la lógica de juego. Simulan una semana completa moviendo el reloj (app.now).
\set ON_ERROR_STOP 1
set client_min_messages = warning;

create temp table ctx (k text primary key, v text);
grant select on ctx to authenticated;
create function pg_temp.c(p text) returns text language sql as $$ select v from ctx where k = p $$;
create function pg_temp.put(p text, val text) returns void language sql as
  $$ insert into ctx values (p, val) on conflict (k) do update set v = excluded.v $$;
create function pg_temp.as_user(p text) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000' || p, false) $$;
create function pg_temp.member(p text) returns uuid language sql as $$
  select id from public.league_member where league_id = pg_temp.c('league')::uuid
    and user_id = ('00000000-0000-0000-0000-00000000000' || p)::uuid $$;
create function pg_temp.expect_error(p_sql text, p_like text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm not ilike p_like then
      raise exception 'Error inesperado: «%» (se esperaba %)', sqlerrm, p_like;
    end if;
    return;
  end;
  raise exception 'Se esperaba un error «%» en: %', p_like, p_sql;
end $$;

-- ============================================================ 1. Valores iniciales
do $$ begin
  assert (select market_value from rider where pcs_slug = 'tadej-pogacar') = 10000000, 'Pogačar = 10 M';
  assert (select market_value from rider where pcs_slug = 'rider-400') = 30000, '≤30 puntos = 30.000 €';
  assert (select bool_and(market_value >= 30000) from rider), 'nadie por debajo del mínimo';
  -- ajuste por edad: rider-60 (25 años) gana un 6 %: 1.472.000 × 1,06 → 1.560.000
  assert (select market_value from rider where pcs_slug = 'rider-60') = 1560000, 'ajuste por edad';
end $$;

-- ============================================================ 2. Crear liga y unirse
set app.now = '2027-03-01 10:00:00 Europe/Madrid';   -- lunes
select pg_temp.as_user('a');
select pg_temp.put('league', public.create_league('Liga de prueba', 'Equipo Ana',
  '{"max_riders": 20, "calendar_depth": 4, "market_size": 8, "market_hour": 8, "payout_mode": "mixed",
    "payout_per_point": 100, "payout_by_position": [500000, 250000]}')::text);
select pg_temp.as_user('b');
select public.join_league((select invite_code from league), 'Equipo Bruno');
select pg_temp.as_user('c');
select public.join_league(lower((select invite_code from league)), 'Equipo Carla');   -- el código no distingue mayúsculas

do $$
declare m record;
begin
  assert (select count(*) from league_member) = 3, '3 jugadores';
  for m in select * from league_member loop
    assert m.balance = 8000000, 'saldo inicial 8 M';
    assert public.roster_count(m.id) = 16, '16 ciclistas iniciales';
    assert public.team_value(m.id) between 3900000 and 4100000,
      format('plantilla inicial ~4 M (es %s)', public.team_value(m.id));
  end loop;
  assert (select count(*) from market_listing where not resolved) = 8, '8 ciclistas en el mercado';
  assert (select next_market_at from league) = '2027-03-02 08:00 Europe/Madrid'::timestamptz, 'mercado mañana a las 08:00';
  assert (select count(*) from profile) = 4 and (select display_name from profile
          where user_id = '00000000-0000-0000-0000-00000000000a') = 'Ana', 'perfil creado al registrarse';
end $$;

-- ============================================================ 3. Pujas
-- el ciclista más caro del mercado
select pg_temp.put('listing', (select id from market_listing where not resolved order by base_value desc limit 1)::text);
select pg_temp.put('listing_rider', (select rider_id from market_listing where id = pg_temp.c('listing')::bigint)::text);
select pg_temp.put('base', (select base_value from market_listing where id = pg_temp.c('listing')::bigint)::text);

select pg_temp.as_user('a');
select pg_temp.expect_error(format('select public.place_bid(%s, %s)', pg_temp.c('listing'), pg_temp.c('base')::bigint - 1),
                            '%puja mínima%');
select pg_temp.expect_error(format('select public.place_bid(%s, 99000000)', pg_temp.c('listing')), '%saldo suficiente%');
select pg_temp.as_user('b');
select public.place_bid(pg_temp.c('listing')::bigint, pg_temp.c('base')::bigint + 100000);   -- Bruno puja primero
select pg_temp.as_user('c');
select public.place_bid(pg_temp.c('listing')::bigint, pg_temp.c('base')::bigint + 100000);   -- Carla empata después
select pg_temp.as_user('a');
select public.place_bid(pg_temp.c('listing')::bigint, pg_temp.c('base')::bigint);            -- Ana puja menos

do $$ begin
  -- la puja de Bruno compromete dinero
  assert public.committed_bids(pg_temp.member('b')) = pg_temp.c('base')::bigint + 100000, 'pujas comprometidas';
  -- el mercado no muestra cuánto pujan los demás, solo cuántos
  perform pg_temp.as_user('a');
  assert (select bid_count from public.get_market(pg_temp.c('league')::uuid) where listing_id = pg_temp.c('listing')::bigint) = 3;
  assert (select my_bid from public.get_market(pg_temp.c('league')::uuid) where listing_id = pg_temp.c('listing')::bigint)
         = pg_temp.c('base')::bigint, 'veo mi puja';
end $$;

-- ============================================================ 4. Cierre del mercado (martes 08:00)
set app.now = '2027-03-02 08:00:30 Europe/Madrid';
select public.run_due_jobs();
do $$
declare o ownership;
begin
  select * into o from ownership where league_id = pg_temp.c('league')::uuid and rider_id = pg_temp.c('listing_rider')::bigint;
  assert o.member_id = pg_temp.member('b'), 'gana Bruno: empate resuelto por quien pujó antes';
  assert o.price_paid = pg_temp.c('base')::bigint + 100000;
  assert o.clause = round(o.price_paid * 1.5), 'cláusula al 150 %';
  assert o.eligible_from = '2027-03-08 00:00 Europe/Madrid'::timestamptz, 'inscribible desde el lunes';
  assert (select balance from league_member where id = pg_temp.member('b')) = 8000000 - o.price_paid, 'Bruno paga';
  assert (select balance from league_member where id = pg_temp.member('c')) = 8000000, 'Carla no paga nada';
  assert (select count(*) from market_listing where not resolved) = 8, 'salen 8 nuevos';
  assert (select next_market_at from league) = '2027-03-03 08:00 Europe/Madrid'::timestamptz;
  perform pg_temp.as_user('b');
  assert (select status from public.get_roster(pg_temp.c('league')::uuid) where rider_id = pg_temp.c('listing_rider')::bigint)
         = 'incoming', 'punto naranja';
end $$;

-- No se puede inscribir un fichaje hasta el lunes
select pg_temp.as_user('b');
select pg_temp.expect_error(format('select public.save_entry(%L, 1, array[%s])', pg_temp.c('league'), pg_temp.c('listing_rider')),
                            '%punto naranja%');

-- ============================================================ 5. Inscripción y subida de cláusula (miércoles)
set app.now = '2027-03-03 09:00:00 Europe/Madrid';
select pg_temp.as_user('a');
-- Ana inscribe sus 7 ciclistas más caros en la Strade (máximo 7 en WT)
select pg_temp.put('ana_top', (select string_agg(rider_id::text, ',') from (
  select o.rider_id from ownership o join rider r on r.id = o.rider_id
  where o.member_id = pg_temp.member('a') order by r.market_value desc limit 8) x));
select pg_temp.expect_error(format('select public.save_entry(%L, 1, array[%s])', pg_temp.c('league'), pg_temp.c('ana_top')),
                            '%como máximo 7%');
select public.save_entry(pg_temp.c('league')::uuid, 1,
  (select array_agg(x::bigint) from unnest(string_to_array(pg_temp.c('ana_top'), ',')) with ordinality t(x, n) where n <= 7));
select pg_temp.put('star', split_part(pg_temp.c('ana_top'), ',', 1));      -- el mejor ciclista de Ana
select pg_temp.put('star_own', (select id from ownership where rider_id = pg_temp.c('star')::bigint
                                and league_id = pg_temp.c('league')::uuid)::text);

do $$
declare o ownership; b0 bigint; c1 bigint; c2 bigint;
begin
  select * into o from ownership where id = pg_temp.c('star_own')::bigint;
  b0 := (select balance from league_member where id = pg_temp.member('a'));
  c1 := public.raise_clause(o.id);
  assert c1 = round(o.clause * 1.5), 'primera subida: +50 %';
  assert (select balance from league_member where id = pg_temp.member('a')) = b0 - ceil((c1 - o.clause) / 2.0), 'paga la mitad';
  c2 := public.raise_clause(o.id);
  assert c2 = o.price_paid * 3, 'segunda subida: tope del 300 %';
  perform pg_temp.expect_error(format('select public.raise_clause(%s)', o.id), '%máximo%');
end $$;

-- ============================================================ 6. Clausulazo (Carla roba la estrella de Ana)
select pg_temp.as_user('c');
do $$
declare ana0 bigint := (select balance from league_member where id = pg_temp.member('a'));
        carla0 bigint := (select balance from league_member where id = pg_temp.member('c'));
        cl bigint := (select clause from ownership where id = pg_temp.c('star_own')::bigint);
begin
  -- la cláusula (3 × precio) puede superar lo que Carla puede gastar; si es así le damos dinero para el test
  if not public.can_spend(pg_temp.member('c'), cl) then
    perform public.post_ledger(pg_temp.member('c'), cl, 'adjustment', null, 'test');
    carla0 := carla0 + cl;
  end if;
  perform public.pay_clause(pg_temp.c('star_own')::bigint);
  assert (select pending_member_id from ownership where id = pg_temp.c('star_own')::bigint) = pg_temp.member('c');
  assert (select balance from league_member where id = pg_temp.member('a')) = ana0 + cl, 'Ana cobra la cláusula';
  assert (select balance from league_member where id = pg_temp.member('c')) = carla0 - cl, 'Carla la paga';
  perform pg_temp.as_user('a');
  assert (select status from public.get_roster(pg_temp.c('league')::uuid) where ownership_id = pg_temp.c('star_own')::bigint)
         = 'leaving', 'punto rojo para Ana';
  perform pg_temp.as_user('c');
  assert (select status from public.get_roster(pg_temp.c('league')::uuid) where ownership_id = pg_temp.c('star_own')::bigint)
         = 'incoming', 'punto naranja para Carla';
  assert public.roster_count(pg_temp.member('a')) = 15 and public.roster_count(pg_temp.member('c')) = 17;
  -- nadie puede volver a pagar su cláusula mientras el traspaso está pendiente
  perform pg_temp.as_user('b');
  perform pg_temp.expect_error(format('select public.pay_clause(%s)', pg_temp.c('star_own')), '%traspaso pendiente%');
end $$;
-- Ana ya no puede inscribirlo en carreras nuevas
select pg_temp.as_user('a');
select pg_temp.expect_error(format('select public.save_entry(%L, 2, array[%s])', pg_temp.c('league'), pg_temp.c('star')),
                            '%punto naranja ni rojo%');

-- ============================================================ 7. Oferta entre jugadores y venta al juego
select pg_temp.as_user('b');
select pg_temp.put('ana_second_own', (select id from ownership where member_id = pg_temp.member('a')
   and pending_member_id is null order by price_paid desc limit 1)::text);
select pg_temp.put('offer', public.make_offer(pg_temp.c('ana_second_own')::bigint, 50000)::text);
select pg_temp.as_user('c');
select pg_temp.expect_error(format('select public.respond_offer(%s, true)', pg_temp.c('offer')), '%no es para ti%');
select pg_temp.as_user('a');
select public.respond_offer(pg_temp.c('offer')::bigint, true);
do $$ begin
  assert (select pending_member_id from ownership where id = pg_temp.c('ana_second_own')::bigint) = pg_temp.member('b');
  assert (select status from transfer_offer where id = pg_temp.c('offer')::bigint) = 'accepted';
end $$;

-- Ana pone a la venta su ciclista más barato; el juego ofrece al día siguiente
select pg_temp.put('cheap_own', (select o.id from ownership o join rider r on r.id = o.rider_id
   where o.member_id = pg_temp.member('a') and o.pending_member_id is null order by r.market_value limit 1)::text);
select public.set_for_sale(pg_temp.c('cheap_own')::bigint, true);
set app.now = '2027-03-04 08:00:10 Europe/Madrid';
select public.run_due_jobs();
do $$
declare g game_offer; v bigint; b0 bigint;
begin
  select * into g from game_offer where ownership_id = pg_temp.c('cheap_own')::bigint and status = 'open';
  assert found, 'el juego hace una oferta';
  v := (select r.market_value from rider r join ownership o on o.rider_id = r.id where o.id = pg_temp.c('cheap_own')::bigint);
  assert g.amount between round(v * 0.9 / 1000) * 1000 and round(v * 1.1 / 1000) * 1000, 'oferta ±10 %';
  perform pg_temp.as_user('a');
  b0 := (select balance from league_member where id = pg_temp.member('a'));
  perform public.accept_game_offer(g.id);
  assert (select balance from league_member where id = pg_temp.member('a')) = b0 + g.amount;
  assert not exists (select 1 from ownership where id = pg_temp.c('cheap_own')::bigint), 'el ciclista queda libre';
end $$;

-- ============================================================ 8. Domingo noche: clausulazos bloqueados
set app.now = '2027-03-07 21:30:00 Europe/Madrid';
select pg_temp.as_user('b');
select pg_temp.expect_error(format('select public.pay_clause(%s)',
  (select id from ownership where member_id = pg_temp.member('a') and pending_member_id is null limit 1)),
  '%bloqueados los domingos%');

-- ============================================================ 9. Carreras: alineación automática y puntos
set app.now = '2027-03-06 11:00:00 Europe/Madrid';   -- sábado: sale la Strade
select pg_temp.as_user('b');
select pg_temp.expect_error(format('select public.save_entry(%L, 1, array[]::bigint[])', pg_temp.c('league')),
                            '%ya está cerrada%');
-- Lista de salida: todos los ciclistas de Ana, Bruno y Carla, más otros
insert into startlist (race_id, rider_id) select 1, id from rider where id <= 400 on conflict do nothing;
select public.auto_lineup(1);
do $$ begin
  assert (select auto from race_entry where race_id = 1 and member_id = pg_temp.member('a')) = false, 'Ana ya tenía inscripción';
  assert (select auto from race_entry where race_id = 1 and member_id = pg_temp.member('b')), 'Bruno: alineación automática';
  -- Bruno: 7 ciclistas (sin el fichaje naranja)
  assert (select count(*) from race_entry e join race_entry_rider er on er.entry_id = e.id
          where e.race_id = 1 and e.member_id = pg_temp.member('b')) = 7, '7 inscritos automáticamente';
  assert not exists (select 1 from race_entry e join race_entry_rider er on er.entry_id = e.id
          where e.race_id = 1 and e.member_id = pg_temp.member('b') and er.rider_id = pg_temp.c('listing_rider')::bigint),
         'el fichaje naranja no se alinea';
  -- a igualdad de puntos de temporada (0), elige por valor de mercado
  assert (select min(r.market_value) from race_entry e join race_entry_rider er on er.entry_id = e.id join rider r on r.id = er.rider_id
          where e.race_id = 1 and e.member_id = pg_temp.member('b'))
      >= (select max(r.market_value) from ownership o join rider r on r.id = o.rider_id
          where o.member_id = pg_temp.member('b') and o.eligible_from <= public.app_now()
            and o.rider_id not in (select er.rider_id from race_entry e join race_entry_rider er on er.entry_id = e.id
                                   where e.race_id = 1 and e.member_id = pg_temp.member('b'))),
         'elige los de más valor';
end $$;

-- Resultado: gana la estrella que Ana inscribió (ya robada por Carla); 2.º un ciclista de Bruno
set app.now = '2027-03-06 17:30:00 Europe/Madrid';
insert into result (stage_id, kind, rider_id, position) values
  (1, 'stage', pg_temp.c('star')::bigint, 1),
  (1, 'stage', (select er.rider_id from race_entry e join race_entry_rider er on er.entry_id = e.id
                where e.race_id = 1 and e.member_id = pg_temp.member('b') limit 1), 2),
  (1, 'stage', 400, 3);
select public.score_stage(1);
do $$ begin
  assert (select points from rider_score where stage_id = 1 and rider_id = pg_temp.c('star')::bigint) = 225, 'WT principal: 225 al ganador';
  assert (select sum(points) from member_score where stage_id = 1 and member_id = pg_temp.member('a')) = 225,
         'el robado sigue puntuando para Ana en la carrera en la que ya estaba inscrito';
  assert (select sum(points) from member_score where stage_id = 1 and member_id = pg_temp.member('b')) = 171, '2.º = 171';
  assert (select coalesce(sum(points), 0) from member_score where stage_id = 1 and member_id = pg_temp.member('c')) = 0;
  perform pg_temp.as_user('a');
  assert (select pos from public.get_standings(pg_temp.c('league')::uuid) where member_id = pg_temp.member('a')) = 1;
  assert (public.get_me(pg_temp.c('league')::uuid)->>'position')::int = 1;
end $$;

-- Giro (2 etapas): maillot de la montaña por día y general final
select public.auto_lineup(2);
insert into result (stage_id, kind, rider_id, position) values
  (2, 'stage', 100, 1), (2, 'kom_leader', 101, 1), (2, 'gc', 100, 1),
  (3, 'stage', 102, 1), (3, 'kom_leader', 101, 1), (3, 'gc', 100, 1), (3, 'kom', 101, 1), (3, 'points', 102, 1);
select public.score_stage(2);
select public.score_stage(3);
do $$ begin
  assert (select sum(points) from rider_score where stage_id = 2 and rider_id = 100) = 80, 'etapa GT: 80 (la general solo puntúa al final)';
  assert (select sum(points) from rider_score where stage_id = 2 and rider_id = 101) = 8, 'maillot de la montaña: 8 por día';
  assert (select sum(points) from rider_score where stage_id = 3 and rider_id = 100) = 400, 'general final GT: 400';
  assert (select sum(points) from rider_score where stage_id = 3 and rider_id = 101) = 8 + 80, 'montaña final + maillot';
  assert (select sum(points) from rider_score where stage_id = 3 and rider_id = 102) = 80 + 80, 'etapa + puntos final';
  -- recalcular no duplica
  perform public.score_stage(3);
  assert (select sum(points) from rider_score where stage_id = 3) = 400 + 88 + 160;
end $$;

-- ============================================================ 10. Cambio de semana (lunes 00:00)
-- Bruno se queda en negativo el domingo → sancionado la semana siguiente
set app.now = '2027-03-07 20:00:00 Europe/Madrid';
select public.post_ledger(pg_temp.member('b'), -((select balance from league_member where id = pg_temp.member('b')) + 999999),
                          'adjustment', null, 'test: deuda');
set app.now = '2027-03-08 00:00:30 Europe/Madrid';
select pg_temp.put('ana_before', (select balance from league_member where id = pg_temp.member('a'))::text);
select pg_temp.put('ana_week_pts', (select sum(ms.points) from member_score ms join stage s on s.id = ms.stage_id
   where ms.member_id = pg_temp.member('a') and s.date between '2027-03-01' and '2027-03-07')::text);
select pg_temp.put('ana_rank', (select pos from public.get_standings(pg_temp.c('league')::uuid)
   where member_id = pg_temp.member('a'))::text);
select public.run_due_jobs();
do $$
declare expected bigint;
begin
  expected := pg_temp.c('ana_before')::bigint + pg_temp.c('ana_week_pts')::bigint * 100
              + case pg_temp.c('ana_rank')::int when 1 then 500000 when 2 then 250000 else 0 end;
  assert (select balance from league_member where id = pg_temp.member('a')) = expected,
         format('pago mixto: puntos × 100 + premio por puesto (esperado %s)', expected);
  assert (select member_id from ownership where id = pg_temp.c('star_own')::bigint) = pg_temp.member('c'), 'traspaso aplicado';
  assert (select pending_member_id from ownership where id = pg_temp.c('star_own')::bigint) is null;
  assert (select clause from ownership where id = pg_temp.c('star_own')::bigint)
       = round((select price_paid from ownership where id = pg_temp.c('star_own')::bigint) * 1.5), 'nueva cláusula 150 %';
  assert (select eligible from member_week where member_id = pg_temp.member('b') and week_start = '2027-03-08') = false,
         'Bruno sancionado por deuda';
  assert (select eligible from member_week where member_id = pg_temp.member('a') and week_start = '2027-03-08');
  -- no se repite si se vuelve a ejecutar
  perform public.run_due_jobs();
  assert (select count(*) from week_run where week_start = '2027-03-08') = 1;
end $$;

-- Carla ya puede inscribir a la estrella; Bruno, sancionado, no puntúa
set app.now = '2027-03-08 10:00:00 Europe/Madrid';
select pg_temp.as_user('c');
select public.save_entry(pg_temp.c('league')::uuid, 3, array[pg_temp.c('star')::bigint]);
select pg_temp.as_user('b');
select public.save_entry(pg_temp.c('league')::uuid, 3, array[pg_temp.c('listing_rider')::bigint]);   -- ya no es naranja
set app.now = '2027-03-09 18:00:00 Europe/Madrid';
insert into result (stage_id, kind, rider_id, position) values
  (4, 'stage', pg_temp.c('star')::bigint, 1), (4, 'stage', pg_temp.c('listing_rider')::bigint, 2);
select public.score_stage(4);
do $$ begin
  assert (select sum(points) from member_score where stage_id = 4 and member_id = pg_temp.member('c')) = 75, '.1: 75 al ganador';
  assert not exists (select 1 from member_score where stage_id = 4 and member_id = pg_temp.member('b')), 'sancionado: 0 puntos';
end $$;

-- ============================================================ 11. Valores diarios (05:00)
set app.now = '2027-03-10 05:01:00 Europe/Madrid';
create temp table v0 as select id, market_value from rider;
select public.run_due_jobs();
do $$ begin
  assert (select last_day from job_state where key = 'rider_values') = '2027-03-10';
  assert (select bool_and(abs(r.market_value - v0.market_value) <= v0.market_value * 0.05 + 1000)
          from rider r join v0 using (id)), 'cambio diario como mucho ±5 %';
  assert (select count(*) from rider_value_history where day = '2027-03-10') = 400, 'histórico del día';
end $$;

-- ============================================================ 12. Permisos desde la app (rol authenticated)
select pg_temp.as_user('a');
set role authenticated;
select pg_temp.expect_error('select public.resolve_market(null)', '%permission denied%');
select pg_temp.expect_error('select public.post_ledger(null, 1, ''adjustment'')', '%permission denied%');
select pg_temp.expect_error('select balance from public.league_member', '%permission denied%');
select pg_temp.expect_error('update public.league set max_riders = 60', '%permission denied%');
reset role;
-- sin permiso de tabla de por medio: RLS de pujas (solo las mías)
do $$ begin
  perform pg_temp.as_user('a');
end $$;
set role authenticated;
do $$ begin
  assert (select count(*) from public.league_member) = 3, 'veo a los jugadores de mi liga';
  assert (public.get_me((select id from public.league limit 1))->>'balance') is not null, 'mi saldo, por get_me';
end $$;
reset role;
select pg_temp.as_user('d');   -- no pertenece a la liga
set role authenticated;
do $$ begin
  assert (select count(*) from public.league) = 0, 'quien no es miembro no ve la liga';
end $$;
select pg_temp.expect_error(format('select public.get_me(%L)', pg_temp.c('league')), '%No perteneces%');
reset role;


-- ============================================================ 13. Lecturas de la app y ajustes (humo)
select pg_temp.as_user('a');
set role authenticated;
do $$
declare lg uuid := (select id from public.league limit 1); j jsonb; n int;
begin
  assert (select count(*) from public.my_leagues()) = 1;
  assert (select count(*) from public.get_standings(lg)) = 3;
  assert (select count(*) from public.get_roster(lg)) > 0;
  assert (select coalesce(bool_and(not transferable), true) from public.get_roster(lg) where status = 'leaving');
  assert (select bool_and(transferable) from public.get_roster(lg, (select id from public.league_member where team_name = 'Equipo Bruno')) where status = 'ok');
  assert not public.is_app_admin();
  assert (select count(*) from public.get_roster(lg, (select id from public.league_member where team_name = 'Equipo Bruno'))) > 0;
  assert (select count(*) from public.get_market(lg)) = 8;
  perform * from public.get_offers(lg);
  assert (select count(*) from public.get_calendar(lg, '2027-01-01')) = 3;
  assert (select status from public.get_calendar(lg, '2027-01-01') where race_id = 1) = 'finished';
  perform * from public.get_today(lg);
  j := public.get_stage_scores(lg, 1);
  assert jsonb_array_length(j->'riders') = 3 and jsonb_array_length(j->'members') = 2, 'puntos de la etapa';
  j := public.get_race_detail(lg, 2);
  assert jsonb_array_length(j->'stages') = 2 and (j->'gc'->0->>'rider_id')::int = 100, 'detalle de la carrera';
  j := public.get_entry(lg, 3);
  assert (j->>'max_entries')::int = 6 and jsonb_array_length(j->'riders') > 0, 'pantalla de inscripción';
  -- inscripciones de los demás visibles solo tras el cierre
  assert (select count(*) from public.race_entry where race_id = 1) = 3;
end $$;
reset role;

set app.now = '2027-03-10 09:00:00 Europe/Madrid';
select public.run_due_jobs();
select pg_temp.as_user('a');
do $$
declare lg uuid := pg_temp.c('league')::uuid; l bigint; o bigint;
begin
  -- pujar y retirar
  l := (select listing_id from public.get_market(lg) order by base_value limit 1);
  perform public.place_bid(l, (select base_value from market_listing where id = l));
  perform public.cancel_bid(l);
  assert not exists (select 1 from bid where listing_id = l);
  -- ofertar y retirar
  o := (select id from ownership where member_id = pg_temp.member('c') and pending_member_id is null limit 1);
  perform public.cancel_offer(public.make_offer(o, 1000));
  -- ajustes de la liga
  perform public.update_league_settings(lg, '{"market_hour": 20, "clauses_enabled": false, "payout_by_position": []}');
  assert (select next_market_at from league) = '2027-03-10 20:00 Europe/Madrid'::timestamptz, 'nueva hora de mercado';
  assert (select bool_and(closes_at = '2027-03-10 20:00 Europe/Madrid'::timestamptz) from market_listing where not resolved);
  assert (select payout_by_position from league) = '{}'::bigint[];
  perform pg_temp.expect_error(format('select public.update_league_settings(%L, %L)', lg, '{"max_riders": 16}'),
                               '%plantilla más grande%');
  perform pg_temp.as_user('c');
  perform pg_temp.expect_error(format('select public.pay_clause(%s)',
    (select id from ownership where member_id = pg_temp.member('a') and pending_member_id is null limit 1)), '%desactivados%');
  perform pg_temp.expect_error(format('select public.update_league_settings(%L, %L)', lg, '{"market_size": 5}'),
                               '%Solo el administrador%');
  perform pg_temp.as_user('a');
  assert length(public.regenerate_invite_code(lg)) = 6;
  perform public.rename_team(lg, 'Ana Racing');
  perform public.update_profile('Ana G.', 'https://example.com/a.png');
  assert (select display_name from profile where user_id = auth.uid()) = 'Ana G.';
  -- carga manual (plan B): solo administradores de la app
  perform pg_temp.expect_error('select public.admin_load_results(4, ''stage'', array[''rider-2''])', '%administradores de la app%');
  perform pg_temp.as_user('d');
  assert public.admin_load_results(4, 'stage', array['rider-5', 'rider-6']) = 2;
  assert (select count(*) from rider_score where stage_id = 4) = 2;
  assert public.admin_load_startlist(3, array['rider-5', 'rider-6', 'no-existe']) = 2;
end $$;

\echo 'Tests de juego: OK'
