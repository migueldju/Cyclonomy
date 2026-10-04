-- =====================================================================================
-- 0007 · Cola de tareas de la ingesta (lecturas programadas de PCS). Solo la usa la ingesta.
-- =====================================================================================
create table public.ingest_task (
  id          bigserial primary key,
  kind        text not null check (kind in ('startlist', 'results', 'recheck')),
  race_id     bigint not null references public.race(id) on delete cascade,
  stage_id    bigint references public.stage(id) on delete cascade,
  due_at      timestamptz not null,
  attempts    integer not null default 0,
  max_attempts integer not null,
  retry_every interval not null,
  status      text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  last_error  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index ingest_task_pending_uq on public.ingest_task (kind, race_id, coalesce(stage_id, 0))
  where status = 'pending';
create index on public.ingest_task (status, due_at);
alter table public.ingest_task enable row level security;   -- sin políticas: invisible para la app
revoke all on public.ingest_task from anon, authenticated;
