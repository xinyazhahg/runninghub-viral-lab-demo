import { clearExpiredSession, getAccessToken } from './auth.js'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const ERROR_MESSAGES = {
  AUTH_REQUIRED: '请先登录后继续操作', AUTH_INVALID: '登录已过期，请重新登录', AUTH_EXPIRED: '登录已过期，请重新登录',
  PERMISSION_DENIED: '无权访问该数据',
  PROJECT_NOT_FOUND: '项目不存在或已删除', FILE_TOO_LARGE: '文件超过大小限制', FILE_TYPE_NOT_SUPPORTED: '不支持该文件类型',
  ASSET_UPLOAD_FAILED: '素材上传失败，请稍后重试', ASSET_NOT_FOUND: '素材不存在或已被清理', SIGNED_URL_FAILED: '播放地址已失效，请重试刷新',
  TASK_NOT_FOUND: '任务不存在', TASK_DUPLICATE: '任务已提交，正在恢复原任务', TASK_CANCELLED: '任务已取消', TASK_TIMEOUT: '任务处理超时，可重新生成',
  VIDEO_ANALYSIS_TIMEOUT: '视频分析超时，请重新尝试',
  TASK_STATE_INVALID: '当前任务状态不允许该操作', MODEL_UNAVAILABLE: '模型服务暂不可用', MODEL_REQUEST_FAILED: '模型服务请求失败，请稍后重试',
  MODEL_RATE_LIMITED: '请求过于频繁，请稍后重试', MODEL_CONTENT_REJECTED: '内容未通过审核，请调整后重试', MODEL_RESULT_INVALID: '模型结果无效',
  BALANCE_INSUFFICIENT: '积分余额不足', POINTS_FREEZE_FAILED: '积分冻结失败，任务尚未提交', POINTS_CHARGE_FAILED: '积分结算失败，后台处理中',
  POINTS_REFUND_FAILED: '积分退款失败，后台处理中', DATABASE_ERROR: '数据服务暂不可用', STORAGE_ERROR: '文件服务暂不可用', INTERNAL_ERROR: '服务异常，请稍后重试',
}

export class ApiError extends Error {
  constructor(code, message, requestId, status) {
    super(message || ERROR_MESSAGES[code] || '请求失败')
    this.name = 'ApiError'; this.code = code || 'INTERNAL_ERROR'; this.requestId = requestId || ''; this.status = status || 0
  }
}

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

export function toBackendUrl(url) {
  if (!url || /^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
    return url || ''
  }
  return apiUrl(url)
}

const EXPIRED_AUTH_CODES = new Set(['AUTH_REQUIRED', 'AUTH_INVALID', 'AUTH_EXPIRED'])
let authExpiryHandled = false

async function expireCurrentSession(message = ERROR_MESSAGES.AUTH_EXPIRED) {
  if (!authExpiryHandled) {
    authExpiryHandled = true
    await clearExpiredSession()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('viral-lab:auth-expired', { detail: { message } }))
    }
  }
  throw new ApiError('AUTH_EXPIRED', message, '', 401)
}

export async function authFetch(url, options = {}) {
  let token = ''
  try {
    token = await getAccessToken()
  } catch (error) {
    if (error?.code === 'AUTH_EXPIRED' || [401, 403].includes(Number(error?.status))) {
      return expireCurrentSession()
    }
    throw error
  }
  if (!token) return expireCurrentSession()
  authExpiryHandled = false
  const headers = new Headers(options.headers || {})
  headers.set('Authorization', `Bearer ${token}`)
  if (!headers.has('X-Request-ID')) headers.set('X-Request-ID', crypto.randomUUID())
  const response = await fetch(url, { ...options, headers })
  if ([401, 403].includes(response.status)) {
    const data = await response.clone().json().catch(() => null)
    const code = data?.code || data?.error || ''
    if (EXPIRED_AUTH_CODES.has(code)) {
      return expireCurrentSession(data?.message || ERROR_MESSAGES.AUTH_EXPIRED)
    }
  }
  return response
}

