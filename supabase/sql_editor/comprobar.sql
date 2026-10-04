-- ¿En qué estado está la base? Pégalo en el SQL Editor y pulsa Run.
select case
  when to_regclass('public.ingest_task') is null or to_regclass('public.scoring_rule') is null
    then 'Paso 1 incompleto: ejecuta paso0_reiniciar.sql y después paso1_esquema_y_datos.sql'
  when (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.scoring_rule', false, true, '')))[1]::text::int = 383
   and exists (select 1 from pg_proc where proname = 'admin_load_results')
    then 'Paso 1 completo: pasa al paso 2'
  else 'Faltan datos o funciones: ejecuta paso0_reiniciar.sql y después paso1_esquema_y_datos.sql'
end as estado;
