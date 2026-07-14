const { getSupabaseClient } = require('./supabase');

const SENSITIVE = /authorization|password|secret|token|api.?key|base64|buffer|binary|prompt/i;
function sanitize(value, depth = 0) {
  if (depth > 4) return '[TRUNCATED]';
  if (typeof value === 'string') {
    if (/^data:.*;base64,/i.test(value)) return '[BASE64_REDACTED]';
    return value.length > 1000 ? `${value.slice(0, 1000)}…[TRUNCATED]` : value;
  }
  if (Buffer.isBuffer(value)) return `[BUFFER ${value.length} bytes]`;
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitize(item, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 50).map(([key, item]) => [key, SENSITIVE.test(key) ? '[REDACTED]' : sanitize(item, depth + 1)]));
  return value;
}

function createLogger({ clientFactory = getSupabaseClient } = {}) {
  function write(level, entry) {
    const row = {
      timestamp: new Date().toISOString(), level, request_id: entry.requestId || null,
      user_id: entry.userId || null, project_id: entry.projectId || null, task_id: entry.taskId || null,
      external_task_id: entry.externalTaskId || null, skill_name: entry.skillName || null,
      model_name: entry.modelName || null, action: entry.action || 'unknown', duration_ms: entry.durationMs ?? null,
      status: entry.status || null, error_code: entry.errorCode || null,
      error_message: entry.errorMessage ? sanitize(String(entry.errorMessage)) : null,
      metadata: sanitize(entry.metadata || {}),
    };
    const local = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    local(JSON.stringify(row));
    try { clientFactory().from('system_logs').insert(row).then(({ error }) => { if (error && process.env.NODE_ENV !== 'test') console.warn('结构化日志持久化失败：', error.message); }); } catch {}
    return row;
  }
  return { debug: (e) => write('debug', e), info: (e) => write('info', e), warn: (e) => write('warn', e), error: (e) => write('error', e) };
}

module.exports = { createLogger, sanitize };
