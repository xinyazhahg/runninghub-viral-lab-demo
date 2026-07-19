create table if not exists public.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  template_id text not null,
  name text not null,
  type text not null check (type in ('subject_replacement','scene_replacement','element_replacement','product_video','style_transfer','combined_replacement')),
  template_content text not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, version)
);

create table if not exists public.model_configs (
  model_id text primary key,
  model_name text not null,
  provider text not null,
  endpoint text not null,
  capability jsonb not null default '{}'::jsonb,
  supported_durations jsonb not null default '[]'::jsonb,
  supported_ratios jsonb not null default '[]'::jsonb,
  supported_resolutions jsonb not null default '[]'::jsonb,
  cost_rule jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  result_id uuid not null,
  version integer not null check (version > 0),
  template_id text not null,
  template_type text not null,
  template_version integer not null check (template_version > 0),
  system_prompt text not null,
  generated_prompt text not null,
  user_requirement text not null default '',
  replacement_summary jsonb not null default '[]'::jsonb,
  negative_prompt text not null default '',
  model_id text not null default '',
  model_params jsonb not null default '{}'::jsonb,
  diff_from_previous jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (task_id),
  unique (result_id),
  unique (project_id, version)
);

alter table public.results add column if not exists prompt_id uuid null;
alter table public.results drop constraint if exists results_prompt_id_fkey;
alter table public.results add constraint results_prompt_id_fkey
  foreign key (prompt_id) references public.prompt_versions(id) on delete set null;
alter table public.prompt_versions drop constraint if exists prompt_versions_result_id_fkey;
alter table public.prompt_versions add constraint prompt_versions_result_id_fkey
  foreign key (result_id) references public.results(id) on delete cascade;

create index if not exists prompt_versions_user_project_idx on public.prompt_versions(user_id, project_id, version);
create index if not exists prompt_templates_type_status_idx on public.prompt_templates(type, status, version desc);
create index if not exists model_configs_status_priority_idx on public.model_configs(status, priority);

alter table public.prompt_templates enable row level security;
alter table public.model_configs enable row level security;
alter table public.prompt_versions enable row level security;

drop policy if exists prompt_templates_authenticated_read on public.prompt_templates;
create policy prompt_templates_authenticated_read on public.prompt_templates for select to authenticated using (true);
drop policy if exists model_configs_authenticated_read on public.model_configs;
create policy model_configs_authenticated_read on public.model_configs for select to authenticated using (true);
drop policy if exists prompt_versions_owner_read on public.prompt_versions;
create policy prompt_versions_owner_read on public.prompt_versions for select to authenticated using (auth.uid() = user_id);

grant select on public.prompt_templates, public.model_configs to authenticated;
grant select on public.prompt_versions to authenticated;
grant select, insert, update, delete on public.prompt_templates, public.model_configs, public.prompt_versions to service_role;
grant select, update on public.results to service_role;

insert into public.prompt_templates (template_id, name, type, template_content, version, status) values
('subject-replacement', '主体替换模板', 'subject_replacement', E'{{system_prompt}}\n\n【本次替换】\n{{replacement_text}}\n\n【必须保持】\n{{preserve_text}}\n\n【用户额外要求】\n{{user_requirement}}\n\n【负向约束】\n{{negative_prompt}}', 1, 'active'),
('scene-replacement', '场景替换模板', 'scene_replacement', E'{{system_prompt}}\n\n【场景替换】\n{{replacement_text}}\n\n【必须保持】\n{{preserve_text}}\n\n【用户额外要求】\n{{user_requirement}}\n\n【负向约束】\n{{negative_prompt}}', 1, 'active'),
('element-replacement', '元素替换模板', 'element_replacement', E'{{system_prompt}}\n\n【元素替换】\n{{replacement_text}}\n\n【必须保持】\n{{preserve_text}}\n\n【用户额外要求】\n{{user_requirement}}\n\n【负向约束】\n{{negative_prompt}}', 1, 'active'),
('product-video', '商品视频模板', 'product_video', E'{{system_prompt}}\n\n【商品表达】\n{{replacement_text}}\n\n【镜头与商品约束】\n{{preserve_text}}\n\n【用户额外要求】\n{{user_requirement}}\n\n【负向约束】\n{{negative_prompt}}', 1, 'active'),
('style-transfer', '风格转换模板', 'style_transfer', E'{{system_prompt}}\n\n【风格转换】\n{{replacement_text}}\n\n【内容保持】\n{{preserve_text}}\n\n【用户额外要求】\n{{user_requirement}}\n\n【负向约束】\n{{negative_prompt}}', 1, 'active'),
('combined-replacement', '多项组合替换模板', 'combined_replacement', E'{{system_prompt}}\n\n【多项替换】\n{{replacement_text}}\n\n【必须保持】\n{{preserve_text}}\n\n【用户额外要求】\n{{user_requirement}}\n\n【负向约束】\n{{negative_prompt}}', 1, 'active')
on conflict (template_id, version) do nothing;

