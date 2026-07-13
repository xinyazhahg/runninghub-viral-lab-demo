const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

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

async function requestJson(path, options = {}) {
  const response = await fetch(apiUrl(path), options)
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.ok) throw new Error(data?.message || data?.error || '请求失败')
  return data
}

export function getProject(projectId) {
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}`)
}

export function persistOriginalVideo(file, projectId = '') {
  const formData = new FormData()
  formData.append('video', file)
  formData.append('name', file.name || '爆款实验室项目')
  if (projectId) formData.append('projectId', projectId)
  return requestJson('/api/projects/original-video', { method: 'POST', body: formData })
}

export function persistReplacementImage(projectId, file, replacementType) {
  const formData = new FormData()
  formData.append('image', file)
  formData.append('replacementType', replacementType)
  return requestJson(`/api/projects/${encodeURIComponent(projectId)}/assets/replacement`, {
    method: 'POST', body: formData,
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

export function retryTask(taskId) {
  return requestJson(`/api/tasks/${encodeURIComponent(taskId)}/retry`, { method: 'POST' })
}
