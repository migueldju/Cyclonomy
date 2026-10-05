-- =====================================================================================
-- 0009 · Historial de resultados (temporadas anteriores al juego) y fotos de los ciclistas
-- =====================================================================================

-- Resultados de temporadas pasadas, solo para enseñarlos en la ficha del ciclista.
-- Van aparte de race/stage/result para no tocar el calendario, la puntuación de las ligas ni los valores.
create table if not exists public.rider_history_result (
  rider_id       bigint not null references public.rider(id) on delete cascade,
  season         smallint not null,
  race_slug      text not null,
  race_name      text not null,
  uci_class      text not null,
  category       text references public.race_category(code) on update cascade,
  is_stage_race  boolean not null,
  number         smallint not null,          -- etapa (0 = prólogo); clásica y clasificaciones finales = 1
  date           date not null,
  kind           text not null check (kind in ('stage','gc','points','kom')),
  position       smallint not null check (position >= 1),
  primary key (rider_id, season, race_slug, kind, number)
);
create index if not exists rider_history_result_rider on public.rider_history_result (rider_id, date desc);

alter table public.rider_history_result enable row level security;
drop policy if exists read_all on public.rider_history_result;
create policy read_all on public.rider_history_result for select to authenticated using (true);
revoke all on public.rider_history_result from anon, authenticated;
grant select on public.rider_history_result to authenticated;

-- Foto de Wikimedia Commons (vía Wikidata) y lo que exige su licencia: autor, licencia y enlace
alter table public.rider add column if not exists pcs_id integer;              -- id numérico de PCS (Wikidata P1663)
alter table public.rider add column if not exists photo_author text;
alter table public.rider add column if not exists photo_license text;
alter table public.rider add column if not exists photo_license_url text;
alter table public.rider add column if not exists photo_page_url text;     -- página del archivo en Commons

-- Ficha del ciclista: añade la foto y los resultados del historial (sin stage_id: no hay etapa del juego).
-- race_key agrupa los resultados por carrera; race_start/race_end dicen si sigue en marcha.
create or replace function public.get_rider(p_league uuid, p_rider bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me public.league_member := public.my_member(p_league);
  v_season integer := extract(year from public.app_now() at time zone 'Europe/Madrid');
  v_today date := (public.app_now() at time zone 'Europe/Madrid')::date;
begin
  if not exists (select 1 from public.rider where id = p_rider) then
    raise exception 'El ciclista no existe';
  end if;
  return jsonb_build_object(
    'rider', (select jsonb_build_object(
                'id', r.id, 'name', r.name, 'pro_team', t.name, 'nationality', r.nationality,
                'age', public.age_at(r.birthdate)::int, 'market_value', r.market_value,
                'season_points', coalesce((select sp.points from public.rider_season_points sp
                                           where sp.rider_id = r.id and sp.season = v_season), 0),
                'photo', case when r.photo_url is null then null else jsonb_build_object(
                           'url', r.photo_url, 'author', r.photo_author, 'license', r.photo_license,
                           'license_url', r.photo_license_url, 'page_url', r.photo_page_url) end)
              from public.rider r left join public.team t on t.id = r.team_id where r.id = p_rider),
    'owner', (select jsonb_build_object('member_id', m.id, 'team_name', m.team_name, 'is_mine', m.id = me.id,
                                        'clause', o.clause)
              from public.ownership o join public.league_member m on m.id = o.member_id
              where o.league_id = p_league and o.rider_id = p_rider),
    'values', coalesce((
      select jsonb_agg(jsonb_build_object('day', h.day, 'value', h.value) order by h.day)
      from public.rider_value_history h
      where h.rider_id = p_rider and h.day > v_today - 365), '[]'::jsonb),
    'results', coalesce((
      select jsonb_agg(jsonb_build_object(
               'stage_id', x.stage_id, 'race_key', x.race_key, 'race_start', x.race_start, 'race_end', x.race_end,
               'race_name', x.race_name, 'category', x.category,
               'is_stage_race', x.is_stage_race, 'number', x.number, 'date', x.date, 'kind', x.kind,
               'position', x.position, 'points', x.points)
             order by x.date desc, x.kind_order)
      from (
        -- resultados del juego
        (select s.id stage_id, 'g' || rc.id race_key, rc.start_date race_start, rc.end_date race_end, rc.name race_name, rc.category, rc.is_stage_race, s.number, s.date,
                res.kind, res.position,
                case res.kind when 'stage' then 0 when 'gc' then 1 when 'points' then 2 else 3 end kind_order,
                coalesce((select sum(rs.points)::int from public.rider_score rs
                          where rs.stage_id = s.id and rs.rider_id = p_rider
                            and rs.kind = case res.kind when 'stage' then (case when rc.is_stage_race then 'stage' else 'oneday' end)
                                                        when 'gc' then 'gc' when 'points' then 'points_final'
                                                        else 'kom_final' end), 0) points
         from public.result res
         join public.stage s on s.id = res.stage_id
         join public.race rc on rc.id = s.race_id
         where res.rider_id = p_rider
           and (res.kind = 'stage'
                or (rc.is_stage_race and res.kind in ('gc', 'points', 'kom')
                    and s.number = (select max(s2.number) from public.stage s2 where s2.race_id = rc.id))))
        union all
        -- historial: los puntos son los que daría la tabla de puntuación del juego
        (select null::bigint, 'h' || h.season || '-' || h.race_slug,
                min(h.date) over (partition by h.season, h.race_slug), max(h.date) over (partition by h.season, h.race_slug),
                h.race_name, h.category, h.is_stage_race, h.number, h.date, h.kind, h.position,
                case h.kind when 'stage' then 0 when 'gc' then 1 when 'points' then 2 else 3 end,
                coalesce((select sr.points from public.scoring_rule sr
                          where sr.category = h.category and sr.position = h.position
                            and sr.kind = case h.kind when 'stage' then (case when h.is_stage_race then 'stage' else 'oneday' end)
                                                      when 'gc' then 'gc' when 'points' then 'points_final'
                                                      else 'kom_final' end), 0)
         from public.rider_history_result h
         where h.rider_id = p_rider)
        order by 9 desc
        limit 600) x), '[]'::jsonb));
end $$;
