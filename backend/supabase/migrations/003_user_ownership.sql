-- Existing rows intentionally keep a null owner until an administrator assigns them.
-- Null-owned legacy rows are inaccessible through authenticated RLS policies.
alter table public.projects add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.assets add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.tasks add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.results add column if not exists user_id uuid references auth.users(id) on delete cascade;

update public.assets a set user_id = p.user_id
from public.projects p where a.project_id = p.id and a.user_id is distinct from p.user_id;
update public.tasks t set user_id = p.user_id
from public.projects p where t.project_id = p.id and t.user_id is distinct from p.user_id;
update public.results r set user_id = p.user_id
from public.projects p where r.project_id = p.id and r.user_id is distinct from p.user_id;

create index if not exists projects_user_updated_idx on public.projects(user_id, updated_at desc);
create index if not exists assets_user_project_idx on public.assets(user_id, project_id);
create index if not exists tasks_user_project_idx on public.tasks(user_id, project_id, created_at desc);
create index if not exists results_user_project_idx on public.results(user_id, project_id, version);

create or replace function public.inherit_project_user_id()
returns trigger language plpgsql security definer set search_path = public
as $$
declare owner_id uuid;
begin
  select user_id into owner_id from public.projects where id = new.project_id;
  if owner_id is null then raise exception 'Project owner is missing'; end if;
  new.user_id := owner_id;
  return new;
end;
$$;

drop trigger if exists assets_inherit_project_user on public.assets;
create trigger assets_inherit_project_user before insert or update of project_id, user_id on public.assets
for each row execute function public.inherit_project_user_id();
drop trigger if exists tasks_inherit_project_user on public.tasks;
create trigger tasks_inherit_project_user before insert or update of project_id, user_id on public.tasks
for each row execute function public.inherit_project_user_id();
drop trigger if exists results_inherit_project_user on public.results;
create trigger results_inherit_project_user before insert or update of project_id, user_id on public.results
for each row execute function public.inherit_project_user_id();

create or replace function public.touch_parent_project()
returns trigger language plpgsql security definer set search_path = public
as $$
declare target_project_id uuid;
begin
  target_project_id := case when tg_op = 'DELETE' then old.project_id else new.project_id end;
  update public.projects set updated_at = now() where id = target_project_id;
  return null;
end;
$$;
drop trigger if exists assets_touch_project on public.assets;
create trigger assets_touch_project after insert or update or delete on public.assets
for each row execute function public.touch_parent_project();
drop trigger if exists tasks_touch_project on public.tasks;
create trigger tasks_touch_project after insert or update or delete on public.tasks
for each row execute function public.touch_parent_project();
drop trigger if exists results_touch_project on public.results;
create trigger results_touch_project after insert or update or delete on public.results
for each row execute function public.touch_parent_project();

drop policy if exists projects_owner_all on public.projects;
create policy projects_owner_all on public.projects for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists assets_owner_all on public.assets;
create policy assets_owner_all on public.assets for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists tasks_owner_all on public.tasks;
create policy tasks_owner_all on public.tasks for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists results_owner_all on public.results;
create policy results_owner_all on public.results for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Convert result URLs to stable private object paths where the linked result Asset is known.
update public.results r set video_url = a.storage_path
from public.tasks t, public.assets a
where r.task_id = t.id
  and a.id::text = t.output_data->>'assetId'
  and a.asset_type = 'result_video';

update storage.buckets set public = false where id = 'viral-lab-assets';

drop function if exists public.create_project_result(uuid, uuid, text, text, text, jsonb, numeric, text);
create function public.create_project_result(
  p_project_id uuid,
  p_task_id uuid,
  p_user_id uuid,
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
  project_owner uuid;
  next_version integer;
  created_result public.results;
begin
  select user_id into project_owner from public.projects where id = p_project_id;
  if project_owner is null or project_owner is distinct from p_user_id then
    raise exception 'Project ownership mismatch';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_project_id::text));
  select coalesce(max(version), 0) + 1 into next_version
    from public.results where project_id = p_project_id;
  insert into public.results (
    project_id, user_id, task_id, version, video_url, prompt, model_name, model_params, duration, cost
  ) values (
    p_project_id, project_owner, p_task_id, next_version, p_video_url, p_prompt, p_model_name,
    coalesce(p_model_params, '{}'::jsonb), p_duration, p_cost
  ) returning * into created_result;
  return created_result;
exception when unique_violation then
  select * into created_result from public.results where task_id = p_task_id;
  return created_result;
end;
$$;