insert into public.model_configs (
  model_id, model_name, provider, endpoint, capability,
  supported_durations, supported_ratios, supported_resolutions, cost_rule, status, priority
) values (
  'kling-v3-pro', '可灵 v3.0 Pro', 'RunningHub', 'bytedance/seedance-2.0-global-fast/multimodal-video',
  '{"type":"image_to_video","generate_audio":false}'::jsonb,
  '["4","5","6","7","8","9","10","11","12","13","14","15"]'::jsonb,
  '["9:16","16:9","4:3","1:1","3:4","21:9"]'::jsonb,
  '["480p","720p","1080p","2k","4k"]'::jsonb,
  '{"source":"provider_price_preview"}'::jsonb, 'active', 10
)
on conflict (model_id) do nothing;

drop function if exists public.create_project_result(uuid, uuid, uuid, text, text, text, jsonb, numeric, text);
create function public.create_project_result(
  p_project_id uuid, p_task_id uuid, p_user_id uuid, p_video_url text,
  p_prompt text, p_model_name text, p_model_params jsonb, p_duration numeric, p_cost text,
  p_template_id text, p_template_type text, p_template_version integer,
  p_system_prompt text, p_user_requirement text, p_replacement_summary jsonb,
  p_negative_prompt text, p_diff_from_previous jsonb
) returns public.results
language plpgsql security definer set search_path = public
as $$
declare
  project_owner uuid;
  next_version integer;
  created_result public.results;
  created_prompt public.prompt_versions;
begin
  select * into created_result from public.results where task_id = p_task_id;
  if found then return created_result; end if;
  select user_id into project_owner from public.projects where id = p_project_id;
  if project_owner is null or project_owner is distinct from p_user_id then raise exception 'Project ownership mismatch'; end if;
  if coalesce(trim(p_prompt), '') = '' then raise exception 'Generated prompt must not be empty'; end if;
  perform pg_advisory_xact_lock(hashtext(p_project_id::text));
  select coalesce(max(version), 0) + 1 into next_version from public.results where project_id = p_project_id;
  insert into public.results (
    project_id, user_id, task_id, version, video_url, prompt, model_name, model_params, duration, cost
  ) values (
    p_project_id, project_owner, p_task_id, next_version, p_video_url, p_prompt, p_model_name,
    coalesce(p_model_params, '{}'::jsonb), p_duration, p_cost
  ) returning * into created_result;
  insert into public.prompt_versions (
    project_id, user_id, task_id, result_id, version, template_id, template_type, template_version,
    system_prompt, generated_prompt, user_requirement, replacement_summary, negative_prompt,
    model_id, model_params, diff_from_previous
  ) values (
    p_project_id, project_owner, p_task_id, created_result.id, next_version, p_template_id, p_template_type,
    p_template_version, p_system_prompt, p_prompt, coalesce(p_user_requirement, ''),
    coalesce(p_replacement_summary, '[]'::jsonb), coalesce(p_negative_prompt, ''),
    coalesce(p_model_params->>'model_id', ''), coalesce(p_model_params, '{}'::jsonb),
    coalesce(p_diff_from_previous, '{}'::jsonb)
  ) returning * into created_prompt;
  update public.results set prompt_id = created_prompt.id where id = created_result.id returning * into created_result;
  return created_result;
end;
$$;

grant execute on function public.create_project_result(
  uuid, uuid, uuid, text, text, text, jsonb, numeric, text,
  text, text, integer, text, text, jsonb, text, jsonb
) to service_role;
