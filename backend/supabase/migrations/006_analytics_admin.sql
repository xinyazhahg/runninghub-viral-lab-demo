create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'analyst')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  event_id uuid primary key,
  event_name text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  project_id uuid references public.projects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  result_id uuid references public.results(id) on delete set null,
  model_id text,
  event_properties jsonb not null default '{}'::jsonb,
  page text not null default '',
  source text not null default 'web',
  created_at timestamptz not null default now(),
  constraint analytics_event_name_length check (char_length(event_name) between 1 and 80),
  constraint analytics_session_length check (char_length(session_id) between 1 and 128),
  constraint analytics_properties_object check (jsonb_typeof(event_properties) = 'object')
);

create index if not exists analytics_events_created_idx on public.analytics_events(created_at desc);
create index if not exists analytics_events_name_created_idx on public.analytics_events(event_name, created_at desc);
create index if not exists analytics_events_user_created_idx on public.analytics_events(user_id, created_at desc);
create index if not exists analytics_events_project_created_idx on public.analytics_events(project_id, created_at desc) where project_id is not null;
create index if not exists analytics_events_task_created_idx on public.analytics_events(task_id, created_at desc) where task_id is not null;
create index if not exists analytics_events_model_created_idx on public.analytics_events(model_id, created_at desc) where model_id is not null;

create or replace function public.validate_analytics_event_ownership()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.project_id is not null and not exists (select 1 from public.projects where id=new.project_id and user_id=new.user_id) then
    raise exception 'Analytics Project ownership mismatch';
  end if;
  if new.task_id is not null and not exists (select 1 from public.tasks where id=new.task_id and user_id=new.user_id) then
    raise exception 'Analytics Task ownership mismatch';
  end if;
  if new.result_id is not null and not exists (select 1 from public.results where id=new.result_id and user_id=new.user_id) then
    raise exception 'Analytics Result ownership mismatch';
  end if;
  return new;
end;
$$;
drop trigger if exists analytics_events_validate_owner on public.analytics_events;
create trigger analytics_events_validate_owner before insert or update on public.analytics_events
for each row execute function public.validate_analytics_event_ownership();

alter table public.admin_users enable row level security;
alter table public.analytics_events enable row level security;

drop policy if exists admin_users_self_read on public.admin_users;
create policy admin_users_self_read on public.admin_users for select to authenticated
using (auth.uid() = user_id and status = 'active');

-- 原始事件不向普通用户开放；浏览器只通过已鉴权后端批量写入。
revoke all on public.analytics_events from anon, authenticated;
revoke all on public.admin_users from anon;
grant select on public.admin_users to authenticated;
grant select, insert, update, delete on public.analytics_events, public.admin_users to service_role;

