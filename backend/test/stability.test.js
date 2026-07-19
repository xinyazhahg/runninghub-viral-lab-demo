const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sanitize } = require('../lib/logger');
const { isRetryable, withRetry } = require('../lib/retry');
const { appError, normalizeError } = require('../lib/errorCodes');
const { createTaskResultService } = require('../services/taskResultService');

test('structured logger redacts secrets, tokens, prompts, buffers and base64', () => {
  const clean = sanitize({ authorization: 'Bearer secret', prompt: 'private', body: Buffer.from('video'), preview: 'data:image/png;base64,abc', nested: { apiKey: 'x', duration: 4 } });
  assert.equal(clean.authorization, '[REDACTED]');
  assert.equal(clean.prompt, '[REDACTED]');
  assert.match(clean.body, /BUFFER/);
  assert.equal(clean.preview, '[BASE64_REDACTED]');
  assert.equal(clean.nested.apiKey, '[REDACTED]');
});

test('retry policy retries temporary failures and never retries content rejection', async () => {
  assert.equal(isRetryable(appError('MODEL_CONTENT_REJECTED')), false);
  assert.equal(isRetryable(Object.assign(new Error('provider validation failed'), { providerErrorCode: 1007 })), false);
  assert.equal(isRetryable(appError('MODEL_REQUEST_FAILED', '', { retryable: true })), true);
  let calls = 0;
  const result = await withRetry(async () => {
    calls += 1;
    if (calls < 3) throw appError('MODEL_REQUEST_FAILED', 'temporary', { retryable: true });
    return 'ok';
  }, { maxRetries: 3, baseDelayMs: 1 });
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
});

test('error normalization provides stable public codes', () => {
  assert.equal(normalizeError(new Error('permission denied for table projects')).code, 'PERMISSION_DENIED');
  assert.equal(normalizeError(new Error('storage object not found')).code, 'STORAGE_ERROR');
});

test('duplicate task idempotency key returns the existing Task without insert', async () => {
  let inserted = false;
  const existing = { id: 'task-existing', user_id: 'user-1', idempotency_key: 'key-1', status: 'generating' };
  const client = { from() { return {
    select() { return { eq() { return { eq() { return { maybeSingle: async () => ({ data: existing, error: null }) }; } }; } }; },
    insert() { inserted = true; throw new Error('must not insert'); },
  }; } };
  const service = createTaskResultService({ client });
  const task = await service.createTask({ projectId: 'project-1', userId: 'user-1', taskType: 'generate_video', idempotencyKey: 'key-1' });
  assert.equal(task.id, 'task-existing');
  assert.equal(task.idempotent, true);
  assert.equal(inserted, false);
});

test('stability migration defines leases, idempotency, logs and storage audits', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/007_stability_observability.sql'), 'utf8');
  assert.match(sql, /tasks_user_idempotency_unique/i);
  assert.match(sql, /result_assets_task_unique/i);
  assert.match(sql, /claim_task_recovery/i);
  assert.match(sql, /create table if not exists public\.system_logs/i);
  assert.match(sql, /create table if not exists public\.storage_audits/i);
  assert.match(sql, /revoke all on public\.system_logs.*authenticated/is);
});
