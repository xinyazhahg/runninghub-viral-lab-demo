const { getSupabaseClient } = require('../lib/supabase');

const INCOMPLETE_STATUSES = ['created', 'queued', 'analyzing', 'generating'];

function createTaskResultService({ client = getSupabaseClient() } = {}) {
  async function createTask({ projectId, taskType, status = 'created', stage = 'created', inputData = {} }) {
    const now = new Date().toISOString();
    const { data, error } = await client.from('tasks').insert({
      project_id: projectId, task_type: taskType, status, stage,
      input_data: inputData, started_at: now,
    }).select('*').single();
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

  async function getTask(taskId) {
    const { data, error } = await client.from('tasks').select('*').eq('id', taskId).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function listProjectTasks(projectId) {
    const { data, error } = await client.from('tasks').select('*').eq('project_id', projectId)
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

  async function listProjectResults(projectId) {
    const { data, error } = await client.from('results').select('*').eq('project_id', projectId)
      .order('version', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function createResult(input) {
    const { data, error } = await client.rpc('create_project_result', {
      p_project_id: input.projectId,
      p_task_id: input.taskId,
      p_video_url: input.videoUrl,
      p_prompt: input.prompt,
      p_model_name: input.modelName,
      p_model_params: input.modelParams || {},
      p_duration: input.duration || null,
      p_cost: input.cost || null,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  async function getResultByTask(taskId) {
    const { data, error } = await client.from('results').select('*').eq('task_id', taskId).maybeSingle();
    if (error) throw error;
    return data;
  }

  return { createTask, updateTask, getTask, listProjectTasks, listIncompleteTasks, listProjectResults, createResult, getResultByTask };
}

module.exports = { createTaskResultService, INCOMPLETE_STATUSES };
