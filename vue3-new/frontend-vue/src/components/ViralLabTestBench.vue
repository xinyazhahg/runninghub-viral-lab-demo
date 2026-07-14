<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { apiUrl, authFetch, toBackendUrl } from '../api.js'
import { cleanBreakdownResult } from '../utils/cleanBreakdown.js'

const TEST_BENCH_STATE_KEY = 'viral-lab-test-bench-state:v1'
const HISTORY_VIDEO_EXPIRED_MESSAGE = '历史视频地址已失效，请重新生成'
let suppressTestBenchPersist = false

const videoFile = ref(null)
const selectedVideoInfo = ref({
  name: '',
  size: 0,
  sizeText: '',
  previewStatus: '',
})
const videoPreviewUrl = ref('')
const videoToTextRaw = ref(null)
const parsedBreakdown = ref(null)
const extraPromptRequirement = ref('')
const generatedPrompt = ref('')
const generateResult = ref({
  taskId: '',
  status: '',
  cost: '',
  videoUrl: '',
  raw: null,
})
const generationRun = ref({
  phase: '',
  elapsed: '0秒',
  taskId: '',
  status: '',
})
const logs = ref([])
const isTestingVideoToText = ref(false)
const isTestingGenerateVideo = ref(false)
const benchMessage = ref('')
let generationRunTimer = null

const prettyVideoToTextJson = computed(() => {
  if (!videoToTextRaw.value) return '等待 video-to-text 返回结果'
  return JSON.stringify(videoToTextRaw.value, null, 2)
})

const replaceableGroups = computed(() => {
  const data = parsedBreakdown.value || {}
  return [
    { label: '可替换主体', items: getReplaceableList(data, ['replaceableSubjects', 'subjects']) },
    { label: '可替换场景', items: getReplaceableList(data, ['replaceableScenes', 'scenes']) },
    { label: '可替换元素', items: getReplaceableList(data, ['replaceableElements', 'elements']) },
    { label: '可替换文字', items: getReplaceableList(data, ['replaceableText', 'texts', 'copy']) },
  ]
})

const canGeneratePrompt = computed(() => Boolean(parsedBreakdown.value))
const hasReplaceableItems = computed(() =>
  replaceableGroups.value.some((group) => group.items.length > 0)
)

function toList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean)
  }
  return []
}

function getReplaceableList(data, keys) {
  const overview = data?.overview || {}
  for (const key of keys) {
    const list = toList(overview[key])
    if (list.length) return list
  }
  for (const key of keys) {
    const list = toList(data?.[key])
    if (list.length) return list
  }
  return []
}

function addLog(step, status, detail = '', elapsed = null) {
  logs.value.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    step,
    status,
    detail,
    elapsed,
  })
}

