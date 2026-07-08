<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted } from 'vue'
import LeftToolbar from './components/LeftToolbar.vue'
import TopBar from './components/TopBar.vue'
import LabHead from './components/LabHead.vue'
import UploadCard from './components/UploadCard.vue'
import AnalysisNode from './components/AnalysisNode.vue'
import ReplaceRail from './components/ReplaceRail.vue'
import FlowConnector from './components/FlowConnector.vue'
import InspirationGrid from './components/InspirationGrid.vue'
import BottomControls from './components/BottomControls.vue'
import BreakdownModal from './components/BreakdownModal.vue'
import ResultCard from './components/ResultCard.vue'
import { useCanvasNodes } from './composables/useCanvasNodes.js'

// ── 状态管理 ──
// flowMode: 'idle' | 'analyzing' | 'customizing' | 'done' | 'error'
const flowMode = ref('idle')

const uploadedVideo = reactive({
  name: '',
  coverUrl: '',
  duration: '',
  ratio: '',
  size: '',
})

const analysisProgress = ref(0)
const analysisStage = ref('')
const errorMsg = ref('')
const breakdownData = ref(null)
const breakdownVisible = ref(false)
const videoObjectUrl = ref('')
const customItems = ref([])

// ── 生成 / 版本管理 ──
const versions = ref([])
const isGenerating = ref(false)
const generateError = ref('')
const adjustmentText = ref('')
const currentGeneratingPrompt = ref('')
const resultParams = {
  ratio: '9:16',
  quality: '720P',
  duration: '18s',
  timeStart: 0,
}

const showInspiration = computed(() => flowMode.value === 'idle')

// ── 画布节点系统 ──
const canvas = useCanvasNodes()

// 节点 ref
const boardEl = ref(null)
const uploadNodeEl = ref(null)
const analysisNodeEl = ref(null)
const replaceRailEl = ref(null)
const resultNodeRefs = ref([])

// 注册 board 和节点
function registerCanvasNodes() {
  canvas.setBoard(boardEl.value)
  canvas.registerNode('uploadNode', uploadNodeEl.value)
  canvas.registerNode('analysisNode', analysisNodeEl.value)
  canvas.registerNode('replaceRail', replaceRailEl.value)
  // 注册结果节点
  resultNodeRefs.value.forEach((el, index) => {
    const version = displayVersions.value[index]
    if (version && el) {
      canvas.registerNode(`result-${version.id}`, el)
    }
  })
  canvas.refreshObservers()
}

// 根据状态计算连线
const currentEdges = computed(() => {
  if (flowMode.value === 'analyzing') {
    return [{ source: 'uploadNode', target: 'analysisNode' }]
  }
  if (flowMode.value === 'customizing') {
    const edges = [{ source: 'uploadNode', target: 'replaceRail' }]
    // 替换面板 → 结果节点连线
    displayVersions.value.forEach((version) => {
      edges.push({ source: 'replaceRail', target: `result-${version.id}` })
    })
    return edges
  }
  return []
})

// 监听连线变化（只在 edge id 列表变化时更新）
watch(currentEdges, (newEdges) => {
  canvas.setEdges(newEdges)
  canvas.queueUpdate(50)
})

// 监听 flowMode 变化，等 DOM 渲染后重新注册节点和更新连线
watch(flowMode, async () => {
  await nextTick()
  registerCanvasNodes()
  canvas.setEdges(currentEdges.value)
  canvas.queueUpdate(80)
})

const displayVersions = computed(() => {
  const list = [...versions.value]
  if (generatingVersion.value) list.push(generatingVersion.value)
  return list
})

const generatingVersion = computed(() => {
  if (!isGenerating.value) return null
  return {
    id: '生成中',
    isGenerating: true,
    summary: ['正在根据当前配置生成新版本'],
    prompt: currentGeneratingPrompt.value,
    params: { ...resultParams },
  }
})

// 监听结果节点变化（防抖，避免频繁触发）
let displayVersionsTimer = null
watch(displayVersions, async () => {
  if (displayVersionsTimer) clearTimeout(displayVersionsTimer)
  displayVersionsTimer = setTimeout(async () => {
    displayVersionsTimer = null
    await nextTick()
    registerCanvasNodes()
    canvas.setEdges(currentEdges.value)
    canvas.queueUpdate(80)
  }, 100)
}, { deep: false })

onMounted(() => {
  registerCanvasNodes()
})

// ── 工具函数（从 react-old 1:1 迁移）──
function formatFileSize(bytes = 0) {
  if (!bytes) return '未知大小'
  const mb = bytes / 1024 / 1024
  return `${mb.toFixed(1)}MB`
}

function formatDuration(seconds = 0) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '未知时长'
  const total = Math.round(seconds)
  const minutes = Math.floor(total / 60)
  const restSeconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(restSeconds).padStart(2, '0')}`
}

function getVideoRatio(width = 0, height = 0) {
  if (!width || !height) return '未知比例'
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b))
  const divisor = gcd(width, height)
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`
}