create or replace function public.analytics_overview(
  p_from timestamptz,
  p_to timestamptz,
  p_model_id text default null,
  p_task_status text default null
) returns jsonb
language sql security definer set search_path = public, auth
as $$
with filtered_events as (
  select * from public.analytics_events
  where created_at >= p_from and created_at < p_to
    and (p_model_id is null or model_id = p_model_id)
), filtered_tasks as (
  select * from public.tasks
  where created_at >= p_from and created_at < p_to
    and (p_task_status is null or status = p_task_status)
    and (p_model_id is null or coalesce(input_data->'config'->>'model_id', input_data->>'model_id') = p_model_id)
), task_durations as (
  select extract(epoch from (finished_at - started_at)) duration_seconds
  from filtered_tasks where started_at is not null and finished_at is not null
), funnel_names(event_name, position) as (values
  ('page_view',1),('upload_original_video_success',2),('video_analysis_success',3),
  ('upload_replacement_asset',4),('generation_submit',5),('generation_success',6),
  ('play_result',7),('export_video',8)
), funnel as (
  select f.event_name, f.position, count(distinct e.user_id) users
  from funnel_names f left join filtered_events e on e.event_name = f.event_name
  group by f.event_name, f.position order by f.position
), model_stats as (
  select coalesce(input_data->'config'->>'model_id', input_data->>'model_id', 'unknown') model_id,
    count(*) calls, count(*) filter (where status='success') successes,
    count(*) filter (where status in ('failed','timeout','cancelled')) failures,
    avg(extract(epoch from (finished_at-started_at))) filter (where finished_at is not null) avg_seconds,
    avg(actual_provider_cost) avg_cost, sum(actual_provider_cost) total_cost
  from filtered_tasks where task_type='generate_video' group by 1
), failure_stats as (
  select coalesce(error_code,'UNKNOWN') error_code, coalesce(nullif(error_message,''),'未记录原因') error_message, count(*) count
  from filtered_tasks where status in ('failed','timeout') group by 1,2 order by count(*) desc limit 10
), billing as (
  select
    coalesce(sum(-amount) filter (where type='generation_charge' and status='completed'),0) consumed,
    coalesce(sum(frozen_amount) filter (where status='frozen'),0) frozen,
    coalesce(sum(amount) filter (where type='refund'),0) refunded
  from public.credit_transactions where created_at >= p_from and created_at < p_to
), projects_stats as (
  select count(*) projects, count(*) filter (where original_asset_id is not null) valid_projects,
    count(distinct user_id) project_users from public.projects where created_at >= p_from and created_at < p_to
)
select jsonb_build_object(
  'users', jsonb_build_object(
    'registered', (select count(*) from auth.users),
    'newUsers', (select count(*) from auth.users where created_at >= p_from and created_at < p_to),
    'activeUsers', (select count(distinct user_id) from filtered_events),
    'dailyActiveUsers', (select count(distinct user_id) from filtered_events where created_at >= greatest(p_from,p_to-interval '1 day'))
  ),
  'projects', (select jsonb_build_object('created',projects,'valid',valid_projects,'averagePerUser',case when project_users=0 then 0 else projects::numeric/project_users end) from projects_stats),
  'funnel', (select coalesce(jsonb_agg(jsonb_build_object('eventName',event_name,'users',users) order by position),'[]'::jsonb) from funnel),
  'tasks', jsonb_build_object(
    'total',(select count(*) from filtered_tasks),
    'success',(select count(*) from filtered_tasks where status='success'),
    'failed',(select count(*) from filtered_tasks where status in ('failed','timeout')),
    'successRate',(select case when count(*) filter(where status in ('success','failed','timeout','cancelled'))=0 then 0 else count(*) filter(where status='success')::numeric/count(*) filter(where status in ('success','failed','timeout','cancelled')) end from filtered_tasks),
    'averageSeconds',(select avg(duration_seconds) from task_durations),
    'p50Seconds',(select percentile_cont(.5) within group(order by duration_seconds) from task_durations),
    'p90Seconds',(select percentile_cont(.9) within group(order by duration_seconds) from task_durations)
  ),
  'models',(select coalesce(jsonb_agg(to_jsonb(model_stats)),'[]'::jsonb) from model_stats),
  'failures',(select coalesce(jsonb_agg(to_jsonb(failure_stats)),'[]'::jsonb) from failure_stats),
  'billing',(select to_jsonb(billing) from billing),
  'quality',jsonb_build_object(
    'regenerateRate',(select case when count(*) filter(where event_name='generation_success')=0 then 0 else count(*) filter(where event_name='regenerate')::numeric/count(*) filter(where event_name='generation_success') end from filtered_events),
    'exportRate',(select case when count(*) filter(where event_name='generation_success')=0 then 0 else count(*) filter(where event_name='export_video')::numeric/count(*) filter(where event_name='generation_success') end from filtered_events),
    'playRate',(select case when count(*) filter(where event_name='generation_success')=0 then 0 else count(*) filter(where event_name='play_result')::numeric/count(*) filter(where event_name='generation_success') end from filtered_events),
    'v2PlusRate',(select case when count(distinct project_id)=0 then 0 else count(distinct project_id) filter(where version>=2)::numeric/count(distinct project_id) end from public.results where created_at>=p_from and created_at<p_to),
    'continueEditRate',(select case when count(*) filter(where event_name='open_project')=0 then 0 else count(*) filter(where event_name='regenerate')::numeric/count(*) filter(where event_name='open_project') end from filtered_events)
  )
);
$$;

revoke all on function public.analytics_overview(timestamptz,timestamptz,text,text) from public, anon, authenticated;
grant execute on function public.analytics_overview(timestamptz,timestamptz,text,text) to service_role;