function showBenchMessage(message) {
  benchMessage.value = message
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeParseStorage(rawValue) {
  if (!rawValue) return null
  try {
    const parsed = JSON.parse(rawValue)
    return isPlainObject(parsed) ? parsed : null
  } catch {
    return null
  }
}

function safeLoadState(key) {
  if (typeof localStorage === 'undefined') return null
  try {
    const parsed = safeParseStorage(localStorage.getItem(key))
    if (!parsed) {
      localStorage.removeItem(key)
      return null
    }
    return parsed
  } catch (error) {
    console.warn('测试台状态读取失败，已清除缓存：', error)
    try {
      localStorage.removeItem(key)
    } catch (removeError) {
      console.warn('测试台状态缓存清除失败：', removeError)
    }
    return null
  }
}

function asObjectOrNull(value) {
  return isPlainObject(value) ? value : null
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function asString(value) {
  return typeof value === 'string' ? value : ''
}

function asNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function normalizeRestoredLogs(value) {
  return asArray(value).filter(isPlainObject).map((log) => ({
    id: asString(log.id) || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: asString(log.time),
    step: asString(log.step),
    status: asString(log.status) || 'unknown',
    detail: asString(log.detail),
    elapsed: asString(log.elapsed) || null,
  }))
}

function normalizeGenerationPhase(status = '', videoUrl = '', fallbackPhase = '') {
  const safeStatus = String(status || '').toLowerCase()
  if (safeStatus === 'success' || safeStatus === 'ok' || videoUrl) return '生成成功'
  if (safeStatus === 'running') return '生成中'
  if (safeStatus === 'failed' || safeStatus === 'error') return '生成失败'
  if (safeStatus === 'timeout') return '生成超时'
  return fallbackPhase || ''
}

function getTestBenchSnapshot() {
  return {
    selectedVideoInfo: selectedVideoInfo.value,
    videoToTextRaw: videoToTextRaw.value,
    parsedBreakdown: parsedBreakdown.value,
    replaceableGroups: replaceableGroups.value,
    extraPromptRequirement: extraPromptRequirement.value,
    generatedPrompt: generatedPrompt.value,
    generateResult: generateResult.value,
    generationRun: generationRun.value,
    logs: logs.value,
    benchMessage: benchMessage.value,
    savedAt: Date.now(),
  }
}

function persistTestBenchState() {
  // 阶段6第一轮不再把测试台业务数据写入 localStorage。
}

function restoreTestBenchState() {
  const saved = safeLoadState(TEST_BENCH_STATE_KEY)
  if (!saved) return

  try {
    const restoredVideo = asObjectOrNull(saved.selectedVideoInfo)
    selectedVideoInfo.value = {
      name: asString(restoredVideo?.name),
      size: asNumber(restoredVideo?.size),
      sizeText: asString(restoredVideo?.sizeText),
      previewStatus: asString(restoredVideo?.previewStatus) || (
        restoredVideo?.name ? '历史视频文件未持久化，请重新选择本地视频后继续请求接口' : ''
      ),
    }

    const restoredVideoToText = asObjectOrNull(saved.videoToTextRaw)
    videoToTextRaw.value = restoredVideoToText

    const restoredBreakdown = asObjectOrNull(saved.parsedBreakdown)
    parsedBreakdown.value = cleanBreakdownResult(
      restoredBreakdown || parseBreakdownFromApiData(restoredVideoToText) || null
    )

    extraPromptRequirement.value = asString(saved.extraPromptRequirement)
    generatedPrompt.value = asString(saved.generatedPrompt)

    const restoredGenerateResult = asObjectOrNull(saved.generateResult)
    generateResult.value = {
      taskId: asString(restoredGenerateResult?.taskId),
      status: asString(restoredGenerateResult?.status),
      cost: asString(restoredGenerateResult?.cost),
      videoUrl: asString(restoredGenerateResult?.videoUrl),
      raw: asObjectOrNull(restoredGenerateResult?.raw),
    }

    const restoredGenerationRun = asObjectOrNull(saved.generationRun)
    const restoredRunStatus = asString(restoredGenerationRun?.status) || generateResult.value.status
    const restoredRunPhase = normalizeGenerationPhase(
      restoredRunStatus,
      generateResult.value.videoUrl,
      asString(restoredGenerationRun?.phase)
    )
    generationRun.value = {
      phase: restoredRunPhase,
      elapsed: asString(restoredGenerationRun?.elapsed) || '0秒',
      taskId: asString(restoredGenerationRun?.taskId),
      status: restoredRunStatus,
    }

    logs.value = normalizeRestoredLogs(saved.logs)
    benchMessage.value = asString(saved.benchMessage)
  } catch (error) {
    console.warn('测试台状态恢复失败，已清除缓存：', error)
    try {
      localStorage.removeItem(TEST_BENCH_STATE_KEY)
    } catch {}
  }
}

function clearTestBenchState() {
  suppressTestBenchPersist = true
  if (videoPreviewUrl.value) URL.revokeObjectURL(videoPreviewUrl.value)

  videoFile.value = null
  selectedVideoInfo.value = {
    name: '',
    size: 0,
    sizeText: '',
    previewStatus: '',
  }
  videoPreviewUrl.value = ''
  videoToTextRaw.value = null
  parsedBreakdown.value = null
  extraPromptRequirement.value = ''
  generatedPrompt.value = ''
  generateResult.value = {
    taskId: '',
    status: '',
    cost: '',
    videoUrl: '',
    raw: null,
  }
  generationRun.value = {
    phase: '',
    elapsed: '0秒',
    taskId: '',
    status: '',
  }
  logs.value = []
  benchMessage.value = '当前状态已清空'

  setTimeout(() => {
    suppressTestBenchPersist = false
  }, 0)
}

function canAccessVideoUrl(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false)
      return
    }

    const video = document.createElement('video')
    const timer = setTimeout(() => {
      cleanup()
      resolve(false)
    }, 5000)

    const cleanup = () => {
      clearTimeout(timer)
      video.removeAttribute('src')
      video.load()
    }

    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () => {
      cleanup()
      resolve(true)
    }
    video.onerror = () => {
      cleanup()
      resolve(false)
    }
    video.src = url
  })
}

