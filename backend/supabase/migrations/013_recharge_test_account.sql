begin;

alter table public.credit_transactions
  drop constraint if exists credit_transactions_type_check;

alter table public.credit_transactions
  add constraint credit_transactions_type_check
  check (type in ('signup_bonus','generation_charge','refund','manual_adjustment','manual_recharge'));

do $$
declare
  target_email constant text := 'xinyazhang53@gmail.com';
  recharge_amount constant numeric(14,2) := 99999.00;
  recharge_transaction_id constant text := 'manual_recharge:seedance-2.0-local-test:xinyazhang53@gmail.com:013';
  target_user_id uuid;
  account_row public.credit_accounts%rowtype;
  next_balance numeric(14,2);
begin
  perform pg_advisory_xact_lock(hashtextextended(recharge_transaction_id, 0));

  select id into target_user_id
  from auth.users
  where lower(email) = lower(target_email)
  limit 1;

  if target_user_id is null then
    raise exception 'Test account not found in auth.users: %', target_email;
  end if;

  if exists (select 1 from public.credit_transactions where transaction_id = recharge_transaction_id) then
    raise notice 'Recharge 013 already applied for %, skipping safely.', target_email;
    return;
  end if;

  select * into account_row
  from public.credit_accounts
  where user_id = target_user_id
  for update;

  if not found then
    raise exception 'credit_accounts row not found for test account: %', target_email;
  end if;

  next_balance := account_row.balance + recharge_amount;

  update public.credit_accounts
  set balance = balance + recharge_amount,
      total_recharged = total_recharged + recharge_amount,
      updated_at = now()
  where user_id = target_user_id;

  insert into public.credit_transactions (
    transaction_id, user_id, task_id, type, amount, frozen_amount,
    balance_before, balance_after, reason, status
  ) values (
    recharge_transaction_id, target_user_id, null, 'manual_recharge', recharge_amount, 0,
    account_row.balance, next_balance, 'Seedance 2.0 本地测试充值', 'completed'
  );
end;
$$;

commit;