function getVideoPreviewInfo(file) {
  return new Promise((resolve) => {
    const videoUrl = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.src = videoUrl

    let resolved = false
    const finish = (info) => {
      if (resolved) return
      resolved = true
      URL.revokeObjectURL(videoUrl)
      resolve(info)
    }

    video.onloadedmetadata = () => {
      const duration = formatDuration(video.duration)
      const ratio = getVideoRatio(video.videoWidth, video.videoHeight)
      const targetTime = Math.min(0.8, Math.max(0, video.duration - 0.1))
      video.currentTime = targetTime

      video.onseeked = () => {
        try {
          const canvasEl = document.createElement('canvas')
          canvasEl.width = video.videoWidth || 320
          canvasEl.height = video.videoHeight || 180
          const ctx = canvasEl.getContext('2d')
          ctx.drawImage(video, 0, 0, canvasEl.width, canvasEl.height)
          const coverUrl = canvasEl.toDataURL('image/jpeg', 0.82)
          finish({ coverUrl, duration, ratio })
        } catch {
          finish({ coverUrl: '', duration, ratio })
        }
      }
    }

    video.onerror = () => {
      finish({ coverUrl: '', duration: '未知时长', ratio: '未知比例' })
    }
  })
}

// ── 拆解结果解析（从 react-old 1:1 迁移）──
function normalizeList(value, options = {}) {
  const list = Array.isArray(value)
    ? value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean)
    : typeof value === 'string' && value.trim()
      ? value.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean)
      : []
  if (!options.filterRelationWords) return list
  return list.filter((item) => !isInvalidSubjectLabel(item))
}

function uniqueList(list = []) {
  return Array.from(new Set(list.map((item) => String(item).trim()).filter(Boolean)))
}

function collectShotValues(shots = [], key) {
  return shots.flatMap((shot) => {
    const value = shot?.[key]
    if (Array.isArray(value)) return value
    if (typeof value === 'string' && value.trim()) return value.split(/[、,，/]/)
    return []
  }).map((item) => String(item).trim()).filter(Boolean)
}

function isInvalidSubjectLabel(label = '') {
  const value = String(label || '').trim()
  if (!value) return true
  const relationWords = [
    '情侣', '伴侣', '夫妻', '夫妇', '新婚夫妇', '新婚夫妻', '新人',
    '男女', '男女主', '二人', '两人', '两位', '两名', '一对', '一组',
    '组合', '搭档', '同伴', '伙伴', '朋友', '恋人', '爱人', '对象',
    '人群', '观众', '路人', '群众', '围观者', '舞者组合',
  ]
  return relationWords.some((word) => value === word || value.includes(word))
}

function isInvalidElementLabel(label = '') {
  const value = String(label || '').trim()
  if (!value) return true
  const invalidWords = [
    '人物', '主体', '男性', '女性', '男', '女', '情侣', '伴侣',
    '夫妻', '夫妇', '新婚夫妇', '新人', '男女', '两人', '二人',
    '舞者', '动作', '舞蹈', '节奏', '镜头', '画面', '场景', '背景',
  ]
  return invalidWords.some((word) => value === word || value.includes(word))
}

function cleanSceneLabel(label = '') {
  let value = String(label || '').trim()
  if (!value) return ''
  value = value
    .replace(/^镜头\s*\d+\s*[｜|:：-]?\s*/g, '')
    .replace(/^场景\s*\d+\s*[｜|:：-]?\s*/g, '')
    .replace(/[。,.，；;].*$/g, '')
    .trim()
  if (value.length > 12) value = value.slice(0, 12)
  return value
}

function buildSceneListFromShots(shots = [], overviewScenes = []) {
  const shotScenes = shots.map((shot, index) => {
    const rawScene = String(shot?.scene || '').trim()
    const rawTitle = String(shot?.title || '').trim()
    const label = cleanSceneLabel(rawScene || rawTitle || `场景 ${index + 1}`)
    return label || `场景 ${index + 1}`
  }).filter(Boolean)

  const fallbackScenes = normalizeList(overviewScenes).map(cleanSceneLabel).filter(Boolean)
  const merged = uniqueList(shotScenes.length ? shotScenes : fallbackScenes)
  return merged.slice(0, Math.max(3, Math.min(shots.length || 4, 4)))
}