function formatDurationMs(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes ? `${minutes}分${String(seconds).padStart(2, '0')}秒` : `${seconds}秒`
}

function startGenerationRunTimer(startTime) {
  stopGenerationRunTimer()
  generationRun.value.elapsed = '0秒'
  generationRunTimer = setInterval(() => {
    generationRun.value = {
      ...generationRun.value,
      elapsed: formatDurationMs(Date.now() - startTime),
    }
  }, 1000)
}

function stopGenerationRunTimer() {
  if (generationRunTimer) {
    clearInterval(generationRunTimer)
    generationRunTimer = null
  }
}

async function verifyRestoredTestBenchVideoUrl() {
  if (!generateResult.value.videoUrl) return
  const ok = await canAccessVideoUrl(generateResult.value.videoUrl)
  if (ok) return

  generateResult.value = {
    ...generateResult.value,
    status: HISTORY_VIDEO_EXPIRED_MESSAGE,
    videoUrl: '',
  }
  benchMessage.value = HISTORY_VIDEO_EXPIRED_MESSAGE
}

function formatElapsed(startTime) {
  return `${((performance.now() - startTime) / 1000).toFixed(2)}s`
}

function resetResultState() {
  videoToTextRaw.value = null
  parsedBreakdown.value = null
  generatedPrompt.value = ''
  generateResult.value = {
    taskId: '',
    status: '',
    cost: '',
    videoUrl: '',
    raw: null,
  }
}

function onVideoChange(event) {
  const file = event.target.files?.[0]
  if (!file) return

  if (videoPreviewUrl.value) URL.revokeObjectURL(videoPreviewUrl.value)
  videoFile.value = file
  selectedVideoInfo.value = {
    name: file.name,
    size: file.size,
    sizeText: formatFileSize(file.size),
    previewStatus: '已选择本地视频，本次会话可预览和请求接口',
  }
  videoPreviewUrl.value = URL.createObjectURL(file)
  resetResultState()
  addLog('选择视频', 'success', `${file.name} · ${formatFileSize(file.size)}`)
}

function formatFileSize(bytes = 0) {
  if (!bytes) return '0MB'
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

async function readResponse(response) {
  const rawText = await response.text()
  try {
    return rawText ? JSON.parse(rawText) : null
  } catch {
    return { ok: false, message: '响应不是合法 JSON', rawText }
  }
}

function parseBreakdownFromApiData(data) {
  const result = data?.result
  if (isPlainObject(result)) return cleanBreakdownResult(result)

  const text = String(result || data?.rawText || '')
  const jsonStart = text.indexOf('{')
  const jsonEnd = text.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd <= jsonStart) return null

  try {
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1))
    return isPlainObject(parsed) ? cleanBreakdownResult(parsed) : null
  } catch {
    return null
  }
}

