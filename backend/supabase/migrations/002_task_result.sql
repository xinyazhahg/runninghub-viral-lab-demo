alter table public.assets drop constraint if exists assets_asset_type_check;
alter table public.assets add constraint assets_asset_type_check
  check (asset_type in ('original_video','replacement_image','result_video'));
alter table public.assets drop constraint if exists replacement_type_matches_asset;
alter table public.assets add constraint replacement_type_matches_asset check (
  (asset_type = 'original_video' and replacement_type is null)
  or (asset_type = 'replacement_image' and replacement_type is not null)
  or (asset_type = 'result_video' and replacement_type is null)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  external_task_id text null,
  task_type text not null check (task_type in ('video_to_text','generate_video')),
  status text not null default 'created' check (status in ('created','queued','analyzing','generating','success','failed','timeout','cancelled')),
  stage text not null default 'created',
  input_data jsonb not null default '{}'::jsonb,
  output_data jsonb null,
  error_code text null,
  error_message text null,
  retry_count integer not null default 0,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  version integer not null check (version > 0),
  video_url text not null,
  prompt text not null,
  model_name text not null,
  model_params jsonb not null default '{}'::jsonb,
  duration numeric null,
  cost text null,
  created_at timestamptz not null default now(),
  constraint results_project_version_unique unique (project_id, version),
  constraint results_task_unique unique (task_id)
);

create index if not exists tasks_project_created_idx on public.tasks(project_id, created_at desc);
create index if not exists tasks_external_task_idx on public.tasks(external_task_id);
create index if not exists tasks_incomplete_idx on public.tasks(status)
  where status in ('created','queued','analyzing','generating');
create index if not exists results_project_version_idx on public.results(project_id, version);
alter table public.tasks enable row level security;
alter table public.results enable row level security;

create or replace function public.create_project_result(
  p_project_id uuid,
  p_task_id uuid,
  p_video_url text,
  p_prompt text,
  p_model_name text,
  p_model_params jsonb,
  p_duration numeric,
  p_cost text
) returns public.results
language plpgsql security definer set search_path = public
as $$
declare
  next_version integer;
  created_result public.results;
begin
  perform pg_advisory_xact_lock(hashtext(p_project_id::text));
  select coalesce(max(version), 0) + 1 into next_version
    from public.results where project_id = p_project_id;
  insert into public.results (
    project_id, task_id, version, video_url, prompt, model_name, model_params, duration, cost
  ) values (
    p_project_id, p_task_id, next_version, p_video_url, p_prompt, p_model_name,
    coalesce(p_model_params, '{}'::jsonb), p_duration, p_cost
  ) returning * into created_result;
  return created_result;
exception when unique_violation then
  select * into created_result from public.results where task_id = p_task_id;
  return created_result;
end;
$$;