function parseBreakdownResult(rawText = '') {
  const text = String(rawText || '')
  let jsonText = ''
  const jsonStart = text.indexOf('{')
  const jsonEnd = text.lastIndexOf('}')

  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    jsonText = text.slice(jsonStart, jsonEnd + 1)
  }

  if (!jsonText) {
    console.warn('未找到 JSON 拆解结果：', text)
    return getEmptyBreakdownData('未找到可解析的视频拆解结果')
  }

  try {
    const data = JSON.parse(jsonText)
    return normalizeBreakdownData(data)
  } catch {
    try {
      const repairedJsonText = jsonText
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/^json\s*/i, '')
        .trim()
      const data = JSON.parse(repairedJsonText)
      return normalizeBreakdownData(data)
    } catch (secondError) {
      console.error('视频拆解 JSON 解析失败：', secondError)
      return getEmptyBreakdownData('视频拆解结果解析失败，请重新拆解')
    }
  }
}

function normalizeBreakdownData(data = {}) {
  const overview = data.overview || {}
  const shots = Array.isArray(data.shots) ? data.shots : []

  return {
    overview: {
      referenceVideo: overview.referenceVideo || uploadedVideo.name || '已上传参考视频',
      shotCount: overview.shotCount || shots.length || 0,
      replaceableSubjects: normalizeList(overview.replaceableSubjects),
      replaceableScenes: normalizeList(overview.replaceableScenes),
      replaceableElements: normalizeList(overview.replaceableElements),
      replaceableText: normalizeList(overview.replaceableText),
    },
    shots: shots.map((shot, index) => ({
      id: shot.id || `shot${index + 1}`,
      title: shot.title || `镜头${index + 1}`,
      time: shot.time || '',
      description: shot.description || '暂无画面描述',
      replaceable: normalizeList(shot.replaceable),
      suggestKeep: normalizeList(shot.suggestKeep),
      people: shot.people || '未识别',
      scene: shot.scene || '未识别',
      elements: normalizeList(shot.elements),
      action: shot.action || '未识别',
      camera: shot.camera || '未识别',
      rhythm: shot.rhythm || '未识别',
    })),
  }
}

function getEmptyBreakdownData(message = '暂无视频拆解结果') {
  return {
    overview: {
      referenceVideo: message,
      shotCount: 0,
      replaceableSubjects: [],
      replaceableScenes: [],
      replaceableElements: [],
      replaceableText: [],
    },
    shots: [],
  }
}

function buildCustomItems(data) {
  const overview = data?.overview || {}
  const shots = Array.isArray(data?.shots) ? data.shots : []

  const subjects = normalizeList(overview.replaceableSubjects, { filterRelationWords: true })
  const scenes = buildSceneListFromShots(shots, overview.replaceableScenes)

  const elements = uniqueList([
    ...normalizeList(overview.replaceableElements),
    ...collectShotValues(shots, 'elements'),
    ...collectShotValues(shots, 'replaceable'),
  ]).filter((item) => !isInvalidElementLabel(item)).slice(0, 10)
function isEmptyCopyText(value) {
  const text = String(value || '').trim()

  return (
    !text ||
    text.includes('本视频未识别到任何文字') ||
    text.includes('未识别到任何文字') ||
    text.includes('未识别到文字') ||
    text.includes('未识别到字幕') ||
    text.includes('无字幕') ||
    text.includes('无文字')
  )
}

const texts = normalizeList(overview.replaceableText).filter((text) => !isEmptyCopyText(text))
  // 过滤品牌/包装/环境文字（单字、2字品牌名等不算字幕/文案）
  const filteredTexts = texts.filter((text) => {
    const t = String(text).trim()
    // 过滤单个品牌名（1-2个字且常见品牌）
    if (t.length <= 2 && !t.includes('字幕') && !t.includes('文案') && !t.includes('标题')) return false
    // 过滤明显是品牌/包装文字的
    const brandPatterns = /^(维达|清风|心相印|洁柔|得力|晨光|可口可乐|茅台|华为|苹果|小米|OPPO|vivo|Nike|Adidas|L\O\GO|logo)$/i
    if (brandPatterns.test(t)) return false
    return true
  })
  const displayTexts = filteredTexts

  const makeItems = (list, group, prefix, previewPrefix) =>
    list.map((name, index) => ({
      id: `${prefix}${index + 1}`,
      group,
      title: name || `${group} ${index + 1}`,
      preview: `${previewPrefix}-${index + 1}`,
      previewUrl: uploadedVideo.coverUrl || '',
      original: `保留原视频${group}`,
      current: `保留原视频${group}`,
      replacement: '',
      changed: false,
    }))

  return [
    ...makeItems(subjects, '主体', 'realSubject', 'preview-subject'),
    ...makeItems(scenes, '场景', 'realScene', 'preview-scene'),
    ...makeItems(elements, '元素', 'realElement', 'preview-element'),
    ...makeItems(displayTexts, '字幕/文案', 'realCopy', 'preview-copy'),
  ]
}

// ── 进度模拟 ──

let fakeProgressTimer = null

function stopFakeProgress() {
  if (fakeProgressTimer) {
    clearTimeout(fakeProgressTimer)
    fakeProgressTimer = null
  }
}