async function testVideoToText() {
  if (isTestingVideoToText.value) return
  if (!videoFile.value) {
    showBenchMessage('请先上传视频')
    addLog('video-to-text', 'failed', '请先上传视频')
    return
  }

  const startTime = performance.now()
  const deadline = Date.now() + 3 * 60 * 1000
  isTestingVideoToText.value = true
  showBenchMessage('')
  addLog('video-to-text', 'running', '开始请求 /api/video-to-text')

  try {
    const formData = new FormData()
    formData.append('video', videoFile.value)

    const response = await authFetch(apiUrl('/api/video-to-text'), {
      method: 'POST',
      body: formData,
    })
    let data = await readResponse(response)

    if (!response.ok || !data?.ok) {
      throw new Error(data?.message || data?.error || data?.rawText || 'video-to-text 请求失败')
    }

    const taskId = data.taskId
    if (!taskId) throw new Error('后端未返回视频拆解任务 taskId')

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 4000))
      const statusResponse = await authFetch(
        apiUrl(`/api/video-to-text-status?taskId=${encodeURIComponent(taskId)}`)
      )
      data = await readResponse(statusResponse)
      if (!statusResponse.ok || !data?.ok) {
        throw new Error(data?.message || data?.error || data?.rawText || '查询视频拆解任务失败')
      }
      if (data.status === 'success') break
      if (data.status === 'failed') throw new Error(data.error || '视频拆解失败')
    }

    if (data.status !== 'success') {
      const timeoutError = new Error('视频拆解超时，请稍后重试')
      timeoutError.name = 'VideoToTextTimeoutError'
      throw timeoutError
    }

    videoToTextRaw.value = data

    parsedBreakdown.value = parseBreakdownFromApiData(data)
    if (!parsedBreakdown.value) {
      addLog('替换项解析', 'warning', '接口成功，但 result 中没有解析到标准拆解 JSON')
    } else {
      if (!hasReplaceableItems.value) {
        showBenchMessage('未识别到可替换项，可更换视频或手动输入生成要求')
        addLog('替换项解析', 'warning', '未识别到可替换项，可更换视频或手动输入生成要求')
      } else {
        addLog('替换项解析', 'success', '已提取主体、场景、元素、文字')
      }
    }

    buildPrompt()
    addLog('video-to-text', 'success', '请求完成', formatElapsed(startTime))
  } catch (error) {
    const message = error.name === 'VideoToTextTimeoutError'
      ? '视频拆解超时，请稍后重试'
      : `视频拆解失败：${error.message || '请稍后重试'}`
    showBenchMessage(message)
    addLog('video-to-text', 'failed', message, formatElapsed(startTime))
  } finally {
    isTestingVideoToText.value = false
  }
}

function buildPrompt() {
  const data = parsedBreakdown.value
  if (!data) {
    const extra = extraPromptRequirement.value.trim()
    generatedPrompt.value = extra
      ? `【补充生成要求】\n${extra}\n\n【执行要求】\n根据补充要求生成测试视频。画面真实自然，动作连贯，镜头稳定，不要生成无关字幕、水印或额外文字。`
      : ''
    if (generatedPrompt.value) {
      showBenchMessage('')
      addLog('Prompt 生成', 'success', '已根据手动输入生成 Prompt')
    }
    return
  }

  const shots = Array.isArray(data.shots) ? data.shots : []
  const shotText = shots.length
    ? shots.map((shot, index) => {
        const time = shot.time || `镜头${index + 1}`
        const title = shot.title || `镜头${index + 1}`
        const description = shot.description || '保留参考视频画面结构。'
        const action = shot.action ? `动作：${shot.action}。` : ''
        const camera = shot.camera ? `镜头：${shot.camera}。` : ''
        return `${time}：${title}。${description}${action}${camera}`
      }).join('\n')
    : '按参考视频原有镜头结构生成，保持人物动作、镜头节奏和场景关系。'

  const subjectText = getReplaceableList(data, ['replaceableSubjects', 'subjects']).join('、') || '保持原主体'
  const sceneText = getReplaceableList(data, ['replaceableScenes', 'scenes']).join('、') || '保持原场景'
  const elementText = getReplaceableList(data, ['replaceableElements', 'elements']).join('、') || '保持核心元素'
  const copyText = getReplaceableList(data, ['replaceableText', 'texts', 'copy']).join('、') || '不新增无关文字'
  const extra = extraPromptRequirement.value.trim()

  generatedPrompt.value = `【参考视频结构】
${shotText}

【可替换内容】
主体：${subjectText}
场景：${sceneText}
元素：${elementText}
文字：${copyText}

【生成要求】
根据参考视频拆解结构生成新视频。保持原视频的镜头顺序、人物动作节奏、场景关系、画面氛围和运镜方式；只按测试要求替换指定内容，未修改内容保持原样。画面真实自然，动作连贯，镜头稳定，不要生成无关字幕、水印或额外文字。${extra ? `\n\n【补充生成要求】\n${extra}` : ''}`

  addLog('Prompt 生成', 'success', '已刷新生成 Prompt')
}

function captureVideoFrame() {
  return new Promise((resolve, reject) => {
    if (!videoPreviewUrl.value) {
      reject(new Error('请先选择视频文件'))
      return
    }

    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.src = videoPreviewUrl.value

    video.onerror = () => reject(new Error('视频首帧读取失败'))
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.8, Math.max(0, (video.duration || 1) - 0.1))
    }
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 720
        canvas.height = video.videoHeight || 1280
        const context = canvas.getContext('2d')
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('视频首帧转图片失败'))
            return
          }
          resolve(new File([blob], 'viral-lab-test-frame.jpg', { type: 'image/jpeg' }))
        }, 'image/jpeg', 0.9)
      } catch (error) {
        reject(error)
      }
    }
  })
}

