-- PASO 0 (solo si el paso 1 falla con «already exists»): deja la base lista para repetir el paso 1.
-- Borra ÚNICAMENTE lo que crean los pasos 1 y 2 de Fantasy Ciclismo (tablas, tipos, funciones, el
-- trigger que crea perfiles, las políticas de fotos y la tarea programada). No toca los usuarios ni
-- nada propio de Supabase. Ojo: si ya hubiera ligas o jugadores creados, se borrarían.

drop trigger if exists on_auth_user_created on auth.users;
drop view if exists public.rider_season_points;

drop table if exists
  public.ingest_task, public.app_admin, public.week_run, public.member_score, public.member_week,
  public.race_entry_rider, public.race_entry, public.transfer_offer, public.game_offer, public.bid,
  public.market_listing, public.ownership, public.ledger, public.league_member, public.league, public.profile,
  public.job_state, public.value_params, public.rider_score, public.result, public.startlist, public.stage,
  public.race, public.rider_value_history, public.rider, public.team, public.category_rule,
  public.scoring_rule, public.race_category
  cascade;

drop type if exists public.payout_mode cascade;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array['accept_game_offer','add_member','admin_load_results','admin_load_startlist','age_at','app_now','assign_initial_team','auto_lineup','can_spend','cancel_bid','cancel_offer','classify_race','committed_bids','create_league','debt_limit','free_riders','gen_invite_code','get_calendar','get_entry','get_market','get_me','get_offers','get_race_detail','get_roster','get_stage_scores','get_standings','get_today','handle_new_user','is_app_admin','is_itt_name','is_member','join_league','make_offer','my_leagues','my_member','next_market_time','next_monday','pay_clause','place_bid','post_ledger','raise_clause','regenerate_invite_code','rename_team','require_admin','require_app_admin','resolve_market','respond_offer','rollover_league','roster_count','run_due_jobs','save_entry','score_stage','seed_initial_values','set_for_sale','team_value','update_league_settings','update_profile','update_rider_values','value_from_points','week_start'])
  loop
    execute 'drop function if exists ' || f.sig || ' cascade';
  end loop;
end $$;

-- Piezas del paso 2, si llegó a ejecutarse
do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists "avatars: subir la mía" on storage.objects;
    drop policy if exists "avatars: cambiar la mía" on storage.objects;
    drop policy if exists "avatars: borrar la mía" on storage.objects;
  end if;
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'fantasy-run-due-jobs';
  end if;
end $$;

select 'Base limpia: ejecuta ahora el paso 1' as estado;
