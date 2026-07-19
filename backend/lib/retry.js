const NON_RETRYABLE_CODES = new Set(['MODEL_CONTENT_REJECTED','BALANCE_INSUFFICIENT','AUTH_REQUIRED','AUTH_INVALID','AUTH_EXPIRED','PERMISSION_DENIED','TASK_CANCELLED','TASK_STATE_INVALID','FILE_TYPE_NOT_SUPPORTED','FILE_TOO_LARGE']);

function isRetryable(error) {
  if (String(error?.providerErrorCode || '') === '1007' || /errorCode\D*1007|参数无效/i.test(error?.message || '')) return false;
  if (error?.retryable === true) return true;
  if (NON_RETRYABLE_CODES.has(error?.code)) return false;
  return error?.code === 'MODEL_RATE_LIMITED' || error?.code === 'MODEL_REQUEST_FAILED' || /ECONNRESET|ETIMEDOUT|fetch failed|HTTP 429|HTTP 5\d\d/i.test(error?.message || '');
}

async function withRetry(operation, { maxRetries = 3, baseDelayMs = 1000, onRetry = async () => {} } = {}) {
  let attempt = 0;
  while (true) {
    try { return await operation(attempt); }
    catch (error) {
      if (attempt >= maxRetries || !isRetryable(error)) throw error;
      attempt += 1;
      await onRetry(error, attempt);
      const jitter = Math.floor(Math.random() * Math.max(50, baseDelayMs / 4));
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (2 ** (attempt - 1)) + jitter));
    }
  }
}

module.exports = { NON_RETRYABLE_CODES, isRetryable, withRetry };