function findValueByKey(value, keys) {
  if (!value) return ''
  if (typeof value === 'string') return ''
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findValueByKey(item, keys)
      if (found) return found
    }
    return ''
  }
  if (typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (keys.includes(key) && value[key] !== undefined && value[key] !== null) {
        return String(value[key])
      }
      const found = findValueByKey(value[key], keys)
      if (found) return found
    }
  }
  return ''
}

function findVideoUrl(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    const outputFileMatch = value.match(/OUTPUT_FILE:\s*(\/[^\s]+\.mp4)/)
    if (outputFileMatch) {
      const filename = outputFileMatch[1].split('/').pop()
      return toBackendUrl(`/generated/${filename}?t=${Date.now()}`)
    }
    const directMatch = value.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/)
    if (directMatch) return directMatch[0]
    if (value.includes('.mp4')) return toBackendUrl(value)
    return ''
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findVideoUrl(item)
      if (found) return found
    }
  }
  if (typeof value === 'object') {
    for (const key of Object.keys(value)) {
      const found = findVideoUrl(value[key])
      if (found) return found
    }
  }
  return ''
}

function normalizeGenerateResult(data) {
  const result = data?.result
  let parsedResult = null
  if (typeof result === 'string') {
    const jsonStart = result.indexOf('{')
    const jsonEnd = result.lastIndexOf('}')
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      try {
        parsedResult = JSON.parse(result.slice(jsonStart, jsonEnd + 1))
      } catch {
        parsedResult = null
      }
    }
  } else if (typeof result === 'object') {
    parsedResult = result
  }

  const source = parsedResult || data || {}
  return {
    taskId: data?.taskId || findValueByKey(source, ['taskId', 'task_id', 'id']),
    status: findValueByKey(source, ['status', 'state']) || (data?.ok ? 'ok' : ''),
    cost: findValueByKey(source, ['cost', 'creditCost', 'credits', 'consume']),
    videoUrl: findVideoUrl(data),
    raw: data,
  }
}

