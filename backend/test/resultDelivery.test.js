const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { deliverGeneratedResult } = require('../lib/resultDelivery');

function mocks(failAt = '') {
  const calls = [];
  const invoke = (name, value) => async () => {
    calls.push(name);
    if (failAt === name) throw new Error(`${name} failed`);
    return value;
  };
  return {
    calls,
    input: {
      uploadAsset: invoke('uploadAsset', { id: 'asset-1', storage_path: 'result.mp4' }),
      createResult: invoke('createResult', { id: 'result-1', version: 2 }),
      settleBilling: invoke('settleBilling'),
      markSuccess: invoke('markSuccess'),
      deleteAsset: invoke('deleteAsset'),
      deleteResult: invoke('deleteResult'),
    },
  };
}

test('successful delivery settles only after Asset and Result exist', async () => {
  const mock = mocks();
  await deliverGeneratedResult(mock.input);
  assert.deepEqual(mock.calls, ['uploadAsset', 'createResult', 'settleBilling', 'markSuccess']);
});

for (const failure of ['uploadAsset', 'createResult']) {
  test(`${failure} failure never settles credits`, async () => {
    const mock = mocks(failure);
    await assert.rejects(deliverGeneratedResult(mock.input));
    assert.equal(mock.calls.includes('settleBilling'), false);
    if (failure === 'createResult') assert.equal(mock.calls.includes('deleteAsset'), true);
  });
}

test('billing failure after Result creation removes Result and Asset for retry safety', async () => {
  const mock = mocks('settleBilling');
  await assert.rejects(deliverGeneratedResult(mock.input));
  assert.deepEqual(mock.calls, ['uploadAsset', 'createResult', 'settleBilling', 'deleteResult', 'deleteAsset']);
});

test('repeated success callback remains idempotent when persistence dependencies are task-idempotent', async () => {
  const state = { asset: null, result: null, settled: false, completed: false };
  const input = {
    uploadAsset: async () => (state.asset ||= { id: 'asset-1', storage_path: 'result.mp4' }),
    createResult: async () => (state.result ||= { id: 'result-1', version: 2 }),
    settleBilling: async () => { state.settled = true; },
    markSuccess: async () => { state.completed = true; },
    deleteAsset: async () => {}, deleteResult: async () => {},
  };
  const first = await deliverGeneratedResult(input);
  const second = await deliverGeneratedResult(input);
  assert.equal(first.asset, second.asset);
  assert.equal(first.result, second.result);
  assert.equal(state.settled, true);
  assert.equal(state.completed, true);
});

test('billing migration compensates settled failures and makes repeated refunds idempotent', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/010_billing_failure_compensation.sql'), 'utf8');
  assert.match(sql, /charge_tx\.status = 'frozen'/i);
  assert.match(sql, /charge_tx\.status = 'completed'/i);
  assert.match(sql, /billing_status = 'refunded'.*idempotent.*true/is);
  assert.match(sql, /credit_refund_task_unique/i);
  assert.match(sql, /total_consumed = greatest\(total_consumed - charged, 0\)/i);
});
