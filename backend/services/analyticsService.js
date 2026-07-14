const { getSupabaseClient } = require('../lib/supabase');
const crypto = require('crypto');

const EVENT_NAMES = new Set(`page_view login_success logout open_my_projects open_project create_project delete_project upload_original_video_start upload_original_video_success upload_original_video_failed video_analysis_start video_analysis_success video_analysis_failed upload_replacement_asset remove_replacement_asset confirm_replacement generation_config_view generation_submit generation_queued generation_started generation_success generation_failed generation_cancelled generation_timeout regenerate export_video save_to_asset_library open_history_versions view_result play_result compare_versions view_prompt copy_prompt cost_estimate_view insufficient_balance points_frozen points_charged points_refunded`.split(' '));

function safeProperties(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const blocked = /password|secret|token|authorization|api.?key|system_prompt|generated_prompt|prompt_text/i;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !blocked.test(key)).slice(0, 40));
}

function createAnalyticsService({ client = getSupabaseClient() } = {}) {
  async function recordBatch(userId, events) {
    const rows = (Array.isArray(events) ? events : []).slice(0, 50).filter((event) => EVENT_NAMES.has(event?.eventName)).map((event) => ({
      event_id: event.eventId,
      event_name: event.eventName,
      user_id: userId,
      session_id: String(event.sessionId || '').slice(0, 128),
      project_id: event.projectId || null,
      task_id: event.taskId || null,
      result_id: event.resultId || null,
      model_id: event.modelId || null,
      event_properties: safeProperties(event.properties),
      page: String(event.page || '').slice(0, 120),
      source: String(event.source || 'web').slice(0, 40),
      created_at: event.createdAt || new Date().toISOString(),
    })).filter((row) => row.event_id && row.session_id);
    if (!rows.length) return { accepted: 0 };
    const { error } = await client.from('analytics_events').upsert(rows, { onConflict: 'event_id', ignoreDuplicates: true });
    if (error) throw error;
    return { accepted: rows.length };
  }

  async function record(event) {
    return recordBatch(event.userId, [{ ...event, eventId: event.eventId || crypto.randomUUID(), sessionId: event.sessionId || `server:${event.taskId || event.userId}` }]);
  }

  async function overview(filters) {
    const { data, error } = await client.rpc('analytics_overview', {
      p_from: filters.from, p_to: filters.to, p_model_id: filters.modelId || null, p_task_status: filters.taskStatus || null,
    });
    if (error) throw error;
    return data;
  }

  async function listTasks(filters) {
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(filters.pageSize) || 20));
    let query = client.from('tasks').select('id,project_id,user_id,task_type,status,stage,error_code,error_message,started_at,finished_at,created_at,input_data,estimated_provider_cost,actual_provider_cost,estimated_credit_cost,actual_credit_cost', { count: 'exact' })
      .gte('created_at', filters.from).lt('created_at', filters.to).order('created_at', { ascending: false });
    if (filters.taskStatus) query = query.eq('status', filters.taskStatus);
    if (filters.modelId) query = query.contains('input_data', { config: { model_id: filters.modelId } });
    const { data, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw error;
    return { items: data || [], page, pageSize, total: count || 0 };
  }

  return { recordBatch, record, overview, listTasks };
}

module.exports = { createAnalyticsService, EVENT_NAMES, safeProperties };
