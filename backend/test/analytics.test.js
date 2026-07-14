const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createAnalyticsService, safeProperties } = require('../services/analyticsService');
const { createRequireAdmin } = require('../services/adminService');

test('safeProperties removes secrets and full prompt fields', () => {
  assert.deepEqual(safeProperties({ duration: 4, apiKey: 'secret', password: 'x', generated_prompt: 'private', model_name: 'kling' }), {
    duration: 4, model_name: 'kling',
  });
});

test('recordBatch validates names, binds authenticated user and deduplicates by event_id', async () => {
  let captured = null;
  const client = { from(table) { assert.equal(table, 'analytics_events'); return { async upsert(rows, options) { captured = { rows, options }; return { error: null }; } }; } };
  const service = createAnalyticsService({ client });
  const outcome = await service.recordBatch('user-a', [
    { eventId: '11111111-1111-4111-8111-111111111111', eventName: 'page_view', sessionId: 'session-a', properties: { duration: 4, token: 'blocked' } },
    { eventId: 'bad', eventName: 'unknown_event', sessionId: 'session-a' },
  ]);
  assert.equal(outcome.accepted, 1);
  assert.equal(captured.rows[0].user_id, 'user-a');
  assert.deepEqual(captured.rows[0].event_properties, { duration: 4 });
  assert.deepEqual(captured.options, { onConflict: 'event_id', ignoreDuplicates: true });
});

test('requireAdmin rejects ordinary users and accepts configured admins', async () => {
  const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } });
  let nextCalled = false;
  const denied = createRequireAdmin({ serviceFactory: () => ({ getAdmin: async () => null }) });
  const deniedResponse = response();
  await denied({ user: { id: 'user-a' } }, deniedResponse, () => { nextCalled = true; });
  assert.equal(deniedResponse.statusCode, 403);
  assert.equal(nextCalled, false);

  const allowed = createRequireAdmin({ serviceFactory: () => ({ getAdmin: async () => ({ user_id: 'admin-a', role: 'admin' }) }) });
  const request = { user: { id: 'admin-a' } };
  await allowed(request, response(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(request.admin.role, 'admin');
});

test('analytics migration enables RLS, ownership validation, indexes and server-side aggregation', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/006_analytics_admin.sql'), 'utf8');
  assert.match(sql, /create table if not exists public\.analytics_events/i);
  assert.match(sql, /create table if not exists public\.admin_users/i);
  assert.match(sql, /alter table public\.analytics_events enable row level security/i);
  assert.match(sql, /validate_analytics_event_ownership/i);
  assert.match(sql, /analytics_events_name_created_idx/i);
  assert.match(sql, /percentile_cont\(\.9\)/i);
  assert.match(sql, /revoke all on public\.analytics_events from anon, authenticated/i);
});
