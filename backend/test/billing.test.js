const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { calculateCreditCost, failureChargeRatio } = require('../lib/billingRules');
const { createBillingService } = require('../services/billingService');

const rule = {
  enabled: true, base_credits: 1, per_second_credits: 0.5, provider_to_credit_rate: 10,
  resolution_coefficients: { '720p': 1, '1080p': 1.3 }, duration_coefficients: { '4': 1, '10': 1.1 },
  sale_factor: 1, failure_charge_ratio: 0.2,
};

test('credit quote uses provider cost and configured model factors', () => {
  assert.equal(calculateCreditCost({ costRule: rule, providerCost: 0.2, duration: 4, resolution: '720p', aspectRatio: '9:16' }), 5);
  assert.equal(calculateCreditCost({ costRule: rule, providerCost: 0.2, duration: 10, resolution: '1080p', aspectRatio: '9:16' }), 11.44);
});

test('failure without external task is free and accepted provider task uses configured ratio', () => {
  assert.equal(failureChargeRatio({ externalTaskId: '', costRule: rule }), 0);
  assert.equal(failureChargeRatio({ externalTaskId: 'external-1', costRule: rule }), 0.2);
});

test('billing service delegates freeze and settle to task-idempotent RPCs', async () => {
  const calls = [];
  const client = { async rpc(name, payload) { calls.push([name, payload]); return { data: { idempotent: false }, error: null }; } };
  const service = createBillingService({ client });
  await service.freezeTask({ taskId: 'task-1', userId: 'user-1', creditCost: 5, providerCost: 0.2 });
  await service.settleTask({ taskId: 'task-1', userId: 'user-1', creditCost: 4.5, providerCost: 0.18 });
  assert.equal(calls[0][0], 'freeze_task_credits');
  assert.equal(calls[0][1].p_task_id, 'task-1');
  assert.equal(calls[1][0], 'settle_task_credits');
});

test('billing migration enforces nonnegative balances, owner isolation, and task idempotency', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/005_credit_billing.sql'), 'utf8');
  assert.match(sql, /balance numeric\(14,2\).*check \(balance >= 0\)/i);
  assert.match(sql, /credit_generation_task_unique/i);
  assert.match(sql, /freeze_task_credits/i);
  assert.match(sql, /settle_task_credits/i);
  assert.match(sql, /auth\.uid\(\) = user_id/i);
  assert.match(sql, /signup_bonus/i);
});
