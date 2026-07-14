const ERROR_DEFINITIONS = {
  AUTH_REQUIRED: [401, '请先登录后继续操作'], AUTH_INVALID: [401, '登录状态已失效，请重新登录'],
  PERMISSION_DENIED: [403, '无权访问该数据'], PROJECT_NOT_FOUND: [404, '项目不存在或已删除'],
  FILE_TOO_LARGE: [413, '文件超过允许的大小限制'], FILE_TYPE_NOT_SUPPORTED: [415, '不支持该文件类型'],
  ASSET_UPLOAD_FAILED: [500, '素材上传失败，请稍后重试'], ASSET_NOT_FOUND: [404, '素材不存在或已被清理'],
  SIGNED_URL_FAILED: [503, '文件播放地址刷新失败，请重试'], TASK_NOT_FOUND: [404, '任务不存在'],
  TASK_DUPLICATE: [409, '该任务已提交，正在恢复已有任务'], TASK_CANCELLED: [409, '任务已取消'],
  TASK_TIMEOUT: [504, '任务处理超时，可稍后重新生成'], TASK_STATE_INVALID: [409, '任务当前状态不允许该操作'],
  MODEL_UNAVAILABLE: [503, '模型服务暂不可用'], MODEL_REQUEST_FAILED: [502, '模型服务请求失败，请稍后重试'],
  MODEL_RATE_LIMITED: [429, '模型请求过于频繁，请稍后重试'], MODEL_CONTENT_REJECTED: [422, '内容未通过模型安全检查，请修改后重试'],
  MODEL_RESULT_INVALID: [502, '模型返回结果无效'], BALANCE_INSUFFICIENT: [402, '积分余额不足'],
  POINTS_FREEZE_FAILED: [500, '积分冻结失败，模型任务尚未提交'], POINTS_CHARGE_FAILED: [500, '积分结算失败，正在等待后台处理'],
  POINTS_REFUND_FAILED: [500, '积分退款失败，正在等待后台处理'], DATABASE_ERROR: [503, '数据服务暂不可用'],
  STORAGE_ERROR: [503, '文件服务暂不可用'], INTERNAL_ERROR: [500, '服务出现异常，请稍后重试'],
};

function appError(code, message, options = {}) {
  const definition = ERROR_DEFINITIONS[code] || ERROR_DEFINITIONS.INTERNAL_ERROR;
  const error = new Error(message || definition[1]);
  error.code = code in ERROR_DEFINITIONS ? code : 'INTERNAL_ERROR';
  error.statusCode = options.statusCode || definition[0];
  error.details = options.details;
  error.retryable = options.retryable === true;
  return error;
}

function normalizeError(error, fallbackCode = 'INTERNAL_ERROR') {
  if (error?.code && ERROR_DEFINITIONS[error.code]) return error;
  const message = String(error?.message || '');
  if (/row-level security|permission denied/i.test(message)) return appError('PERMISSION_DENIED');
  if (/database|postgres|relation .* does not exist/i.test(message)) return appError('DATABASE_ERROR');
  if (/storage|bucket|object not found/i.test(message)) return appError('STORAGE_ERROR');
  return appError(fallbackCode, message || undefined);
}

module.exports = { ERROR_DEFINITIONS, appError, normalizeError };

