alter table public.tasks add column if not exists idempotency_key text;
alter table public.tasks add column if not exists recovery_locked_at timestamptz;
alter table public.tasks add column if not exists recovery_worker_id text;
alter table public.assets add column if not exists source_task_id uuid references public.tasks(id) on delete set null;

create unique index if not exists tasks_user_idempotency_unique
  on public.tasks(user_id, idempotency_key) where idempotency_key is not null;
create unique index if not exists result_assets_task_unique
  on public.assets(source_task_id) where asset_type = 'result_video' and source_task_id is not null;
create index if not exists tasks_recovery_lease_idx
  on public.tasks(status, recovery_locked_at) where status in ('created','queued','analyzing','generating');

update public.assets a set source_task_id = t.id
from public.tasks t
where a.id::text = t.output_data->>'assetId'
  and a.asset_type = 'result_video'
  and a.source_task_id is null;

create table if not exists public.system_logs (
  log_id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  level text not null check (level in ('debug','info','warn','error')),
  request_id text,
  user_id uuid references auth.users(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  external_task_id text,
  skill_name text,
  model_name text,
  action text not null,
  duration_ms integer,
  status text,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists system_logs_timestamp_idx on public.system_logs(timestamp desc);
create index if not exists system_logs_level_timestamp_idx on public.system_logs(level, timestamp desc);
create index if not exists system_logs_request_idx on public.system_logs(request_id) where request_id is not null;
create index if not exists system_logs_task_idx on public.system_logs(task_id, timestamp desc) where task_id is not null;

create table if not exists public.worker_status (
  worker_name text primary key,
  worker_id text,
  status text not null default 'idle',
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_heartbeat_at timestamptz,
  recovered_count integer not null default 0,
  failed_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.storage_audits (
  id uuid primary key default gen_random_uuid(),
  audit_type text not null check (audit_type in ('missing_file','orphan_file','cleanup_failed')),
  asset_id uuid references public.assets(id) on delete set null,
  storage_path text not null,
  status text not null default 'open' check (status in ('open','resolved','ignored')),
  details jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists storage_audits_status_idx on public.storage_audits(status, detected_at desc);
create unique index if not exists storage_audits_open_unique on public.storage_audits(audit_type, storage_path) where status='open';

alter table public.system_logs enable row level security;
alter table public.worker_status enable row level security;
alter table public.storage_audits enable row level security;
revoke all on public.system_logs, public.worker_status, public.storage_audits from anon, authenticated;
grant select, insert, update, delete on public.system_logs, public.worker_status, public.storage_audits to service_role;
grant select, update on public.tasks, public.assets to service_role;

create or replace function public.claim_task_recovery(p_task_id uuid, p_worker_id text, p_lease_seconds integer default 120)
returns boolean language plpgsql security definer set search_path=public
as $$
declare affected integer;
begin
  update public.tasks set recovery_locked_at=now(), recovery_worker_id=p_worker_id, updated_at=now()
  where id=p_task_id
    and status in ('created','queued','analyzing','generating')
    and (recovery_locked_at is null or recovery_locked_at < now() - make_interval(secs => greatest(p_lease_seconds,30)));
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;
revoke all on function public.claim_task_recovery(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.claim_task_recovery(uuid,text,integer) to service_role;
