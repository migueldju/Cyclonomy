-- PASO 2 de 2 · Fotos de perfil (Storage) y tareas programadas (pg_cron).
-- Ejecútalo después del paso 1, en otra consulta del SQL Editor.

-- =====================================================================================
-- 0006 · Piezas propias de Supabase: fotos de perfil (Storage) y tareas programadas (pg_cron).
-- (Los tests locales no ejecutan este archivo.)
-- =====================================================================================

-- Fotos de perfil: bucket público de lectura; cada usuario escribe solo en su carpeta <user_id>/
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars: subir la mía" on storage.objects;
drop policy if exists "avatars: cambiar la mía" on storage.objects;
drop policy if exists "avatars: borrar la mía" on storage.objects;
create policy "avatars: subir la mía" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: cambiar la mía" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: borrar la mía" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Tareas: cada minuto se comprueba qué toca (mercados, cambio de semana, ofertas, valores).
-- Toda la lógica de horarios está en run_due_jobs(), en hora de Madrid.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('fantasy-run-due-jobs', '* * * * *', $$select public.run_due_jobs()$$);
