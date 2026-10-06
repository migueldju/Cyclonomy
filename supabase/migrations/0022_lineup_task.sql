-- =====================================================================================
-- 0022 · Ingesta: la lista de salida se carga 1 h 30 min antes de la salida y las alineaciones automáticas se hacen en una tarea
--        aparte al cerrar la inscripción ('lineup')
-- =====================================================================================

alter table public.ingest_task drop constraint if exists ingest_task_kind_check;
alter table public.ingest_task add constraint ingest_task_kind_check
  check (kind in ('startlist', 'lineup', 'results', 'recheck'));
