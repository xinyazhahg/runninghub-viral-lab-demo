create table if not exists public.billing_settings (
  id text primary key default 'default',
  signup_bonus numeric(14,2) not null default 100,
  test_user_bonus numeric(14,2) not null default 1000,
  test_user_emails jsonb not null default '[]'::jsonb,
  default_failure_charge_ratio numeric(6,4) not null default 0.20 check (default_failure_charge_ratio between 0 and 1),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.billing_settings (id) values ('default') on conflict (id) do nothing;

create table if not exists public.credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance numeric(14,2) not null default 0 check (balance >= 0),
  frozen_balance numeric(14,2) not null default 0 check (frozen_balance >= 0),
  total_recharged numeric(14,2) not null default 0 check (total_recharged >= 0),
  total_consumed numeric(14,2) not null default 0 check (total_consumed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_id text not null unique default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid null references public.tasks(id) on delete set null,
  type text not null check (type in ('signup_bonus','generation_charge','refund','manual_adjustment')),
  amount numeric(14,2) not null,
  frozen_amount numeric(14,2) not null default 0,
  balance_before numeric(14,2) not null,
  balance_after numeric(14,2) not null,
  reason text not null,
  status text not null check (status in ('pending','frozen','completed','refunded','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists credit_generation_task_unique
  on public.credit_transactions(task_id) where type = 'generation_charge';
create index if not exists credit_transactions_user_created_idx
  on public.credit_transactions(user_id, created_at desc);

alter table public.tasks add column if not exists estimated_provider_cost numeric(14,4) null;
alter table public.tasks add column if not exists actual_provider_cost numeric(14,4) null;
alter table public.tasks add column if not exists estimated_credit_cost numeric(14,2) null;
alter table public.tasks add column if not exists actual_credit_cost numeric(14,2) null;
alter table public.tasks add column if not exists billing_status text not null default 'not_required'
  check (billing_status in ('not_required','pending','frozen','settled','refunded','partial_refund'));
alter table public.results add column if not exists provider_cost numeric(14,4) null;
alter table public.results add column if not exists credit_cost numeric(14,2) null;

alter table public.credit_accounts enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.billing_settings enable row level security;
drop policy if exists credit_accounts_owner_read on public.credit_accounts;
create policy credit_accounts_owner_read on public.credit_accounts for select to authenticated using (auth.uid() = user_id);
drop policy if exists credit_transactions_owner_read on public.credit_transactions;
create policy credit_transactions_owner_read on public.credit_transactions for select to authenticated using (auth.uid() = user_id);

grant select on public.credit_accounts, public.credit_transactions to authenticated;
grant select, insert, update, delete on public.credit_accounts, public.credit_transactions, public.billing_settings to service_role;
grant select, update on public.tasks, public.results to service_role;

create or replace function public.initialize_credit_account()
returns trigger language plpgsql security definer set search_path = public
as $$
declare settings public.billing_settings; initial_bonus numeric(14,2);
begin
  select * into settings from public.billing_settings where id = 'default';
  initial_bonus := case
    when coalesce(settings.test_user_emails, '[]'::jsonb) ? coalesce(new.email, '') then settings.test_user_bonus
    else settings.signup_bonus
  end;
  insert into public.credit_accounts(user_id, balance) values (new.id, coalesce(initial_bonus, 0)) on conflict do nothing;
  insert into public.credit_transactions(user_id, type, amount, balance_before, balance_after, reason, status)
  values (new.id, 'signup_bonus', coalesce(initial_bonus, 0), 0, coalesce(initial_bonus, 0), '注册赠送积分', 'completed')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists auth_user_initialize_credit on auth.users;
create trigger auth_user_initialize_credit after insert on auth.users
for each row execute function public.initialize_credit_account();

insert into public.credit_accounts(user_id, balance)
select u.id, coalesce(s.signup_bonus, 0) from auth.users u cross join public.billing_settings s
where s.id = 'default' on conflict (user_id) do nothing;
insert into public.credit_transactions(user_id, type, amount, balance_before, balance_after, reason, status)
select a.user_id, 'signup_bonus', a.balance, 0, a.balance, '历史用户初始化积分', 'completed'
from public.credit_accounts a
where not exists (select 1 from public.credit_transactions t where t.user_id = a.user_id and t.type = 'signup_bonus');

create or replace function public.freeze_task_credits(p_task_id uuid, p_user_id uuid, p_amount numeric, p_provider_cost numeric)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare account public.credit_accounts; task_row public.tasks; tx public.credit_transactions;
begin
  if p_amount <= 0 then raise exception 'Credit amount must be positive'; end if;
  select * into task_row from public.tasks where id = p_task_id and user_id = p_user_id for update;
  if not found then raise exception 'Task ownership mismatch'; end if;
  select * into tx from public.credit_transactions where task_id = p_task_id and type = 'generation_charge';
  if found then return jsonb_build_object('idempotent', true, 'billing_status', task_row.billing_status); end if;
  select * into account from public.credit_accounts where user_id = p_user_id for update;
  if not found then raise exception 'Credit account not found'; end if;
  if account.balance < p_amount then raise exception 'INSUFFICIENT_CREDITS'; end if;
  update public.credit_accounts set balance = balance - p_amount, frozen_balance = frozen_balance + p_amount, updated_at = now()
    where user_id = p_user_id;
  insert into public.credit_transactions(user_id, task_id, type, amount, frozen_amount, balance_before, balance_after, reason, status)
    values (p_user_id, p_task_id, 'generation_charge', -p_amount, p_amount, account.balance, account.balance - p_amount, '生成任务冻结积分', 'frozen');
  update public.tasks set estimated_credit_cost = p_amount, estimated_provider_cost = p_provider_cost,
    billing_status = 'frozen', updated_at = now() where id = p_task_id;
  return jsonb_build_object('idempotent', false, 'balance', account.balance - p_amount, 'frozen_balance', account.frozen_balance + p_amount);
end;
$$;

create or replace function public.settle_task_credits(p_task_id uuid, p_user_id uuid, p_actual_amount numeric, p_provider_cost numeric)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare account public.credit_accounts; task_row public.tasks; tx public.credit_transactions;
  frozen numeric(14,2); charge numeric(14,2); refund numeric(14,2); extra numeric(14,2); next_balance numeric(14,2);
begin
  select * into task_row from public.tasks where id = p_task_id and user_id = p_user_id for update;
  if not found then raise exception 'Task ownership mismatch'; end if;
  if task_row.billing_status in ('settled','refunded','partial_refund') then
    return jsonb_build_object('idempotent', true, 'billing_status', task_row.billing_status, 'actual_credit_cost', task_row.actual_credit_cost);
  end if;
  select * into tx from public.credit_transactions where task_id = p_task_id and type = 'generation_charge' for update;
  if not found or tx.status <> 'frozen' then raise exception 'Frozen transaction not found'; end if;
  select * into account from public.credit_accounts where user_id = p_user_id for update;
  frozen := tx.frozen_amount; charge := greatest(0, round(p_actual_amount, 2));
  extra := greatest(charge - frozen, 0); refund := greatest(frozen - charge, 0);
  if account.balance < extra then charge := frozen + account.balance; extra := account.balance; refund := 0; end if;
  next_balance := account.balance - extra + refund;
  update public.credit_accounts set balance = next_balance, frozen_balance = greatest(frozen_balance - frozen, 0),
    total_consumed = total_consumed + charge, updated_at = now() where user_id = p_user_id;
  update public.credit_transactions set amount = -charge, frozen_amount = 0, balance_after = next_balance,
    reason = case when charge = 0 then '生成任务未产生费用，积分全额退回' else '生成任务实际扣费' end,
    status = case when charge = 0 then 'refunded' else 'completed' end, updated_at = now() where id = tx.id;
  if refund > 0 then
    insert into public.credit_transactions(user_id, task_id, type, amount, balance_before, balance_after, reason, status)
      values (p_user_id, p_task_id, 'refund', refund, account.balance - extra, next_balance, '预计与实际费用差额退回', 'completed');
  end if;
  update public.tasks set actual_credit_cost = charge, actual_provider_cost = p_provider_cost,
    billing_status = case when refund > 0 then 'partial_refund' else 'settled' end, updated_at = now() where id = p_task_id;
  return jsonb_build_object('idempotent', false, 'balance', next_balance, 'actual_credit_cost', charge, 'refund', refund);
end;
$$;

create or replace function public.release_task_credits(p_task_id uuid, p_user_id uuid, p_charge_ratio numeric, p_provider_cost numeric)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare tx public.credit_transactions; charge numeric(14,2); outcome jsonb;
begin
  select * into tx from public.credit_transactions where task_id = p_task_id and type = 'generation_charge';
  if not found then return jsonb_build_object('idempotent', true, 'billing_status', 'not_frozen'); end if;
  charge := round(tx.frozen_amount * greatest(0, least(1, p_charge_ratio)), 2);
  outcome := public.settle_task_credits(p_task_id, p_user_id, charge, p_provider_cost);
  if charge = 0 then update public.tasks set billing_status = 'refunded' where id = p_task_id; end if;
  return outcome;
end;
$$;

revoke all on function public.freeze_task_credits(uuid, uuid, numeric, numeric) from public, anon, authenticated;
revoke all on function public.settle_task_credits(uuid, uuid, numeric, numeric) from public, anon, authenticated;
revoke all on function public.release_task_credits(uuid, uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function public.freeze_task_credits(uuid, uuid, numeric, numeric) to service_role;
grant execute on function public.settle_task_credits(uuid, uuid, numeric, numeric) to service_role;
grant execute on function public.release_task_credits(uuid, uuid, numeric, numeric) to service_role;

update public.model_configs set cost_rule = jsonb_build_object(
  'enabled', true,
  'base_credits', 1,
  'per_second_credits', 0.5,
  'provider_to_credit_rate', 10,
  'resolution_coefficients', jsonb_build_object('480p', 0.8, '720p', 1, '1080p', 1.3, '2k', 1.8, '4k', 2.5),
  'duration_coefficients', jsonb_build_object('4', 1, '10', 1.1, '15', 1.2),
  'sale_factor', 1,
  'failure_charge_ratio', 0.2
) where model_id = 'kling-v3-pro';

drop function if exists public.create_project_result(
  uuid, uuid, uuid, text, text, text, jsonb, numeric, text,
  text, text, integer, text, text, jsonb, text, jsonb
);
create function public.create_project_result(
  p_project_id uuid, p_task_id uuid, p_user_id uuid, p_video_url text,
  p_prompt text, p_model_name text, p_model_params jsonb, p_duration numeric, p_cost text,
  p_template_id text, p_template_type text, p_template_version integer,
  p_system_prompt text, p_user_requirement text, p_replacement_summary jsonb,
  p_negative_prompt text, p_diff_from_previous jsonb,
  p_provider_cost numeric, p_credit_cost numeric
) returns public.results
language plpgsql security definer set search_path = public
as $$
declare project_owner uuid; next_version integer; created_result public.results; created_prompt public.prompt_versions;
begin
  select * into created_result from public.results where task_id = p_task_id;
  if found then return created_result; end if;
  select user_id into project_owner from public.projects where id = p_project_id;
  if project_owner is null or project_owner is distinct from p_user_id then raise exception 'Project ownership mismatch'; end if;
  if coalesce(trim(p_prompt), '') = '' then raise exception 'Generated prompt must not be empty'; end if;
  perform pg_advisory_xact_lock(hashtext(p_project_id::text));
  select coalesce(max(version), 0) + 1 into next_version from public.results where project_id = p_project_id;
  insert into public.results(project_id,user_id,task_id,version,video_url,prompt,model_name,model_params,duration,cost,provider_cost,credit_cost)
  values(p_project_id,project_owner,p_task_id,next_version,p_video_url,p_prompt,p_model_name,coalesce(p_model_params,'{}'::jsonb),p_duration,p_cost,p_provider_cost,p_credit_cost)
  returning * into created_result;
  insert into public.prompt_versions(project_id,user_id,task_id,result_id,version,template_id,template_type,template_version,system_prompt,generated_prompt,user_requirement,replacement_summary,negative_prompt,model_id,model_params,diff_from_previous)
  values(p_project_id,project_owner,p_task_id,created_result.id,next_version,p_template_id,p_template_type,p_template_version,p_system_prompt,p_prompt,coalesce(p_user_requirement,''),coalesce(p_replacement_summary,'[]'::jsonb),coalesce(p_negative_prompt,''),coalesce(p_model_params->>'model_id',''),coalesce(p_model_params,'{}'::jsonb),coalesce(p_diff_from_previous,'{}'::jsonb))
  returning * into created_prompt;
  update public.results set prompt_id = created_prompt.id where id = created_result.id returning * into created_result;
  return created_result;
end;
$$;
revoke all on function public.create_project_result(uuid,uuid,uuid,text,text,text,jsonb,numeric,text,text,text,integer,text,text,jsonb,text,jsonb,numeric,numeric) from public, anon, authenticated;
grant execute on function public.create_project_result(uuid,uuid,uuid,text,text,text,jsonb,numeric,text,text,text,integer,text,text,jsonb,text,jsonb,numeric,numeric) to service_role;