function startFakeProgress() {
  stopFakeProgress()

  analysisProgress.value = 12
  analysisStage.value = '正在整理主体、场景、元素和字幕...'

  fakeProgressTimer = setTimeout(() => {
    if (flowMode.value !== 'analyzing') return
    analysisProgress.value = 45
    analysisStage.value = '正在提取可替换内容...'
  }, 1200)

  setTimeout(() => {
    if (flowMode.value !== 'analyzing') return
    analysisProgress.value = 72
    analysisStage.value = '等待后端返回...'
  }, 2600)

  setTimeout(() => {
    if (flowMode.value !== 'analyzing') return
    analysisProgress.value = 89
    analysisStage.value = '整理最终结构...'
  }, 4200)
}

// ── 上传 + 真实接口调用 ──
async function handleUploaded(file) {
  uploadedVideo.name = file?.name || '上传的视频.mp4'
  uploadedVideo.size = formatFileSize(file.size)

  // 保存视频 object URL 用于拆解弹窗镜头预览
  if (videoObjectUrl.value) URL.revokeObjectURL(videoObjectUrl.value)
  videoObjectUrl.value = URL.createObjectURL(file)

  const info = await getVideoPreviewInfo(file)
  uploadedVideo.coverUrl = info.coverUrl
  uploadedVideo.duration = info.duration
  uploadedVideo.ratio = info.ratio

  errorMsg.value = ''
  flowMode.value = 'analyzing'
  startFakeProgress()

  try {
    const formData = new FormData()
    formData.append('video', file)

    const response = await fetch('/api/video-to-text', {
      method: 'POST',
      body: formData,
    })

const rawText = await response.text()

let data = null
try {
  data = rawText ? JSON.parse(rawText) : null
} catch (error) {
  data = null
}

if (!response.ok || !data?.ok) {
  throw new Error(
    data?.message ||
      data?.error ||
      rawText ||
      '视频拆解失败，请检查后端服务或 API Key。'
  )
}

    console.log('✅ 视频拆解结果：', data.result)

    const parsed = parseBreakdownResult(data.result)
    breakdownData.value = parsed
    console.log('📋 解析后的拆解数据：', parsed)

    customItems.value = buildCustomItems(parsed)
    console.log('🎯 可替换项：', customItems.value)
stopFakeProgress()
    analysisProgress.value = 100
    analysisStage.value = '拆解完成，可操作内容已准备就绪。'
    flowMode.value = 'customizing'
  } catch (err) {
    stopFakeProgress()
    console.error('❌ 视频拆解失败：', err)
    analysisProgress.value = 0
    analysisStage.value = ''
    errorMsg.value = err.message || '视频拆解失败，请重试。'
    flowMode.value = 'error'
  }
}

// 替换由 ReplaceRail 内部处理（上传/资产库），此处仅做状态同步
function handleReplace(itemId) {
  // item 状态已在 ReplaceRail 内更新，这里可做额外逻辑
  console.log('✅ 替换完成：', itemId)
}

function openBreakdown() {
  breakdownVisible.value = true
}

function closeBreakdown() {
  breakdownVisible.value = false
}

// ── 生成视频逻辑 ──

function getChangedItems() {
  return customItems.value.filter((item) => item.changed)
}

function buildGenerationDescription(items = getChangedItems()) {
  const changedByGroup = (group) => items.filter((item) => item.group === group)

  const subjectText = changedByGroup('主体').length
    ? changedByGroup('主体').map((item) => `${item.title}替换为${item.current}`).join('；')
    : '主体保持原视频人物关系、动作节奏和站位。'

  const sceneText = changedByGroup('场景').length
    ? changedByGroup('场景').map((item) => `${item.title}替换为${item.current}`).join('；')
    : '场景保持原视频空间关系、镜头推进和环境氛围。'

  const elementText = changedByGroup('元素').length
    ? changedByGroup('元素').map((item) => `${item.title}替换为${item.current}`).join('；')
    : '元素保持原视频中的核心视觉符号和画面关系。'

  const copyText = changedByGroup('字幕/文案').length
    ? changedByGroup('字幕/文案').map((item) => `${item.title}修改为${item.current}`).join('；')
    : '不新增无关字幕，若原视频无文字则保持无文字。'

  const shots = Array.isArray(breakdownData.value?.shots) ? breakdownData.value.shots : []
  const shotDescription = shots.length
    ? shots.map((shot, index) => {
        const time = shot.time || `镜头${index + 1}`
        const title = shot.title || `镜头${index + 1}`
        const description = shot.description || '保留参考视频画面结构。'
        const action = shot.action ? `动作：${shot.action}` : ''
        const camera = shot.camera ? `镜头：${shot.camera}` : ''
        const rhythm = shot.rhythm ? `节奏：${shot.rhythm}` : ''
        return `${time}：${title}。${description}${action ? ` ${action}。` : ''}${camera ? ` ${camera}。` : ''}${rhythm ? ` ${rhythm}。` : ''}`
      }).join('\n')
    : '按参考视频原有镜头结构生成，保持人物动作、镜头节奏和场景关系。'

  return `【参考视频结构】\n${shotDescription}\n\n【本次替换】\n主体：${subjectText}\n场景：${sceneText}\n元素：${elementText}\n字幕 / 文案：${copyText}\n\n【生成要求】\n根据参考视频拆解结构生成新视频。保持原视频的镜头顺序、人物动作节奏、场景关系、画面氛围和运镜方式；只替换用户指定的主体、场景或元素，未修改内容保持原样。画面真实自然，人物动作连贯，镜头稳定，不要生成无关字幕、水印或额外文字。`
}

