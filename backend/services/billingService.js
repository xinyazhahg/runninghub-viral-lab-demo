const { getSupabaseClient } = require('../lib/supabase');

function createBillingService({ client = getSupabaseClient() } = {}) {
  async function getAccount(userId) {
    const { data, error } = await client.from('credit_accounts').select('*').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function listTransactions(userId, limit = 50) {
    const { data, error } = await client.from('credit_transactions').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(Math.min(100, Math.max(1, Number(limit) || 50)));
    if (error) throw error;
    return data || [];
  }

  async function getSettings() {
    const { data, error } = await client.from('billing_settings').select('*').eq('id', 'default').single();
    if (error) throw error;
    return data;
  }

  async function freezeTask({ taskId, userId, creditCost, providerCost }) {
    const { data, error } = await client.rpc('freeze_task_credits', {
      p_task_id: taskId, p_user_id: userId, p_amount: creditCost, p_provider_cost: providerCost,
    });
    if (error) throw error;
    return data;
  }

  async function settleTask({ taskId, userId, creditCost, providerCost }) {
    const { data, error } = await client.rpc('settle_task_credits', {
      p_task_id: taskId, p_user_id: userId, p_actual_amount: creditCost, p_provider_cost: providerCost,
    });
    if (error) throw error;
    return data;
  }

  async function releaseTask({ taskId, userId, chargeRatio = 0, providerCost = 0 }) {
    const { data, error } = await client.rpc('release_task_credits', {
      p_task_id: taskId, p_user_id: userId, p_charge_ratio: chargeRatio, p_provider_cost: providerCost,
    });
    if (error) throw error;
    return data;
  }

  return { getAccount, listTransactions, getSettings, freezeTask, settleTask, releaseTask };
}

module.exports = { createBillingService };
