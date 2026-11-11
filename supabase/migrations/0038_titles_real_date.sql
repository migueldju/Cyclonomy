-- =====================================================================================
-- 0038 · Maillots de campeón: los campeones vigentes hoy (fecha real), aunque el juego esté simulando una fecha
--        pasada.
-- =====================================================================================

create or replace function public.get_current_titles() returns jsonb
language sql stable security definer set search_path = public as $$
  with today as (select (now() at time zone 'Europe/Madrid')::date d),
  latest as (
    select distinct on (t.level, t.discipline, t.scope) t.*
    from public.rider_title t, today
    where t.date <= today.d
    order by t.level, t.discipline, t.scope, t.date desc
  )
  select coalesce(jsonb_agg(jsonb_build_object('rider_id', r.id, 'level', l.level, 'discipline', l.discipline,
                                               'scope', l.scope)
                            order by l.level desc, l.discipline), '[]'::jsonb)
  from latest l join public.rider r on r.pcs_slug = l.rider_slug
$$;
