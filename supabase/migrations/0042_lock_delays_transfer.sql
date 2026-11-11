-- =====================================================================================
-- 0042 · El blindaje ya no impide el clausulazo: lo retrasa. Si el ciclista está blindado la semana siguiente, se
--        queda con su dueño (y puntúa para él) esa semana y pasa al equipo del fichador el lunes de después.
-- =====================================================================================

create or replace function public.pay_clause(p_ownership bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.ownership;
  lg public.league;
  m public.league_member;
  madrid timestamp := public.app_now() at time zone 'Europe/Madrid';
  v_transfer timestamptz := public.next_monday();
begin
  select * into o from public.ownership where id = p_ownership for update;
  if not found then raise exception 'Ese ciclista ya no pertenece a ese jugador'; end if;
  m := public.my_member(o.league_id);
  select * into lg from public.league where id = o.league_id;
  if not lg.clauses_enabled then raise exception 'Los clausulazos están desactivados en esta liga'; end if;
  if extract(isodow from madrid) = 7 and extract(hour from madrid) >= 14 then
    raise exception 'Los clausulazos están cerrados los domingos de 14:00 a 24:00';
  end if;
  if o.member_id = m.id then raise exception 'Este ciclista ya es tuyo'; end if;
  if o.pending_member_id is not null then raise exception 'Este ciclista ya tiene un traspaso pendiente'; end if;
  if public.roster_count(m.id) >= lg.max_riders then
    raise exception 'No tienes hueco en la plantilla (máximo % ciclistas)', lg.max_riders;
  end if;
  if not public.can_spend(m.id, o.clause) then raise exception 'No tienes saldo suficiente para pagar la cláusula'; end if;

  -- blindado la semana que viene: se queda con su dueño esa semana y llega al fichador una semana más tarde
  if o.locked_week = public.week_start(v_transfer) then
    v_transfer := v_transfer + interval '7 days';
  end if;

  perform public.post_ledger(m.id, -o.clause, 'clause_paid', o.rider_id, 'Clausulazo');
  perform public.post_ledger(o.member_id, o.clause, 'clause_received', o.rider_id, 'Clausulazo recibido');
  update public.ownership
     set pending_member_id = m.id, pending_price = o.clause, transfer_at = v_transfer, for_sale = false
   where id = o.id;
  update public.game_offer set status = 'expired' where ownership_id = o.id and status = 'open';
  update public.transfer_offer set status = 'cancelled' where ownership_id = o.id and status = 'open';
end $$;

-- Ficha del ciclista: «blindado» = blindado la semana que viene (si se paga ahora su cláusula, el traspaso se retrasa)
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
                                        'locked', coalesce(o.locked_week = public.week_start(public.app_now()) + 7, false))
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