async function testGenerateVideo() {
  if (isTestingGenerateVideo.value) return
  if (!generatedPrompt.value) buildPrompt()
  if (!generatedPrompt.value) {
    showBenchMessage('请先生成 Prompt 或填写生成要求')
    addLog('generate-video', 'failed', '请先生成 Prompt 或填写生成要求')
    return
  }

  const startTime = performance.now()
  const startDate = Date.now()
  const deadline = startDate + 5 * 60 * 1000
  isTestingGenerateVideo.value = true
  showBenchMessage('')
  generationRun.value = {
    phase: '任务提交中',
    elapsed: '0秒',
    taskId: '',
    status: 'running',
  }
  startGenerationRunTimer(startDate)
  addLog('generate-video', 'running', '开始抽取首帧并请求 /api/generate-video')

  try {
    const imageFile = await captureVideoFrame()
    const formData = new FormData()
    formData.append('image', imageFile)
    formData.append('prompt', generatedPrompt.value)
    formData.append('duration', '10')
    formData.append('aspectRatio', '9:16')

    const response = await authFetch(apiUrl('/api/generate-video'), {
      method: 'POST',
      body: formData,
    })
    generationRun.value = {
      ...generationRun.value,
      phase: '生成中',
    }
    let data = await readResponse(response)

    if (!response.ok || !data?.ok) {
      generateResult.value = { taskId: '', status: 'failed', cost: '', videoUrl: '', raw: data }
      throw new Error(data?.message || data?.error || data?.rawText || 'generate-video 请求失败')
    }

    const taskId = data.taskId
    if (!taskId) throw new Error('后端未返回生成任务 taskId')
    generationRun.value = {
      ...generationRun.value,
      phase: '生成中',
      taskId,
    }

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 4000))
      const statusResponse = await authFetch(
        apiUrl(`/api/generate-status?taskId=${encodeURIComponent(taskId)}`)
      )
      data = await readResponse(statusResponse)
      if (!statusResponse.ok || !data?.ok) {
        throw new Error(data?.message || data?.error || data?.rawText || '查询生成任务失败')
      }
      generationRun.value = {
        ...generationRun.value,
        elapsed: `${data.elapsed || 0}秒`,
        status: data.status,
      }
      if (data.status === 'success') break
      if (data.status === 'failed') throw new Error(data.error || '视频生成失败')
    }

    if (data.status !== 'success') {
      const timeoutError = new Error('生成超时，请稍后查看任务状态或重新生成')
      timeoutError.name = 'GenerationTimeoutError'
      throw timeoutError
    }

    generateResult.value = normalizeGenerateResult(data)
    if (!generateResult.value.videoUrl) {
      const message = '生成成功但未返回视频地址，请检查后端返回字段'
      showBenchMessage(message)
      generationRun.value = {
        ...generationRun.value,
        phase: normalizeGenerationPhase('failed'),
        status: 'failed',
      }
      addLog('generate-video', 'failed', message, formatElapsed(startTime))
      return
    }

    generationRun.value = {
      ...generationRun.value,
      phase: normalizeGenerationPhase('success', generateResult.value.videoUrl),
      elapsed: formatElapsed(startTime),
      taskId: generateResult.value.taskId,
      status: 'success',
    }
    addLog('generate-video', 'success', '请求完成', formatElapsed(startTime))
  } catch (error) {
    const isTimeout = error.name === 'GenerationTimeoutError'
    const message = isTimeout
      ? '生成超时，请稍后查看任务状态或重新生成'
      : error.message || 'generate-video 请求失败'
    generationRun.value = {
      ...generationRun.value,
      phase: normalizeGenerationPhase(isTimeout ? 'timeout' : 'failed'),
      status: isTimeout ? 'timeout' : 'failed',
    }
    generateResult.value = {
      ...generateResult.value,
      status: generationRun.value.status,
      taskId: generationRun.value.taskId || generateResult.value.taskId,
    }
    showBenchMessage(message)
    addLog('generate-video', 'failed', message, formatElapsed(startTime))
  } finally {
    stopGenerationRunTimer()
    isTestingGenerateVideo.value = false
  }
}

onMounted(() => {
  verifyRestoredTestBenchVideoUrl()
})

onBeforeUnmount(() => {
  if (videoPreviewUrl.value) URL.revokeObjectURL(videoPreviewUrl.value)
  stopGenerationRunTimer()
})
</script>

