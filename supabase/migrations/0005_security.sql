-- =====================================================================================
-- 0005 · Seguridad: RLS, permisos y alta automática del perfil
-- La app escribe SOLO a través de las RPC (security definer). Las tablas son de solo lectura
-- para los jugadores, y solo en lo que les toca. La ingesta usa el rol de servicio.
-- =====================================================================================

-- ---------------------------------------------------------------- perfil al registrarse
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profile (user_id, display_name, avatar_url)
  values (new.id,
          left(coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''),
                        split_part(coalesce(new.email, ''), '@', 1), 'Jugador'), 40),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array[
    'race_category','scoring_rule','category_rule','team','rider','rider_value_history','race','stage','startlist',
    'result','rider_score','value_params','job_state','profile','league','league_member','ledger','ownership',
    'market_listing','bid','game_offer','transfer_offer','race_entry','race_entry_rider','member_week',
    'member_score','week_run','app_admin']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Catálogo: lectura para cualquier usuario con sesión
do $$
declare t text;
begin
  foreach t in array array['race_category','scoring_rule','category_rule','team','rider','rider_value_history',
                           'race','stage','startlist','result','rider_score','value_params']
  loop
    execute format('create policy read_all on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;

create policy read_all on public.profile for select to authenticated using (true);
create policy update_own on public.profile for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy member_read on public.league for select to authenticated using (public.is_member(id));
create policy member_read on public.league_member for select to authenticated using (public.is_member(league_id));
create policy member_read on public.ownership for select to authenticated using (public.is_member(league_id));
create policy member_read on public.market_listing for select to authenticated using (public.is_member(league_id));
create policy member_read on public.member_score for select to authenticated using (public.is_member(league_id));

create policy own_read on public.ledger for select to authenticated
  using (member_id in (select id from public.league_member where user_id = auth.uid()));
create policy own_read on public.bid for select to authenticated
  using (member_id in (select id from public.league_member where user_id = auth.uid()));
create policy own_read on public.game_offer for select to authenticated
  using (member_id in (select id from public.league_member where user_id = auth.uid()));
create policy own_read on public.member_week for select to authenticated
  using (member_id in (select id from public.league_member where user_id = auth.uid()));
create policy own_read on public.transfer_offer for select to authenticated
  using (from_member_id in (select id from public.league_member where user_id = auth.uid())
      or to_member_id in (select id from public.league_member where user_id = auth.uid()));

-- Inscripciones: las mías siempre; las de los demás, cuando la inscripción ya ha cerrado
create policy entry_read on public.race_entry for select to authenticated using (
  member_id in (select id from public.league_member where user_id = auth.uid())
  or (public.is_member(league_id)
      and public.app_now() >= (select r.entries_close_at from public.race r where r.id = race_id)));
create policy entry_read on public.race_entry_rider for select to authenticated using (
  exists (select 1 from public.race_entry e where e.id = entry_id));   -- hereda la política de race_entry

-- ---------------------------------------------------------------- permisos
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
revoke select on public.job_state, public.week_run, public.app_admin from authenticated;
-- El saldo de los demás no se ve: league_member sin la columna balance (el mío llega por get_me)
revoke select on public.league_member from authenticated;
grant select (id, league_id, user_id, team_name, joined_at) on public.league_member to authenticated;
grant update (display_name, avatar_url) on public.profile to authenticated;

-- Funciones: nada ejecutable por defecto; solo las RPC de la app
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.app_now(), public.week_start(timestamptz), public.is_member(uuid),
  public.create_league(text, text, jsonb), public.join_league(text, text),
  public.update_league_settings(uuid, jsonb), public.regenerate_invite_code(uuid),
  public.rename_team(uuid, text), public.update_profile(text, text),
  public.place_bid(bigint, bigint), public.cancel_bid(bigint),
  public.raise_clause(bigint), public.pay_clause(bigint),
  public.set_for_sale(bigint, boolean), public.accept_game_offer(bigint),
  public.make_offer(bigint, bigint), public.cancel_offer(bigint), public.respond_offer(bigint, boolean),
  public.save_entry(uuid, bigint, bigint[]),
  public.my_leagues(), public.get_standings(uuid), public.get_me(uuid), public.get_roster(uuid, uuid),
  public.get_market(uuid), public.get_offers(uuid), public.get_calendar(uuid, date), public.get_today(uuid),
  public.get_stage_scores(uuid, bigint), public.get_race_detail(uuid, bigint), public.get_entry(uuid, bigint),
  public.is_app_admin(), public.admin_load_startlist(bigint, text[]), public.admin_load_results(bigint, text, text[])
to authenticated;

-- Las funciones nuevas que se creen después tampoco serán públicas por defecto
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
