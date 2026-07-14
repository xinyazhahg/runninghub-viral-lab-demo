const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateGenerationFinalization } = require('../lib/resultFinalization');

test('cancelled Task is never eligible to create a Result', () => {
  assert.equal(evaluateGenerationFinalization({ id: 'task-1', status: 'cancelled' }).action, 'cancelled');
});

test('late success for a timeout Task is ignored', () => {
  assert.equal(evaluateGenerationFinalization({ id: 'task-timeout', status: 'timeout' }).action, 'timeout');
});

test('existing Result makes repeated completion idempotent', () => {
  const result = { id: 'result-1', task_id: 'task-1', version: 1 };
  const decision = evaluateGenerationFinalization({ id: 'task-1', status: 'generating' }, result);
  assert.equal(decision.action, 'existing');
  assert.equal(decision.result, result);
});

test('active Task without a Result can enter finalization', () => {
  assert.equal(evaluateGenerationFinalization({ id: 'task-1', status: 'generating' }).action, 'create');
});