function buildGenerationDescriptionWithAdjustment(items = getChangedItems(), adjText = '') {
  const base = buildGenerationDescription(items)
  const clean = adjText.trim()
  if (!clean) return base
  return `${base}\n\n【用户本次调整要求】\n${clean}\n\n【执行要求】\n在保留参考视频镜头结构、主体运动节奏和画面关系的基础上，优先满足用户本次调整要求。不要生成无关文字、水印或额外字幕。`
}

function getNextVersionId() {
  const maxNumber = versions.value.reduce((max, v) => {
    const m = String(v.id || '').match(/^V(\d+)$/)
    return m ? Math.max(max, Number(m[1])) : max
  }, 0)
  return `V${maxNumber + 1}`
}

function getChangeSummaryItems() {
  return getChangedItems().map((item) => ({
    title: item.title,
    value: item.group === '字幕/文案' ? '已修改' : item.current,
  }))
}

function dataUrlToFile(dataUrl, filename = 'cover.jpg') {
  const [header, base64] = dataUrl.split(',')
  const mimeMatch = header.match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
  const binary = atob(base64)
  const array = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i)
  }
  return new File([array], filename, { type: mime })
}

async function imageUrlToFile(url, filename = 'reference-cover.jpg') {
  if (!url) throw new Error('缺少参考图，请先上传视频并完成拆解。')
  if (url.startsWith('data:')) return dataUrlToFile(url, filename)
  const response = await fetch(url)
  if (!response.ok) throw new Error('参考图读取失败，请重新上传视频。')
  const blob = await response.blob()
  return new File([blob], filename, { type: blob.type || 'image/jpeg' })
}

function extractGeneratedVideoUrl(raw = '') {
  const text = String(raw || '')
  const outputFileMatch = text.match(/OUTPUT_FILE:\s*(\/[^\s]+\.mp4)/)
  if (outputFileMatch) {
    const filename = outputFileMatch[1].split('/').pop()
    return `/generated/${filename}?t=${Date.now()}`
  }
  const directMatch = text.match(/https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/)
  if (directMatch) return directMatch[0]
  const jsonStart = text.indexOf('{')
  const jsonEnd = text.lastIndexOf('}')
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    try {
      const data = JSON.parse(text.slice(jsonStart, jsonEnd + 1))
      const found = findVideoUrlInObject(data)
      if (found) return found
    } catch (e) {
      console.warn('生成结果 JSON 解析失败：', e)
    }
  }
  return ''
}

function findVideoUrlInObject(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    return value.includes('.mp4') || value.startsWith('http') ? value : ''
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findVideoUrlInObject(item)
      if (found) return found
    }
  }
  if (typeof value === 'object') {
    for (const key of Object.keys(value)) {
      const found = findVideoUrlInObject(value[key])
      if (found) return found
    }
  }
  return ''
}

const generateBtnText = computed(() => {
  if (isGenerating.value) return '生成中'
  if (versions.value.length || revising.value) return '生成新版本'
  return '生成视频'
})

const showResultPanel = computed(() => flowMode.value === 'customizing' || versions.value.length > 0 || isGenerating.value)

