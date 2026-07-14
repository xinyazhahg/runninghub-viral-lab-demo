const { getSupabaseClient } = require('../lib/supabase');

const INCOMPLETE_STATUSES = ['created', 'queued', 'analyzing', 'generating'];

function createTaskResultService({ client = getSupabaseClient() } = {}) {
  async function createTask({ projectId, userId, taskType, status = 'created', stage = 'created', inputData = {}, idempotencyKey = null }) {
    if (idempotencyKey) {
      const { data: existing, error: findError } = await client.from('tasks').select('*').eq('user_id', userId).eq('idempotency_key', idempotencyKey).maybeSingle();
      if (findError) throw findError;
      if (existing) return { ...existing, idempotent: true };
    }
    const now = new Date().toISOString();
    const { data, error } = await client.from('tasks').insert({
      project_id: projectId, user_id: userId, task_type: taskType, status, stage,
      input_data: inputData, started_at: now, idempotency_key: idempotencyKey,
    }).select('*').single();
    if (error?.code === '23505' && idempotencyKey) {
      const { data: existing, error: existingError } = await client.from('tasks').select('*').eq('user_id', userId).eq('idempotency_key', idempotencyKey).single();
      if (existingError) throw existingError;
      return { ...existing, idempotent: true };
    }
    if (error) throw error;
    return data;
  }

  async function updateTask(taskId, patch) {
    const payload = { ...patch, updated_at: new Date().toISOString() };
    if (['success', 'failed', 'timeout', 'cancelled'].includes(payload.status) && !payload.finished_at) {
      payload.finished_at = new Date().toISOString();
    }
    const { data, error } = await client.from('tasks').update(payload).eq('id', taskId).select('*').single();
    if (error) throw error;
    return data;
  }

  async function getTask(taskId, userId) {
    let query = client.from('tasks').select('*').eq('id', taskId);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  }

  async function listProjectTasks(projectId, userId) {
    let query = client.from('tasks').select('*').eq('project_id', projectId);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function listIncompleteTasks() {
    const { data, error } = await client.from('tasks').select('*').in('status', INCOMPLETE_STATUSES)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function claimRecovery(taskId, workerId, leaseSeconds = 120) {
    const { data, error } = await client.rpc('claim_task_recovery', { p_task_id: taskId, p_worker_id: workerId, p_lease_seconds: leaseSeconds });
    if (error) throw error;
    return data === true;
  }

  async function listProjectResults(projectId, userId) {
    let query = client.from('results').select('*').eq('project_id', projectId);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query
      .order('version', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function createResult(input) {
    const promptSnapshot = input.promptSnapshot || {};
    const { data, error } = await client.rpc('create_project_result', {
      p_project_id: input.projectId,
      p_task_id: input.taskId,
      p_user_id: input.userId,
      p_video_url: input.videoUrl,
      p_prompt: input.prompt,
      p_model_name: input.modelName,
      p_model_params: input.modelParams || {},
      p_duration: input.duration || null,
      p_cost: input.cost || null,
      p_template_id: promptSnapshot.template_id || 'legacy',
      p_template_type: promptSnapshot.template_type || 'combined_replacement',
      p_template_version: Number(promptSnapshot.template_version || 1),
      p_system_prompt: promptSnapshot.system_prompt || '',
      p_user_requirement: promptSnapshot.user_requirement || '',
      p_replacement_summary: promptSnapshot.replacement_summary || [],
      p_negative_prompt: promptSnapshot.negative_prompt || '',
      p_diff_from_previous: promptSnapshot.diff_from_previous || {},
      p_provider_cost: input.providerCost || null,
      p_credit_cost: input.creditCost || null,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function getResultByTask(taskId, userId) {
    let query = client.from('results').select('*').eq('task_id', taskId);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  }

  async function deleteResultByTask(taskId, userId) {
    let query = client.from('results').delete().eq('task_id', taskId);
    if (userId) query = query.eq('user_id', userId);
    const { error } = await query;
    if (error) throw error;
    return true;
  }

  return { createTask, updateTask, getTask, listProjectTasks, listIncompleteTasks, claimRecovery, listProjectResults, createResult, getResultByTask, deleteResultByTask };
}

module.exports = { createTaskResultService, INCOMPLETE_STATUSES };
