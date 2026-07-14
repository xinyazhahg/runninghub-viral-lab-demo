import { authFetch, apiUrl } from './api.js'

const SESSION_KEY = 'viral-lab-analytics-session'
let sessionId = sessionStorage.getItem(SESSION_KEY)
if (!sessionId) {
  sessionId = crypto.randomUUID()
  sessionStorage.setItem(SESSION_KEY, sessionId)
}

let queue = []
let flushTimer = null
let deliveryPaused = false

function flush() {
  if (!queue.length || deliveryPaused) return Promise.resolve()
  const events = queue.splice(0, 30)
  clearTimeout(flushTimer)
  flushTimer = null
  return authFetch(apiUrl('/api/analytics/events'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events }),
  }).then((response) => {
    // 埋点表未迁移或服务异常时暂停本页后续上报，避免用户操作连续产生 500。
    if (response.status >= 500) deliveryPaused = true
  }).catch(() => {
    deliveryPaused = true
  })
}

export function track(eventName, context = {}) {
  queue.push({
    eventId: context.eventId || crypto.randomUUID(), eventName, sessionId,
    projectId: context.projectId || null, taskId: context.taskId || null,
    resultId: context.resultId || null, modelId: context.modelId || null,
    properties: context.properties || {}, page: context.page || location.pathname,
    source: 'web', createdAt: new Date().toISOString(),
  })
  if (queue.length >= 10) void flush()
  else if (!flushTimer) flushTimer = setTimeout(() => void flush(), 800)
}

export function trackOnce(key, eventName, context = {}) {
  const storageKey = `viral-lab-event:${key}`
  if (sessionStorage.getItem(storageKey)) return
  sessionStorage.setItem(storageKey, '1')
  track(eventName, context)
}

export function flushAnalytics() { return flush() }