// 生成中占位版本
async function handleGenerate() {
  if (isGenerating.value) return

  generateError.value = ''
  isGenerating.value = true

  const changed = getChangedItems()
  const adjText = adjustmentText.value
  const description = buildGenerationDescriptionWithAdjustment(changed, adjText)
  currentGeneratingPrompt.value = description
  const summaryItems = getChangeSummaryItems()
  const summary = summaryItems.length
    ? summaryItems.map((item) => `${item.title} → ${item.value}`)
    : ['其他内容：保持原视频']

  const nextVersionId = getNextVersionId()

  try {
    if (!uploadedVideo.coverUrl) {
      throw new Error('缺少参考图，请先上传视频并完成拆解。')
    }

    const coverFile = await imageUrlToFile(
      uploadedVideo.coverUrl,
      'reference-cover.jpg'
    )

    const formData = new FormData()
    formData.append('image', coverFile)
    formData.append('prompt', description)
    formData.append('duration', '10')
    formData.append('aspectRatio', '9:16')

    console.log('[debug] 发送给模型的首帧图片:', coverFile.name, coverFile.type, coverFile.size)
    console.log('[debug] 发送给模型的 prompt:', description)

    const response = await fetch('/api/generate-video', {
      method: 'POST',
      body: formData,
    })

    const data = await response.json()

    if (!response.ok || !data.ok) {
      throw new Error(data.message || data.error || '视频生成失败')
    }

    const generatedVideoResult = data.result
    console.log('真实视频生成结果：', generatedVideoResult)
    const videoUrl = extractGeneratedVideoUrl(generatedVideoResult)

    const version = {
      id: nextVersionId,
      summary,
      prompt: description,
      adjustmentText: adjText,
      generatedVideoResult,
      videoUrl,
      params: { ...resultParams },
      time: new Date().toLocaleString('zh-CN', { hour12: false }),
      cost: '￥15.2',
      status: '已生成',
      saved: false,
    }

    versions.value.push(version)
    console.log(`✅ ${nextVersionId} 已生成`)
  } catch (error) {
    console.error('视频生成失败：', error)
    generateError.value = error.message || '视频生成失败'
  } finally {
    isGenerating.value = false
  }
}

// ── 轻提示 ──
const noticeText = ref('')
const noticeVisible = ref(false)
let noticeTimer = null
function showNotice(msg) {
  noticeText.value = msg
  noticeVisible.value = true
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { noticeVisible.value = false }, 2500)
}

// ── 导出视频 ──
function handleExport(version) {
  if (!version.videoUrl) {
    showNotice('视频还未生成完成，暂时无法导出')
    return
  }
  const link = document.createElement('a')
  link.href = version.videoUrl
  link.download = `爆款实验室_${version.id}.mp4`
  document.body.appendChild(link)
  link.click()
  link.remove()
  showNotice('视频已开始下载')
}

// ── 保存至资产库（前端模拟）──
function handleSaveAsset(version) {
  if (version.saved) {
    showNotice('该视频已保存至资产库')
    return
  }
  version.saved = true
  showNotice('已保存至资产库')
}

// ── 重新改造 ──
const revising = ref(false)
const reviseVisible = ref(false)
const replaceRailComp = ref(null)
const railFocusHighlight = ref(false)

function handleRevise(version) {
  function handleRevise(version) {
  const safeCoverUrl =
    uploadedVideo.value?.coverUrl ||
    uploadedVideo.value?.previewUrl ||
    version?.coverUrl ||
    ''

  customItems.value.forEach((item) => {
    item.current = item.original
    item.changed = false
    item.replacement = ''
    item.previewUrl = safeCoverUrl
  })

  adjustmentText.value = ''

  nextTick(() => {
    const el = replaceRailEl.value
    if (!el) return

    replaceRailComp.value?.scheduleReviseMute?.()
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })

    railFocusHighlight.value = true
    setTimeout(() => {
      railFocusHighlight.value = false
    }, 1500)

    registerCanvasNodes()
    canvas.setEdges(currentEdges.value)
    canvas.queueUpdate(80)
  })
}
  revising.value = true
  reviseVisible.value = true

  // 清空所有替换状态，恢复到原始
  customItems.value.forEach((item) => {
    item.current = item.original
    item.changed = false
    item.replacement = ''
    item.previewUrl =
  uploadedVideo.value?.coverUrl ||
  uploadedVideo.value?.previewUrl ||
  version?.coverUrl ||
  ''
  })

  // 清空调整文本
  adjustmentText.value = ''

  // 等待 DOM 更新后执行聚焦 + 高亮
  nextTick(() => {
    const el = replaceRailEl.value
    if (!el) return

    // 触发 ReplaceRail 内部的 muted 定时器
    replaceRailComp.value?.scheduleReviseMute()

    // 滚动到替换面板
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })

    // 高亮替换面板
    railFocusHighlight.value = true
    setTimeout(() => {
      railFocusHighlight.value = false
    }, 1500)

    // 重新注册节点和更新连线
    registerCanvasNodes()
    canvas.setEdges(currentEdges.value)
    canvas.queueUpdate(80)
  })
}

// 重新改造后点击生成：重置 revising，走正常生成流程
function handleGenerateFromRevise() {
  revising.value = false
  reviseVisible.value = false
  handleGenerate()
}

function handleRestore(itemId) {
  const item = customItems.value.find((i) => i.id === itemId)
  if (!item) return
  item.changed = false
  item.current = item.original
  item.replacement = ''
  item.previewUrl = ''
}