async function requestJson(path, options = {}) {
  const { timeoutMs = 20_000, ...fetchOptions } = options
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await authFetch(apiUrl(path), { ...fetchOptions, signal: fetchOptions.signal || controller.signal })
    const data = await response.json().catch(() => null)
    if (!response.ok || !data?.ok) {
      const code = data?.code || data?.error || 'INTERNAL_ERROR'
      const requestId = data?.requestId || response.headers.get('X-Request-ID') || ''
      const message = data?.message || ERROR_MESSAGES[code] || '请求失败'
      throw new ApiError(code, `${message}${requestId ? `（请求编号：${requestId}）` : ''}`, requestId, response.status)
    }
    return data
  } catch (error) {
    if (error?.name === 'AbortError') throw new ApiError('TASK_TIMEOUT', '请求超时，请检查网络后重试', '', 504)
    if (error instanceof TypeError && /fetch|network/i.test(error.message || '')) throw new ApiError('INTERNAL_ERROR', '后端服务暂时不可用，请稍后重试', '', 503)
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export function getProject(projectId) {
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}`)
}

export function getCurrentUser() {
  return requestJson('/api/me')
}

export function getProjects() {
  return requestJson('/api/projects')
}

export function deleteProject(projectId) {
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' })
}

export function persistOriginalVideo(file, projectId = '') {
  const formData = new FormData()
  formData.append('video', file)
  formData.append('name', file.name || '爆款实验室项目')
  if (projectId) formData.append('projectId', projectId)
  return requestJson('/api/projects/original-video', { method: 'POST', body: formData, timeoutMs: 180_000 })
}

export function persistReplacementImage(projectId, file, replacementType) {
  const formData = new FormData()
  formData.append('image', file)
  formData.append('replacementType', replacementType)
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}/assets/replacement`, {
    method: 'POST', body: formData, timeoutMs: 120_000,
  })
}

export function persistReferenceAsset(projectId, file, assetType, binding = {}) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('assetType', assetType)
  formData.append('mimeType', file.type || '')
  formData.append('purpose', binding.purpose || 'general_reference')
  formData.append('assetRef', binding.assetRef || '')
  formData.append('targetPlaceholderId', binding.targetPlaceholderId || '')
  formData.append('confidence', String(binding.confidence ?? 0.5))
  const endpoint = `/api/projects/${encodeURIComponent(projectId)}/assets/reference`
  console.info('[reference-upload] request', {
    method: 'POST', endpoint, fileName: file.name, fileType: file.type || '', assetType,
    purpose: binding.purpose || 'general_reference', formDataFields: [...formData.keys()],
  })
  return requestJson(endpoint, {
    method: 'POST', body: formData, timeoutMs: 180_000,
  })
}

export function updateProjectAssetBinding(projectId, assetId, binding) {
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/binding`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(binding || {}),
  })
}

export function deleteProjectAsset(projectId, assetId) {
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`, {
    method: 'DELETE',
  })
}

export function getProjectTasks(projectId) {
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}/tasks`)
}

export function getTask(taskId) {
  return requestJson(`/api/tasks/${encodeURIComponent(taskId)}`)
}

export function getProjectResults(projectId) {
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}/results`)
}

export function getGenerationConfig() {
  return requestJson('/api/generate-config')
}

export function retryTask(taskId) {
  return requestJson(`/api/tasks/${encodeURIComponent(taskId)}/retry`, { method: 'POST' })
}

export function getBillingAccount() {
  return requestJson('/api/billing/account')
}

export function getBillingTransactions(limit = 50) {
  return requestJson(`/api/billing/transactions?limit=${encodeURIComponent(limit)}`)
}

function queryString(params) {
  const query = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => { if (value !== '' && value !== null && value !== undefined) query.set(key, value) })
  return query.toString()
}

export function getAdminOverview(filters = {}) {
  return requestJson(`/api/admin/analytics/overview?${queryString(filters)}`)
}

export function getAdminTasks(filters = {}) {
  return requestJson(`/api/admin/analytics/tasks?${queryString(filters)}`)
}

export function getStabilityStatus() { return requestJson('/api/admin/stability/status') }
export function scanStorage() { return requestJson('/api/admin/stability/storage-scan', { method: 'POST', timeoutMs: 120_000 }) }
export function resolveStorageAudit(auditId, action) {
  return requestJson(`/api/admin/stability/storage-audits/${encodeURIComponent(auditId)}/resolve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
  })
}
