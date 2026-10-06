-- =====================================================================================
-- 0021 · Fuera del juego: los relevos mixtos y los campeonatos continentales que no sean el europeo
-- =====================================================================================

create or replace function public.is_excluded_race(p_slug text, p_name text, p_uci_class text) returns boolean
language sql immutable as $$
  select (lower(p_slug) || ' ' || lower(p_name)) ~ '(mixed|relay|relevo|staffetta)'
      or (upper(p_uci_class) = 'CC' and (lower(p_slug) || ' ' || lower(p_name)) !~ '(europe|uec)')
$$;

create or replace function public.classify_race(p_slug text, p_name text, p_uci_class text)
returns text language sql stable as $$
  select r.category
  from public.category_rule r
  where upper(p_uci_class) = any (r.uci_classes)
    and (r.pattern is null or (lower(p_slug) || ' ' || lower(p_name)) ~ r.pattern)
    and (r.itt is null or r.itt = public.is_itt_name(p_slug || ' ' || p_name))
    and not public.is_excluded_race(p_slug, p_name, p_uci_class)
  order by r.priority
  limit 1
$$;

-- Las que ya estaban cargadas (etapas, inscripciones, resultados y puntos se borran en cascada)
delete from public.race where public.is_excluded_race(pcs_slug, name, uci_class);
delete from public.rider_history_result where public.is_excluded_race(race_slug, race_name, uci_class);