function retry() {
  errorMsg.value = ''
  flowMode.value = 'idle'
  uploadedVideo.name = ''
  uploadedVideo.coverUrl = ''
  uploadedVideo.duration = ''
  uploadedVideo.ratio = ''
  uploadedVideo.size = ''
  if (videoObjectUrl.value) {
    URL.revokeObjectURL(videoObjectUrl.value)
    videoObjectUrl.value = ''
  }
  breakdownData.value = null
  breakdownVisible.value = false
  customItems.value = []
}
</script>

<template>
  <div class="app-shell">
    <main class="canvas">
      <TopBar />
      <LabHead />
      <LeftToolbar />

      <section class="lab-page">
        <div ref="boardEl" class="flow-board" :class="flowMode === 'idle' ? 'idle' : (flowMode === 'customizing') ? 'customizing' : 'analyzing'">
          <!-- SVG 连线层 -->
          <FlowConnector
            :paths="canvas.paths.value"
            :width="canvas.svgSize.width"
            :height="canvas.svgSize.height"
          />

          <!-- 左列：上传视频节点 -->
          <section class="source-column">
            <div
              ref="uploadNodeEl"
              data-node-key="uploadNode"
              class="flow-node-wrapper"
              @pointerdown="uploadedVideo.name ? canvas.onPointerDown($event, 'uploadNode') : undefined"
            >
              <UploadCard
                :video="uploadedVideo"
                :status="flowMode === 'analyzing' ? 'analyzing' : flowMode === 'customizing' ? 'done' : flowMode === 'error' ? 'error' : 'idle'"
                @upload="handleUploaded"
                @view-breakdown="openBreakdown"
              />
            </div>
            <InspirationGrid v-if="showInspiration" />
          </section>

          <!-- analyzing 状态：正在拆解视频节点 -->
          <template v-if="flowMode === 'analyzing'">
            <section class="center-column">
              <div
                ref="analysisNodeEl"
                data-node-key="analysisNode"
                class="flow-node-wrapper"
                @pointerdown="canvas.onPointerDown($event, 'analysisNode')"
              >
                <AnalysisNode
                  :progress="analysisProgress"
                  :stage="analysisStage"
                />
              </div>
            </section>
          </template>

          <!-- error 状态：错误节点 -->
          <template v-if="flowMode === 'error'">
            <section class="center-column">
              <div
                ref="analysisNodeEl"
                data-node-key="analysisNode"
                class="flow-node-wrapper"
                @pointerdown="canvas.onPointerDown($event, 'analysisNode')"
              >
                <div class="error-node flow-node">
                  <div class="node-head">
                    <span class="error-dot">✕</span>
                    <strong>拆解失败</strong>
                  </div>
                  <p class="error-msg">{{ errorMsg }}</p>
                  <button class="retry-button" @click="retry">重新上传</button>
                </div>
              </div>
            </section>
          </template>

          <!-- customizing 状态：替换面板节点 -->
          <template v-if="flowMode === 'customizing'">
            <section class="replace-column">
              <div
                ref="replaceRailEl"
                data-node-key="replaceRail"
                class="flow-node-wrapper"
                @pointerdown="canvas.onPointerDown($event, 'replaceRail')"
              >
                <ReplaceRail
                  ref="replaceRailComp"
                  :items="customItems"
                  :cover-url="uploadedVideo.coverUrl"
                  v-model="adjustmentText"
                  :generate-btn-text="generateBtnText"
                  :is-generating="isGenerating"
                  :revise-visible="reviseVisible"
                  :revising="revising"
                  :focus-highlight="railFocusHighlight"
                  @replace="handleReplace"
                  @restore="handleRestore"
                  @generate="revising ? handleGenerateFromRevise() : handleGenerate()"
                />
              </div>
            </section>
          </template>

          <!-- 生成结果面板 -->
          <template v-if="showResultPanel">
            <section class="result-column">
              <div
                v-for="(version, index) in displayVersions"
                :key="version.id"
                :ref="el => { if (el) resultNodeRefs[index] = el }"
                :data-node-key="`result-${version.id}`"
                class="flow-node-wrapper"
                @pointerdown="canvas.onPointerDown($event, `result-${version.id}`)"
              >
                <ResultCard
                  :version="version"
                  :index="index"
                  @export="handleExport(version)"
                  @save="handleSaveAsset(version)"
                  @revise="handleRevise(version)"
                />
              </div>
            </section>
          </template>
        </div>
      </section>

      <BottomControls />
    </main>

    <!-- 视频拆解弹窗 -->
    <BreakdownModal
      :visible="breakdownVisible"
      :data="breakdownData"
      :video-name="uploadedVideo.name"
      :cover-url="uploadedVideo.coverUrl"
      :video-object-url="videoObjectUrl"
      @close="closeBreakdown"
    />

    <!-- 生成错误提示 -->
    <div v-if="generateError" class="generate-error-toast">
      {{ generateError }}
    </div>

    <!-- 轻提示 -->
    <div v-if="noticeVisible" class="notice-toast">
      {{ noticeText }}
    </div>
  </div>
