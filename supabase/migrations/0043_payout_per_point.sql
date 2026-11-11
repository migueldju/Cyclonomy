-- =====================================================================================
-- 0043 · Reparto de dinero: solo por puntos, 200 € por punto (cada lunes, por la semana anterior), igual para
--        todas las ligas. Fuera los premios por puesto semanal y el modo mixto.
-- =====================================================================================

alter table public.league alter column payout_mode set default 'per_point';
alter table public.league alter column payout_per_point set default 200;
alter table public.league alter column payout_by_position set default '{}';

-- lo fija para todas las ligas, también al crearlas o editarlas
create or replace function public.league_payout_trg() returns trigger
language plpgsql as $$
begin
  new.payout_mode := 'per_point';
  new.payout_per_point := 200;
  new.payout_by_position := '{}';
  return new;
end $$;
drop trigger if exists league_payout on public.league;
create trigger league_payout before insert or update on public.league
  for each row execute function public.league_payout_trg();

update public.league set payout_mode = 'per_point';
