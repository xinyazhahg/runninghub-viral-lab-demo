-- 保证同一 Task 最多保留一条退款流水；差额退款与业务失败补偿合并到该流水。
create unique index if not exists credit_refund_task_unique
  on public.credit_transactions(task_id)
  where type = 'refund' and task_id is not null;

create or replace function public.release_task_credits(
  p_task_id uuid,
  p_user_id uuid,
  p_charge_ratio numeric,
  p_provider_cost numeric
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  task_row public.tasks;
  charge_tx public.credit_transactions;
  refund_tx public.credit_transactions;
  account_row public.credit_accounts;
  released numeric(14,2) := 0;
  charged numeric(14,2) := 0;
  frozen_total numeric(14,2) := 0;
  refund_amount numeric(14,2) := 0;
  next_balance numeric(14,2);
  final_billing_status text := 'refunded';
begin
  select * into task_row from public.tasks
    where id = p_task_id and user_id = p_user_id for update;
  if not found then raise exception 'Task ownership mismatch'; end if;

  select * into charge_tx from public.credit_transactions
    where task_id = p_task_id and type = 'generation_charge' for update;
  if not found then
    return jsonb_build_object('idempotent', true, 'billing_status', 'not_frozen', 'refund', 0);
  end if;

  if task_row.billing_status = 'refunded' or charge_tx.status = 'refunded' then
    return jsonb_build_object('idempotent', true, 'billing_status', 'refunded', 'refund', 0);
  end if;

  select * into account_row from public.credit_accounts
    where user_id = p_user_id for update;
  if not found then raise exception 'Credit account not found'; end if;

  if charge_tx.status = 'frozen' then
    frozen_total := greatest(charge_tx.frozen_amount, 0);
    charged := round(frozen_total * greatest(0, least(1, coalesce(p_charge_ratio, 0))), 2);
    released := frozen_total - charged;
    next_balance := account_row.balance + released;
    update public.credit_accounts set
      balance = next_balance,
      frozen_balance = greatest(frozen_balance - frozen_total, 0),
      total_consumed = total_consumed + charged,
      updated_at = now()
    where user_id = p_user_id;
    update public.credit_transactions set
      amount = -charged, frozen_amount = 0, balance_after = next_balance,
      reason = case when charged = 0 then '业务失败，已全额解冻积分' else '第三方已受理，按失败规则结算积分' end,
      status = case when charged = 0 then 'refunded' else 'completed' end,
      updated_at = now()
    where id = charge_tx.id;
    final_billing_status := case when charged = 0 then 'refunded' else 'settled' end;
    refund_amount := released;
  elsif charge_tx.status = 'completed' then
    charged := abs(charge_tx.amount);
    next_balance := account_row.balance + charged;
    update public.credit_accounts set
      balance = next_balance,
      total_consumed = greatest(total_consumed - charged, 0),
      updated_at = now()
    where user_id = p_user_id;

    select * into refund_tx from public.credit_transactions
      where task_id = p_task_id and type = 'refund' for update;
    if found then
      update public.credit_transactions set
        amount = amount + charged,
        balance_after = next_balance,
        reason = '业务失败，已退回全部实际扣费',
        status = 'completed', updated_at = now()
      where id = refund_tx.id;
    else
      insert into public.credit_transactions(
        user_id, task_id, type, amount, frozen_amount,
        balance_before, balance_after, reason, status
      ) values (
        p_user_id, p_task_id, 'refund', charged, 0,
        account_row.balance, next_balance, '业务失败，已退回全部实际扣费', 'completed'
      );
    end if;
    final_billing_status := 'refunded';
    refund_amount := charged;
  else
    return jsonb_build_object('idempotent', true, 'billing_status', task_row.billing_status, 'refund', 0);
  end if;

  update public.tasks set
    actual_credit_cost = case when final_billing_status = 'refunded' then 0 else charged end,
    actual_provider_cost = coalesce(p_provider_cost, actual_provider_cost),
    billing_status = final_billing_status,
    updated_at = now()
  where id = p_task_id;

  return jsonb_build_object(
    'idempotent', false,
    'billing_status', final_billing_status,
    'balance', next_balance,
    'refund', refund_amount,
    'actual_credit_cost', case when final_billing_status = 'refunded' then 0 else charged end
  );
end;
$$;

revoke all on function public.release_task_credits(uuid, uuid, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.release_task_credits(uuid, uuid, numeric, numeric)
  to service_role;