<template>
  <section class="test-bench">
    <header class="bench-header">
      <div>
        <p class="eyebrow">Viral Lab Test Bench</p>
        <h1>爆款实验室链路测试台</h1>
      </div>
      <div class="bench-actions">
        <button class="clear-bench-button" type="button" @click="clearTestBenchState">
          清空当前状态
        </button>
        <span class="bench-badge">video-to-text / Prompt / RunningHub</span>
      </div>
    </header>

    <p v-if="benchMessage" class="bench-message">{{ benchMessage }}</p>

    <div class="bench-grid">
      <section class="bench-panel upload-panel">
        <div class="panel-title">
          <strong>视频上传</strong>
          <span>选择本地视频文件</span>
        </div>
        <label class="upload-drop">
          <input type="file" accept="video/*" @change="onVideoChange" />
          <span class="upload-icon">+</span>
          <strong>{{ videoFile?.name || selectedVideoInfo.name || '点击选择视频' }}</strong>
          <small>
            {{
              videoFile
                ? formatFileSize(videoFile.size)
                : selectedVideoInfo.name
                  ? `${selectedVideoInfo.sizeText || '历史视频'} · ${selectedVideoInfo.previewStatus}`
                  : '用于测试 video-to-text 和生成链路'
            }}
          </small>
        </label>
        <video
          v-if="videoPreviewUrl"
          class="preview-video"
          :src="videoPreviewUrl"
          controls
          playsinline
        />
        <button
          class="primary-button"
          type="button"
          :disabled="isTestingVideoToText"
          @click="testVideoToText"
        >
          {{ isTestingVideoToText ? '测试中...' : '测试 video-to-text' }}
        </button>
      </section>

      <section class="bench-panel">
        <div class="panel-title">
          <strong>完整 JSON</strong>
          <span>/api/video-to-text 返回</span>
        </div>
        <pre class="json-view">{{ prettyVideoToTextJson }}</pre>
      </section>

      <section class="bench-panel replace-panel">
        <div class="panel-title">
          <strong>可替换项</strong>
          <span>从拆解 JSON 提取</span>
        </div>
        <div class="replace-groups">
          <p v-if="parsedBreakdown && !hasReplaceableItems" class="empty-replace-tip">
            未识别到可替换项，可更换视频或手动输入生成要求
          </p>
          <div v-for="group in replaceableGroups" :key="group.label" class="replace-group">
            <h2>{{ group.label }}</h2>
            <div v-if="group.items.length" class="chips">
              <span v-for="item in group.items" :key="item" class="chip">{{ item }}</span>
            </div>
            <p v-else>{{ group.label === '可替换元素' ? '暂无高价值可替换元素' : '暂无数据' }}</p>
          </div>
        </div>
      </section>

      <section class="bench-panel prompt-panel">
        <div class="panel-title">
          <strong>生成 Prompt 测试</strong>
          <span>输入补充生成要求</span>
        </div>
        <textarea
          v-model="extraPromptRequirement"
          class="prompt-input"
          placeholder="例如：把主体换成柯基，场景换成便利店门口，保持原镜头节奏。"
          @input="canGeneratePrompt || generatedPrompt ? buildPrompt() : undefined"
        />
        <button
          class="secondary-button"
          type="button"
          :disabled="!canGeneratePrompt"
          @click="buildPrompt"
        >
          生成 Prompt 测试
        </button>
        <pre class="prompt-output">{{ generatedPrompt || '等待生成 Prompt' }}</pre>
      </section>

      <section class="bench-panel result-panel">
        <div class="panel-title">
          <strong>视频生成结果</strong>
          <span>/api/generate-video 返回</span>
        </div>
        <button
          class="primary-button"
          type="button"
          :disabled="isTestingGenerateVideo"
          @click="testGenerateVideo"
        >
          {{ isTestingGenerateVideo ? '生成中...' : '测试视频生成' }}
        </button>
        <dl class="result-list">
          <div>
            <dt>phase</dt>
            <dd>{{ generationRun.phase || '-' }}</dd>
          </div>
          <div>
            <dt>elapsed</dt>
            <dd>{{ generationRun.elapsed || '-' }}</dd>
          </div>
          <div>
            <dt>taskId</dt>
            <dd>{{ generationRun.taskId || generateResult.taskId || '-' }}</dd>
          </div>
          <div>
            <dt>status</dt>
            <dd>{{ generationRun.status || generateResult.status || '-' }}</dd>
          </div>
          <div>
            <dt>cost</dt>
            <dd>{{ generateResult.cost || '-' }}</dd>
          </div>
          <div>
            <dt>videoUrl</dt>
            <dd>{{ generateResult.videoUrl || '-' }}</dd>
          </div>
        </dl>
        <video
          v-if="generateResult.videoUrl"
          class="generated-video"
          :src="generateResult.videoUrl"
          controls
          playsinline
        />
      </section>

      <section class="bench-panel log-panel">
        <div class="panel-title">
          <strong>日志面板</strong>
          <span>请求状态 / 耗时 / 错误</span>
        </div>
        <div class="log-list">
          <article v-for="log in logs" :key="log.id" class="log-row" :class="log.status">
            <span>{{ log.time }}</span>
            <strong>{{ log.step }}</strong>
            <em>{{ log.status }}</em>
            <small v-if="log.elapsed">{{ log.elapsed }}</small>
            <p>{{ log.detail }}</p>
          </article>
          <p v-if="!logs.length" class="empty-log">暂无日志</p>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.test-bench {
  min-height: 100vh;
  overflow: auto;
  padding: 88px 32px 40px;
  background: #070809;
  color: #f4f4f4;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.bench-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  max-width: 1440px;
  margin: 0 auto 22px;
}

.eyebrow {
  margin: 0 0 8px;
  color: #35f59a;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.bench-header h1 {
  margin: 0;
  font-size: 28px;
}

.bench-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.clear-bench-button {
  height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  color: #e7eaee;
  background: rgba(255, 255, 255, 0.06);
  font-size: 12px;
  font-weight: 800;
}

.bench-badge {
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #bdc2ca;
  background: rgba(255, 255, 255, 0.05);
  font-size: 12px;
}

