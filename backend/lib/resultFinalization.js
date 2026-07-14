function evaluateGenerationFinalization(task, existingResult = null) {
  if (!task) return { action: 'missing' };
  if (task.status === 'cancelled') return { action: 'cancelled' };
  if (task.status === 'timeout') return { action: 'timeout' };
  if (existingResult) return { action: 'existing', result: existingResult };
  return { action: 'create' };
}

module.exports = { evaluateGenerationFinalization };