</template>

<style>
:root {
  color-scheme: dark;
  --canvas: #020303;
  --panel: #111216;
  --node: #151616;
  --line: rgba(255, 255, 255, 0.1);
  --line-strong: rgba(255, 255, 255, 0.16);
  --text: #f4f4f4;
  --soft: #babdc5;
  --muted: #777b84;
  --green: #35f59a;
  --green-soft: rgba(53, 245, 154, 0.18);
  --green-line: rgba(53, 245, 154, 0.42);
  --shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  height: 100vh;
  overflow: hidden;
  background: #000;
  color: var(--text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}

button {
  border: 0;
  cursor: pointer;
  font: inherit;
}

.app-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  height: 100vh;
  background: #000;
}

.canvas {
  position: relative;
  overflow: hidden;
  background-color: var(--canvas);
  background-image:
    radial-gradient(circle, rgba(255, 255, 255, 0.16) 1px, transparent 1.5px),
    radial-gradient(circle at 40% 45%, rgba(53, 245, 154, 0.055), transparent 34%),
    radial-gradient(circle at 68% 32%, rgba(53, 245, 154, 0.035), transparent 22%);
  background-size: 18px 18px, 100% 100%, 100% 100%;
}

.lab-page {
  position: absolute;
  inset: 0;
  overflow: auto;
  padding: 108px 60px 120px 120px;
}

/* ── flow-board ── */
.flow-board {
  position: relative;
}

/* idle：单列居中 */
.flow-board.idle {
  display: grid;
  grid-template-columns: minmax(960px, 1120px);
  justify-content: center;
  min-height: calc(100vh - 228px);
}

/* analyzing：五列网格 */
.flow-board.analyzing {
  display: grid;
  grid-template-columns: 210px 56px minmax(150px, 220px) 56px minmax(420px, 520px);
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: calc(100vh - 228px);
}

/* customizing：两列 */
.flow-board.customizing {
  display: grid;
  grid-template-columns: 310px minmax(620px, 700px);
  align-items: start;
  column-gap: 52px;
  row-gap: 0;
  justify-content: center;
  padding-top: 34px;
  min-height: calc(100vh - 228px);
}

.source-column {
  position: relative;
  z-index: 3;
  display: grid;
  align-content: center;
  gap: 18px;
}

.flow-board.customizing .source-column {
  grid-column: 1;
  grid-row: 1;
  align-self: center;
  padding-top: 0;
}

.center-column {
  position: relative;
  z-index: 3;
  display: grid;
  align-content: center;
  gap: 18px;
}

.replace-column {
  grid-column: 2;
  grid-row: 1;
  width: 100%;
  z-index: 5;
}

/* ── 节点包装器 ── */
.flow-node-wrapper {
  position: relative;
  will-change: transform;
}

.flow-node-wrapper:active {
  cursor: grabbing;
}

.node-dragging {
  cursor: grabbing !important;
  z-index: 20 !important;
  user-select: none;
}

/* ── 错误态节点 ── */
.error-node {
  width: 420px;
  padding: 18px;
  border: 1px solid rgba(255, 80, 80, 0.3);
  border-radius: 16px;
  background: rgba(18, 19, 20, 0.94);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.44);
}

.error-node .node-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.error-node .node-head strong {
  color: #ff8080;
  font-size: 16px;
  font-weight: 700;
}

.error-dot {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(255, 80, 80, 0.18);
  color: #ff6060;
  font-size: 12px;
  font-weight: 700;
}

.error-msg {
  margin: 10px 0 16px;
  color: #c8c8c8;
  line-height: 1.65;
  font-size: 14px;
}

.retry-button {
  padding: 8px 16px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(28, 29, 32, 0.88);
  color: var(--soft);
  font-size: 13px;
  font-weight: 700;
  transition: 0.18s ease;
}

.retry-button:hover {
  border-color: var(--green-line);
  color: #eefcf4;
  background: rgba(53, 245, 154, 0.1);
}

/* ── 结果列 ── */
.result-column {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: max-content;
  min-width: min(620px, 100%);
  z-index: 5;
  margin-left: 20px;
}

/* customizing 模式下如果有结果，扩展网格 */
.flow-board.customizing:has(.result-column) {
  grid-template-columns: 310px minmax(620px, 700px) auto;
}

/* 生成错误提示 */
.generate-error-toast {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 90;
  padding: 12px 20px;
  border-radius: 999px;
  background: rgba(255, 60, 60, 0.12);
  border: 1px solid rgba(255, 80, 80, 0.3);
  color: #ff8888;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
}

.notice-toast {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 91;
  padding: 12px 20px;
  border-radius: 999px;
  background: rgba(53, 245, 154, 0.1);
  border: 1px solid rgba(53, 245, 154, 0.28);
  color: #baffd6;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
}
</style>