.bench-message {
  max-width: 1440px;
  margin: -8px auto 16px;
  padding: 10px 12px;
  border: 1px solid rgba(243, 189, 67, 0.28);
  border-radius: 8px;
  color: #ffe0a3;
  background: rgba(243, 189, 67, 0.08);
  font-size: 13px;
}

.bench-grid {
  display: grid;
  grid-template-columns: minmax(300px, 0.9fr) minmax(360px, 1.25fr) minmax(320px, 1fr);
  gap: 16px;
  max-width: 1440px;
  margin: 0 auto;
}

.bench-panel {
  min-width: 0;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(18, 19, 20, 0.96);
}

.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.panel-title strong {
  font-size: 15px;
}

.panel-title span {
  color: #818792;
  font-size: 12px;
}

.upload-drop {
  display: grid;
  place-items: center;
  gap: 10px;
  min-height: 190px;
  padding: 24px;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.035);
  text-align: center;
  cursor: pointer;
}

.upload-drop input {
  display: none;
}

.upload-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: rgba(53, 245, 154, 0.12);
  color: #35f59a;
  font-size: 28px;
}

.upload-drop strong,
.upload-drop small {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.upload-drop small {
  color: #898f99;
}

.preview-video,
.generated-video {
  width: 100%;
  max-height: 360px;
  margin-top: 14px;
  border-radius: 8px;
  background: #000;
}

.primary-button,
.secondary-button {
  width: 100%;
  min-height: 40px;
  margin-top: 14px;
  border-radius: 8px;
  font-weight: 800;
}

.primary-button {
  color: #04120a;
  background: #35f59a;
}

.secondary-button {
  color: #e7eaee;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.08);
}

.primary-button:disabled,
.secondary-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.json-view,
.prompt-output {
  overflow: auto;
  min-height: 360px;
  max-height: 560px;
  padding: 14px;
  border-radius: 8px;
  background: #090a0b;
  color: #d9dde3;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.replace-panel,
.prompt-panel,
.result-panel,
.log-panel {
  align-self: start;
}

.replace-groups {
  display: grid;
  gap: 12px;
}

.empty-replace-tip {
  padding: 10px 12px;
  border-radius: 8px;
  color: #ffe0a3;
  background: rgba(243, 189, 67, 0.08);
  font-size: 13px;
  line-height: 1.5;
}

.replace-group {
  padding: 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.045);
}

.replace-group h2 {
  margin: 0 0 10px;
  color: #dce0e6;
  font-size: 13px;
}

.replace-group p {
  color: #737984;
  font-size: 13px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  max-width: 100%;
  padding: 6px 9px;
  border-radius: 8px;
  color: #d9ffe9;
  background: rgba(53, 245, 154, 0.1);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.prompt-input {
  width: 100%;
  min-height: 110px;
  resize: vertical;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  outline: none;
  color: #f4f4f4;
  background: #090a0b;
  font: inherit;
  line-height: 1.5;
}

.result-list {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.result-list div {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.045);
}

.result-list dt {
  color: #858b95;
  font-size: 12px;
}

.result-list dd {
  overflow-wrap: anywhere;
  color: #e1e4e9;
  font-size: 12px;
}

.log-list {
  display: grid;
  gap: 10px;
  max-height: 520px;
  overflow: auto;
}

.log-row {
  display: grid;
  grid-template-columns: 72px minmax(92px, 1fr) 68px 54px;
  gap: 8px;
  align-items: start;
  padding: 10px;
  border-left: 3px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.045);
}

.log-row.success {
  border-left-color: #35f59a;
}

.log-row.error {
  border-left-color: #ff6060;
}

.log-row.failed {
  border-left-color: #ff6060;
}

.log-row.warning {
  border-left-color: #f3bd43;
}

.log-row.running {
  border-left-color: #5aa7ff;
}

.log-row span,
.log-row em,
.log-row small {
  color: #8b929c;
  font-size: 12px;
  font-style: normal;
}

.log-row strong {
  font-size: 12px;
}

.log-row p {
  grid-column: 1 / -1;
  color: #c7ccd4;
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.empty-log {
  color: #777d86;
  font-size: 13px;
}

@media (max-width: 1100px) {
  .bench-grid {
    grid-template-columns: 1fr;
  }

  .bench-header {
    align-items: start;
    flex-direction: column;
  }

  .bench-actions {
    align-items: start;
    flex-direction: column;
  }
}
</style>
