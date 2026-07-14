<script setup>
import { ref, computed } from 'vue'
import { deleteProjectAsset, persistReplacementImage, toBackendUrl } from '../api.js'
const reviseMuted = ref(false)
let reviseMutedTimer = null
function scheduleReviseMute() {
  clearTimeout(reviseMutedTimer)
  reviseMuted.value = false
  reviseMutedTimer = setTimeout(() => { reviseMuted.value = true }, 1500)
}
defineExpose({ scheduleReviseMute })
function isEmptySubjectGroup(group) {
  return group?.label === '主体' && (!group.items || group.items.length === 0)
}
function isCopyGroup(group) {
  return group?.class === 'copy' || group?.label === '字幕/文案' || group?.label === '字幕 / 文案'
}

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

function isEmptyCopyGroup(group) {
  if (!isCopyGroup(group)) return false

  const items = group.items || []

  if (!items.length) return true

  return items.every((item) => {
    return (
      isEmptyCopyText(item.title) ||
      isEmptyCopyText(item.current) ||
      isEmptyCopyText(item.original)
    )
  })
}

const props = defineProps({
  projectId: { type: String, default: '' },
  items: {
    type: Array,
    default: () => [],
  },
  coverUrl: {
    type: String,
    default: '',
  },
  modelValue: {
    type: String,
    default: '',
  },
  generateBtnText: {
    type: String,
    default: '生成视频',
  },
  generationConfigText: {
    type: String,
    default: '9:16 / 720P / 10s / 可灵 v3.0 Pro',
  },
  generationConfig: { type: Object, default: () => ({}) },
  generationOptions: { type: Object, default: () => ({ models: [], ratios: [], resolutions: [], durations: [] }) },
  estimatedPriceText: { type: String, default: '费用计算中' },
  priceStatus: { type: String, default: 'loading' },
  priceError: { type: String, default: '' },
  configStatus: { type: String, default: 'loading' },
  configError: { type: String, default: '' },
  configWarning: { type: String, default: '' },
  isGenerating: {
    type: Boolean,
    default: false,
  },
  reviseVisible: {
    type: Boolean,
    default: false,
  },
  revising: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['replace', 'restore', 'update:modelValue', 'update:generationConfig', 'generate', 'retry-config'])

const generationDisabled = computed(() => props.isGenerating
  || props.configStatus !== 'ready'
  || props.priceStatus !== 'ready'
  || !props.generationOptions.models?.length
  || !props.generationOptions.ratios?.length
  || !props.generationOptions.resolutions?.length
  || !props.generationOptions.durations?.length)

function updateGenerationConfig(key, value) {
  emit('update:generationConfig', { ...props.generationConfig, [key]: value })
}

const groups = [
  { label: '主体', class: 'subject' },
  { label: '场景', class: 'scene' },
  { label: '元素', class: 'element' },
  { label: '字幕/文案', class: 'copy' },
]

// ── 内联 picker 状态 ──
const openPickerId = ref(null)
const editingCopyId = ref(null)
const copyDraft = ref('')

function togglePicker(itemId) {
  openPickerId.value = openPickerId.value === itemId ? null : itemId
}

function startCopyEdit(itemId) {
  const item = props.items.find((i) => i.id === itemId)
  if (!item) return
  editingCopyId.value = itemId
  copyDraft.value = item.changed ? item.current : (item.original || '')
  openPickerId.value = null
}

function saveCopyEdit() {
  const item = props.items.find((i) => i.id === editingCopyId.value)
  if (!item) return
  const val = copyDraft.value.trim()
  if (!val) return
  item.current = val
  item.changed = true
  editingCopyId.value = null
  copyDraft.value = ''
}

function cancelCopyEdit() {
  editingCopyId.value = null
  copyDraft.value = ''
}

function restoreOriginalCopy() {
  const item = props.items.find((i) => i.id === editingCopyId.value)
  if (!item) return
  item.current = item.original || '保留原视频字幕/文案'
  item.changed = false
  editingCopyId.value = null
  copyDraft.value = ''
}

// ── 素材弹窗状态 ──
const assetModalVisible = ref(false)
const assetModalTitle = ref('替换素材')
const assetModalSubtitle = ref('选择一个素材用于当前替换项。')
const assetModalSource = ref('upload') // 'upload' | 'library'
const activeItemId = ref(null)

// ── 模拟资产库数据 ──
const assetLibrary = {
  '主体': [
    { name: '人物A.png', type: '图片', previewUrl: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=420&q=82' },
    { name: '人物B.png', type: '图片', previewUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=420&q=82' },
  ],
  '场景': [
    { name: '场景A.jpg', type: '图片', previewUrl: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=520&q=82' },
    { name: '场景B.jpg', type: '图片', previewUrl: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=520&q=82' },
  ],
  '元素': [
    { name: '元素A.png', type: '图片', previewUrl: 'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?auto=format&fit=crop&w=420&q=82' },
    { name: '元素B.png', type: '图片', previewUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=420&q=82' },
  ],
  '字幕/文案': [],
}

const currentAssetChoices = computed(() => {
  const item = props.items.find((i) => i.id === activeItemId.value)
  if (!item) return []
  return assetLibrary[item.group] || []
})

// ── 隐藏文件 input ──
const hiddenFileInput = ref(null)
const assetUploadError = ref('')
const isAssetUploading = ref(false)

function openUploadModal(itemId) {
  const item = props.items.find((i) => i.id === itemId)
  if (!item) return
  activeItemId.value = itemId
  assetModalSource.value = 'upload'
  assetModalTitle.value = '上传新素材'
  const acceptText = item.group === '字幕/文案' ? '支持图片或视频' : '支持图片或视频'
  assetModalSubtitle.value = `${acceptText}，选择文件后本地模拟上传成功。`
  assetModalVisible.value = true
  openPickerId.value = null
}

function openLibraryModal(itemId) {
  const item = props.items.find((i) => i.id === itemId)
  if (!item) return
  activeItemId.value = itemId
  assetModalSource.value = 'library'
  const titleMap = {
    '主体': '选择主体素材',
    '场景': '选择场景素材',
    '元素': '选择元素素材',
    '字幕/文案': '选择文案素材',
  }
  assetModalTitle.value = titleMap[item.group] || '选择素材'
  assetModalSubtitle.value = '从资产库选择一个素材用于当前替换项。'
  assetModalVisible.value = true
  openPickerId.value = null
}

function closeAssetModal() {
  if (isAssetUploading.value) return
  assetModalVisible.value = false
  activeItemId.value = null
}

function triggerFilePick() {
  if (isAssetUploading.value) return
  hiddenFileInput.value?.click()
}

async function onFileChange(e) {
  if (isAssetUploading.value) return
  const file = e.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
  alert('元素替换仅支持上传图片格式，请选择 JPG、PNG、WEBP 等图片文件。')
  return
}
  await applyReplacement(file.name, file)
  // 重置 input 以便重复选择同一文件
  e.target.value = ''
}

function applyAssetFromLibrary(asset) {
  if (isAssetUploading.value) return
  applyReplacement(asset.name, null, asset.previewUrl)
}

async function applyReplacement(fileName, file, previewUrl = '') {
  const item = props.items.find((i) => i.id === activeItemId.value)
  if (!item) return

  if (file && !props.projectId) {
    assetUploadError.value = '请先上传原视频并创建项目。'
    alert(assetUploadError.value)
    return
  }

  const previous = { ...item }
  let temporaryPreviewUrl = ''
  assetUploadError.value = ''
  isAssetUploading.value = Boolean(file)

  // Blob URL 只作为上传中的临时预览，不写入持久化状态。
  if (file && !previewUrl) {
    if (file.type.startsWith('image/')) {
      temporaryPreviewUrl = URL.createObjectURL(file)
      item.previewUrl = temporaryPreviewUrl
    } else if (file.type.startsWith('video/')) {
      // 视频截帧作为预览
      const videoUrl = URL.createObjectURL(file)
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.muted = true
      video.src = videoUrl
      video.onloadedmetadata = () => {
        video.currentTime = Math.min(0.5, video.duration / 2)
        video.onseeked = () => {
          try {
            const c = document.createElement('canvas')
            c.width = video.videoWidth || 320
            c.height = video.videoHeight || 180
            c.getContext('2d').drawImage(video, 0, 0, c.width, c.height)
            item.previewUrl = c.toDataURL('image/jpeg', 0.82)
          } catch {
            item.previewUrl = videoUrl
          }
        }
      }
    }
  }

  try {
    if (file) {
      const replacementType = { '主体': 'subject', '场景': 'scene', '元素': 'element' }[item.group]
      const data = await persistReplacementImage(props.projectId, file, replacementType)
      previewUrl = toBackendUrl(data.asset.public_url)
      const previousAssetId = previous.assetId
      Object.assign(item, {
        assetId: data.asset.id,
        storagePath: data.asset.storage_path || '',
        assetUrl: previewUrl,
        previewUrl,
      })
      if (previousAssetId && previousAssetId !== data.asset.id) {
        deleteProjectAsset(props.projectId, previousAssetId).catch((error) => {
          console.warn('旧替换素材清理失败：', error)
        })
      }
    }

    if (previewUrl) item.previewUrl = previewUrl

    item.current = fileName
    item.replacement = fileName
    item.changed = true

    closeAssetModal()
    emit('replace', item.id)
  } catch (error) {
    Object.keys(item).forEach((key) => delete item[key])
    Object.assign(item, previous)
    assetUploadError.value = `素材上传失败：${error.message}`
    assetModalSubtitle.value = assetUploadError.value
    alert(assetUploadError.value)
  } finally {
    isAssetUploading.value = false
    if (temporaryPreviewUrl) URL.revokeObjectURL(temporaryPreviewUrl)
  }
}

const groupedItems = computed(() => {
  return groups.map((g) => ({
    ...g,
    items: props.items.filter((item) => item.group === g.label),
  }))
})

const changedItems = computed(() => props.items.filter((item) => item.changed))

function itemPreviewLabel(group) {
  if (group === '主体') return '视频截取'
  if (group === '字幕/文案') return '文案预览'
  return '识别预览'
}
function getCardPreviewUrl(item, group) {
  // 用户已经替换过素材：优先显示用户上传/选择的新素材预览
  if (item?.changed && item?.previewUrl) {
    return item.previewUrl
  }

  if (item?.changed && item?.replacementPreviewUrl) {
    return item.replacementPreviewUrl
  }

  // 元素：未替换时，不再显示视频第一帧，改成元素类型占位图
  if (group === '元素') {
    return getElementPlaceholder(item?.title)
  }

  // 主体 / 场景：继续用原来的识别预览
  return item?.previewUrl || props.coverUrl || ''
}

function getElementPlaceholder(title = '') {
  const text = String(title || '')
if (text.includes('婚纱') || text.includes('礼服') || text.includes('裙')) {
  return createElementSvg('dress', '服装')
}

if (text.includes('西装') || text.includes('西服')) {
  return createElementSvg('suit', '西装')
}

if (text.includes('中式') || text.includes('唐装') || text.includes('旗袍')) {
  return createElementSvg('chineseClothes', '服装')
}

if (text.includes('T恤') || text.includes('短袖') || text.includes('上衣')) {
  return createElementSvg('tshirt', '上衣')
}

if (text.includes('短裤') || text.includes('长裤') || text.includes('裤')) {
  return createElementSvg('pants', '裤装')
}

if (text.includes('吊带') || text.includes('背心')) {
  return createElementSvg('top', '上衣')
}

if (text.includes('木门') || text.includes('门')) {
  return createElementSvg('door', '门')
}

if (text.includes('拱门') || text.includes('花艺') || text.includes('花门')) {
  return createElementSvg('arch', '拱门')
}
  if (text.includes('水杯') || text.includes('保温杯') || text.includes('杯子')) {
    return createElementSvg('cup', '水杯')
  }

  if (text.includes('显示器') || text.includes('显示屏')) {
    return createElementSvg('monitor', '显示器')
  }

  if (text.includes('笔记本') || text.includes('电脑')) {
    return createElementSvg('laptop', '电脑')
  }

  if (text.includes('纸巾盒') || text.includes('抽纸盒') || text.includes('纸巾')) {
    return createElementSvg('tissue', '纸巾盒')
  }

  if (text.includes('鼠标垫')) {
    return createElementSvg('mousepad', '鼠标垫')
  }

  if (text.includes('鼠标')) {
    return createElementSvg('mouse', '鼠标')
  }

  if (text.includes('键盘')) {
    return createElementSvg('keyboard', '键盘')
  }

  if (text.includes('笔')) {
    return createElementSvg('pen', '笔')
  }

  return createElementSvg('default', '元素')
}

function createElementSvg(type, label) {
  const icons = {
    dress: `
  <path d="M48 24h24l8 18-10 8 14 38H36l14-38-10-8 8-18Z"/>
  <path d="M52 24c2 8 14 8 16 0"/>
`,

suit: `
  <path d="M42 24h36l10 64H32l10-64Z"/>
  <path d="M52 24l8 18 8-18"/>
  <path d="M60 42v44"/>
  <path d="M44 38l16 10 16-10"/>
`,

chineseClothes: `
  <path d="M38 26h44l8 18-12 8v36H42V52l-12-8 8-18Z"/>
  <path d="M60 28v58"/>
  <path d="M60 44c8 0 14-4 18-10"/>
`,

tshirt: `
  <path d="M42 28l10-8h16l10 8 16 12-12 18-8-6v36H46V52l-8 6-12-18 16-12Z"/>
`,

pants: `
  <path d="M42 26h36l-4 62H62l-2-36-2 36H46l-4-62Z"/>
  <path d="M42 40h36"/>
`,

top: `
  <path d="M48 24h24l10 64H38l10-64Z"/>
  <path d="M52 24c0 10 16 10 16 0"/>
  <path d="M48 24l-8 18"/>
  <path d="M72 24l8 18"/>
`,

door: `
  <rect x="34" y="20" width="52" height="78" rx="4"/>
  <path d="M46 20v78"/>
  <path d="M72 60h4"/>
`,

arch: `
  <path d="M28 88V54a32 32 0 0 1 64 0v34"/>
  <path d="M40 88V56a20 20 0 0 1 40 0v32"/>
  <path d="M32 48c8-12 20-20 28-22"/>
  <path d="M88 48c-8-12-20-20-28-22"/>
`,
    cup: `
      <path d="M36 30h34v46a10 10 0 0 1-10 10H46a10 10 0 0 1-10-10V30Z"/>
      <path d="M70 42h8a12 12 0 0 1 0 24h-8"/>
      <path d="M42 24h22"/>
    `,
    monitor: `
      <rect x="24" y="24" width="72" height="46" rx="6"/>
      <path d="M52 70h16v12"/>
      <path d="M42 84h36"/>
    `,
    laptop: `
      <rect x="28" y="26" width="64" height="42" rx="5"/>
      <path d="M20 78h80l-8 10H28l-8-10Z"/>
    `,
    tissue: `
      <path d="M26 48h68l-8 36H34l-8-36Z"/>
      <path d="M42 48c4-15 30-15 36 0"/>
      <path d="M48 38c6-10 18-10 24 0"/>
    `,
    mousepad: `
      <rect x="24" y="26" width="72" height="60" rx="14"/>
      <path d="M42 44h28a10 10 0 0 1 10 10v16"/>
    `,
    mouse: `
      <rect x="42" y="22" width="36" height="68" rx="18"/>
      <path d="M60 22v22"/>
      <path d="M60 46v10"/>
    `,
    keyboard: `
      <rect x="20" y="38" width="80" height="46" rx="8"/>
      <path d="M32 52h6M46 52h6M60 52h6M74 52h6M88 52h6"/>
      <path d="M32 66h40M80 66h12"/>
    `,
    pen: `
      <path d="M34 82l10-26 32-32 18 18-32 32-28 8Z"/>
      <path d="M74 26l18 18"/>
      <path d="M44 56l18 18"/>
    `,
    default: `
      <rect x="28" y="28" width="64" height="64" rx="16"/>
      <path d="M44 60h32"/>
      <path d="M60 44v32"/>
    `,
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="320" height="220" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#2b2d30"/>
          <stop offset="1" stop-color="#111316"/>
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="18" fill="url(#bg)"/>
      <g fill="none" stroke="#d6d8dc" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.9">
        ${icons[type] || icons.default}
      </g>
    </svg>
  `

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function primaryActionLabel(group, changed) {
  if (group === '字幕/文案') return changed ? '更改' : '修改'
  return changed ? '更换' : '替换'
}

function restoreLabel(group) {
  return group === '元素' ? '恢复' : '恢复原始'
}
</script>

<template>
  <aside :class="['replace-rail', 'flow-node', { 'is-revising': revising }]" data-node-key="replaceRail">
    <div class="replace-head">
      <div>
        <h2>上传替换与定制</h2>
        <p>选择要替换的内容，未修改的部分会保留原样。</p>
      </div>
    </div>

    <div v-if="reviseVisible" :class="['revise-notice', { 'is-muted': reviseMuted }]">
      <span></span>
      已回到原始定制节点，请重新选择素材或修改文案后再生成。
    </div>

    <div class="custom-grid">
      <section
        v-for="g in groupedItems"
        :key="g.label"
        :class="['custom-group', `custom-group-${g.class}`]"
      >
        <h3>{{ g.label }}</h3>

        <div
v-if="!isEmptySubjectGroup(g) && !isEmptyCopyGroup(g)"
class="custom-group-grid"
>
          <article
            v-for="item in g.items"
            :key="item.id"
            :class="['custom-item', `custom-item-${g.class}`]"
          >
            <!-- 预览图 -->
            <div
              v-if="g.class !== 'copy'"
              :class="['item-preview', item.preview]"
            >
              <img
  v-if="getCardPreviewUrl(item, g.label)"
  :src="getCardPreviewUrl(item, g.label)"
  :alt="item.title"
  loading="lazy"
/>
              <div v-else class="preview-placeholder">视频帧占位</div>
              <span>{{ itemPreviewLabel(g.label) }}</span>
            </div>

            <!-- 标题 + 已替换标记 -->
            <header>
              <strong>{{ item.title }}</strong>
              <span v-if="item.changed" class="changed-mark">
                {{ g.label === '字幕/文案' ? '已修改' : '已替换' }}
              </span>
            </header>

            <!-- 当前状态 -->
            <p>当前：{{ item.changed ? (g.label === '字幕/文案' ? '已修改' : `已替换为 ${item.current}`) : item.current }}</p>

            <!-- 操作按钮 -->
            <div class="item-actions">
              <button
                data-action="replace"
                @click="g.class === 'copy' ? startCopyEdit(item.id) : togglePicker(item.id)"
              >
                {{ primaryActionLabel(g.label, item.changed) }}
              </button>
              <button
                class="restore-button"
                data-action="restore"
                @click="emit('restore', item.id)"
                title="恢复原始"
              >
                {{ restoreLabel(g.label) }}
              </button>
            </div>

            <!-- 内联 picker 菜单（仅素材类） -->
            <div
              v-if="openPickerId === item.id && g.class !== 'copy'"
              class="inline-picker"
            >
              <button @click="openUploadModal(item.id)">
                <span>上传新素材</span><span>›</span>
              </button>
              <button @click="openLibraryModal(item.id)">
                <span>资产库</span><span>›</span>
              </button>
            </div>

            <!-- 字幕/文案编辑器 -->
            <div
              v-if="editingCopyId === item.id && g.class === 'copy'"
              class="copy-editor"
            >
              <textarea
                v-model="copyDraft"
                :placeholder="`请输入新的${item.title}内容`"
                rows="3"
              ></textarea>
              <div class="copy-editor-actions">
                <button class="copy-save-btn" @click="saveCopyEdit">保存</button>
                <button class="copy-cancel-btn" @click="cancelCopyEdit">取消</button>
                <button class="copy-restore-btn" @click="restoreOriginalCopy">恢复原文</button>
              </div>
            </div>
          </article>
        </div>
<!-- 主体为空时的兜底 -->
<div v-if="isEmptySubjectGroup(g)" class="empty-subject-message">
  当前视频未识别到可替换的主体。
</div>
        <!-- 字幕/文案为空时的兜底 -->
        <div v-if="isEmptyCopyGroup(g)" class="empty-copy-message">
  本视频未识别到任何文字。
</div>
      </section>
    </div>

    <!-- 底部生成区域：本次修改 + 补充生成要求 + 生成按钮 -->
    <div class="change-list">
      <div class="change-list-main">
        <span class="node-caption change-list-title">本次修改</span>
        <ul id="changeList">
          <li
            v-for="item in changedItems"
            :key="item.id"
            class="change-tag"
          >
            <strong class="change-object">{{ item.title }}</strong>
            <span class="change-arrow">→</span>
            <span class="change-value">{{ item.replacement || item.current }}</span>
          </li>
          <li v-if="changedItems.length === 0" class="change-empty">
            还没有替换内容
          </li>
        </ul>
      </div>

      <div id="customGeneratePanel" class="custom-generate-panel">
        <div class="custom-generate-summary">
          <strong>补充生成要求</strong>
          <p>这些要求会和上方替换素材一起用于生成新版本，也可以留空。</p>
          <textarea
            id="customAdjustmentInput"
            :value="modelValue"
            @input="emit('update:modelValue', $event.target.value)"
            placeholder="例如：画面更明亮，动作更慢，镜头更稳定，保留夜晚氛围。"
          ></textarea>
        </div>
        <div class="generation-config-panel">
          <strong>生成配置</strong>
          <p v-if="configStatus === 'loading'" class="config-state">模型配置加载中…</p>
          <p v-else-if="configStatus === 'error'" class="config-state error">
            {{ configError || '模型配置加载失败' }}
            <button type="button" @click="emit('retry-config')">重试</button>
          </p>
          <p v-else-if="configWarning" class="config-state warning">{{ configWarning }}</p>
          <p v-if="configStatus === 'ready' && priceStatus === 'error'" class="config-state error">
            {{ priceError || '计费配置加载失败' }}
            <button type="button" @click="emit('retry-config')">重试</button>
          </p>
          <div v-if="configStatus === 'ready'" class="generation-config-grid">
            <label>视频比例
              <select :value="generationConfig.ratio" :disabled="isGenerating" @change="updateGenerationConfig('ratio', $event.target.value)">
                <option v-for="value in generationOptions.ratios" :key="value" :value="value">{{ value }}</option>
              </select>
            </label>
            <label>视频清晰度
              <select :value="generationConfig.quality" :disabled="isGenerating" @change="updateGenerationConfig('quality', $event.target.value)">
                <option v-for="value in generationOptions.resolutions" :key="value" :value="value">{{ value.toUpperCase() }}</option>
              </select>
            </label>
            <label>视频时长
              <select :value="generationConfig.duration" :disabled="isGenerating" @change="updateGenerationConfig('duration', $event.target.value)">
                <option v-for="value in generationOptions.durations" :key="value" :value="`${value}s`">{{ value }}s</option>
              </select>
            </label>
            <label>生成模型
              <select :value="generationConfig.modelId" :disabled="isGenerating" @change="updateGenerationConfig('modelId', $event.target.value)">
                <option v-for="item in generationOptions.models" :key="item.id" :value="item.id">{{ item.label }}</option>
              </select>
            </label>
          </div>
        </div>
        <div class="custom-generate-footer">
          <span class="generation-config-text">预计消耗：{{ estimatedPriceText }}</span>
          <button
            id="customDirectGenerateBtn"
            class="primary-button branch-generate"
            type="button"
            :disabled="generationDisabled"
            @click="emit('generate')"
          >
            {{ isGenerating ? '生成中...' : configStatus === 'loading' ? '配置加载中...' : configStatus === 'error' ? '配置加载失败' : priceStatus !== 'ready' ? '费用不可用' : generateBtnText }}
          </button>
        </div>
      </div>
    </div>

    <!-- 素材替换弹窗 -->
    <div
      v-if="assetModalVisible"
      class="modal"
      @click.self="closeAssetModal"
    >
      <div class="modal-card asset-card">
        <button class="close-modal" :disabled="isAssetUploading" @click="closeAssetModal">×</button>
        <h2>{{ assetModalTitle }}</h2>
        <p class="breakdown-subtitle">{{ assetModalSubtitle }}</p>

        <!-- 上传模式 -->
        <div v-if="assetModalSource === 'upload'" class="asset-choices upload-choices">
          <button class="upload-dropzone" :disabled="isAssetUploading" @click="triggerFilePick">
            <span>{{ isAssetUploading ? '…' : '＋' }}</span>
            <strong>{{ isAssetUploading ? '正在上传素材…' : '点击上传或拖拽文件到这里' }}</strong>
            <small>{{ isAssetUploading ? '上传完成前请勿重复操作' : '支持图片或视频' }}</small>
          </button>
        </div>

        <!-- 资产库模式 -->
        <div v-else class="asset-choices">
          <article
            v-for="(asset, index) in currentAssetChoices"
            :key="index"
            class="asset-choice-card"
            tabindex="0"
            :aria-disabled="isAssetUploading"
            @click="applyAssetFromLibrary(asset)"
          >
            <img v-if="asset.previewUrl" :src="asset.previewUrl" :alt="asset.name" loading="lazy" />
            <div v-else class="asset-audio-icon"></div>
            <div>
              <strong>{{ asset.name }}</strong>
              <span>{{ asset.type }}</span>
            </div>
          </article>
          <div v-if="currentAssetChoices.length === 0" class="asset-empty-hint">
            资产库暂未接入
          </div>
        </div>

        <div v-if="assetModalSource === 'library'" class="modal-actions asset-modal-actions">
          <button class="ghost-button" @click="closeAssetModal">取消</button>
        </div>
      </div>
    </div>

    <!-- 隐藏的文件 input -->
    <input
      ref="hiddenFileInput"
      type="file"
      accept="image/*"
      hidden
      @change="onFileChange"
    />
  </aside>
</template>

<style scoped>
.generate-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  filter: grayscale(0.2);
}
.replace-rail {
  position: relative;
  z-index: 5;
  display: grid;
  align-content: start;
  gap: 12px;
  width: 100%;
  max-height: none;
  overflow: visible;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(18, 19, 20, 0.94);
  box-shadow: 0 22px 58px rgba(0, 0, 0, 0.38);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.replace-rail.is-revising {
  border-color: rgba(53, 245, 154, 0.42);
  box-shadow: 0 0 0 1px rgba(53, 245, 154, 0.1), 0 22px 58px rgba(0, 0, 0, 0.38), 0 0 32px rgba(53, 245, 154, 0.08);
  animation: reviseRailGlow 1.5s ease both;
}

@keyframes reviseRailGlow {
  0%, 100% {
    box-shadow: 0 0 0 1px rgba(53, 245, 154, 0.1), 0 22px 58px rgba(0, 0, 0, 0.38), 0 0 32px rgba(53, 245, 154, 0.08);
  }
  24%, 66% {
    box-shadow: 0 0 0 1px rgba(53, 245, 154, 0.2), 0 22px 58px rgba(0, 0, 0, 0.38), 0 0 46px rgba(53, 245, 154, 0.22);
  }
}

.revise-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 10px 13px;
  border: 1px solid rgba(53, 245, 154, 0.42);
  border-radius: 12px;
  background: rgba(53, 245, 154, 0.105);
  color: rgba(255, 255, 255, 0.96);
  font-size: 13px;
  font-weight: 800;
  box-shadow: inset 0 0 0 1px rgba(53, 245, 154, 0.04), 0 0 22px rgba(53, 245, 154, 0.08);
  transition: opacity 0.2s ease, border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
  animation: reviseNoticeSpotlight 1.5s ease both;
}

.revise-notice span {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 16px rgba(53, 245, 154, 0.72);
  animation: reviseDotBlink 1.5s ease both;
}

.revise-notice.is-muted {
  opacity: 1;
  color: rgba(255, 255, 255, 0.55);
  border-color: rgba(53, 245, 154, 0.2);
  background: rgba(53, 245, 154, 0.055);
}

@keyframes reviseNoticeSpotlight {
  0%, 100% {
    border-color: rgba(53, 245, 154, 0.42);
    background: rgba(53, 245, 154, 0.105);
    color: rgba(255, 255, 255, 0.55);
    box-shadow: inset 0 0 0 1px rgba(53, 245, 154, 0.04), 0 0 22px rgba(53, 245, 154, 0.08);
  }
  22%, 62% {
    border-color: rgba(53, 245, 154, 0.72);
    background: rgba(53, 245, 154, 0.16);
    color: #ffffff;
    box-shadow: inset 0 0 0 1px rgba(53, 245, 154, 0.08), 0 0 30px rgba(53, 245, 154, 0.2);
  }
}

@keyframes reviseDotBlink {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 16px rgba(53, 245, 154, 0.72);
  }
  25%, 60% {
    transform: scale(1.35);
    box-shadow: 0 0 24px rgba(53, 245, 154, 0.95);
  }
}

.replace-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.replace-head h2 {
  margin: 0;
  color: #f4f5f6;
  font-size: 20px;
  font-weight: 800;
}

.replace-head p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 12px;
}

/* ── 替换项网格 ── */
.custom-grid {
  display: grid;
  gap: 14px;
  margin-top: 2px;
}

.custom-group {
  display: grid;
  gap: 8px;
}

.custom-group h3 {
  margin: 0;
  color: #e5e8ec;
  font-size: 14px;
  font-weight: 700;
}

.custom-group-grid {
  display: grid;
  gap: 8px;
}

.custom-group-subject .custom-group-grid,
.custom-group-scene .custom-group-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.custom-group-element .custom-group-grid {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.custom-group-copy .custom-group-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

/* ── 卡片 ── */
.custom-item {
  position: relative;
  display: grid;
  gap: 8px;
  min-height: 160px;
  padding: 9px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 12px;
  background: rgba(27, 28, 31, 0.9);
}

.custom-item-subject {
  min-height: 184px;
  gap: 5px;
  padding: 8px;
}

.custom-item-scene {
  min-height: 190px;
}

.custom-item-element {
  min-height: 150px;
  padding: 8px;
  gap: 6px;
}

.custom-item-copy {
  min-height: 0;
  align-items: center;
  padding: 10px;
}

.custom-item header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.custom-item strong {
  color: #f0f2f4;
  font-size: 13px;
  font-weight: 700;
}

.custom-item p {
  margin: 0;
  color: #a0a5ad;
  font-size: 12px;
  line-height: 1.45;
}

.changed-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 6px;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(43, 255, 154, 0.12);
  border: 1px solid rgba(43, 255, 154, 0.28);
  color: #8dffba;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

/* ── 预览图 ── */
.item-preview {
  position: relative;
  min-height: 74px;
  overflow: hidden;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.04);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.065);
}

.custom-item-subject .item-preview {
  min-height: 78px;
  aspect-ratio: 16 / 11;
}

.custom-item-scene .item-preview {
  min-height: 88px;
  aspect-ratio: 16 / 8;
}

.custom-item-element .item-preview {
  min-height: 58px;
  aspect-ratio: 1;
}

.item-preview img {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.78) brightness(0.74);
}

.item-preview::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(180deg, transparent 40%, rgba(0, 0, 0, 0.42));
}

.item-preview span {
  position: absolute;
  left: 8px;
  bottom: 7px;
  z-index: 2;
  color: rgba(255, 255, 255, 0.74);
  font-size: 10px;
  font-weight: 700;
}

.preview-placeholder {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: var(--muted);
  font-size: 11px;
}

/* ── 操作按钮 ── */
.item-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  align-self: end;
}

.custom-item-element .item-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 5px;
  width: 100%;
  align-self: end;
}

.item-actions button {
  padding: 7px 11px;
  border-radius: 999px;
  color: #d4d6dc;
  background: rgba(255, 255, 255, 0.075);
  font-size: 12px;
}

.custom-item-element .item-actions button,
.custom-item-copy .item-actions button {
  padding: 6px 8px;
  font-size: 11px;
}

.custom-item-element .item-actions button {
  min-width: 0;
  height: 24px;
  padding: 0 5px;
  overflow: visible;
  font-size: 10px;
  line-height: 1;
  white-space: nowrap;
}

.custom-item-element .item-actions button:not(.restore-button) {
  color: #eafff2;
  background: rgba(53, 245, 154, 0.12);
  box-shadow: inset 0 0 0 1px rgba(53, 245, 154, 0.12);
}

.item-actions .restore-button {
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #8f949b;
  background: rgba(255, 255, 255, 0.035);
}

.item-actions .restore-button:hover {
  color: #cfd3d8;
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.055);
}

/* ── 内联 picker 菜单 ── */
.inline-picker {
  display: grid;
  position: absolute;
  right: 10px;
  bottom: 42px;
  z-index: 20;
  width: 152px;
  overflow: hidden;
  gap: 0;
  padding: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: rgba(22, 23, 26, 0.94);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.38);
  backdrop-filter: blur(10px);
}

.inline-picker button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 34px;
  padding: 8px 9px;
  border-radius: 10px;
  background: transparent;
  color: #d7dbe0;
  font-size: 12px;
  text-align: left;
}

.inline-picker button::before {
  content: "";
  width: 6px;
  height: 6px;
  margin-right: 8px;
  border-radius: 50%;
  background: rgba(53, 245, 154, 0.72);
  box-shadow: 0 0 10px rgba(53, 245, 154, 0.2);
}

.inline-picker button:hover {
  background: rgba(255, 255, 255, 0.075);
  color: #f3fff8;
}

/* ── 字幕/文案编辑器 ── */
.copy-editor {
  display: grid;
  grid-column: 1 / -1;
  gap: 9px;
  margin-top: 3px;
  padding: 10px;
  border: 1px solid rgba(53, 245, 154, 0.14);
  border-radius: 12px;
  background: rgba(7, 9, 10, 0.48);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.025);
}

.copy-editor textarea {
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 9px;
  outline: 0;
  background: rgba(255, 255, 255, 0.055);
  color: #f3f5f7;
  font: inherit;
  font-size: 12px;
  resize: vertical;
}

.copy-editor textarea:focus {
  border-color: rgba(53, 245, 154, 0.44);
  box-shadow: 0 0 0 2px rgba(53, 245, 154, 0.08);
}

.copy-editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.copy-editor-actions button {
  min-height: 28px;
  padding: 5px 9px;
  border: 1px solid rgba(53, 245, 154, 0.22);
  border-radius: 999px;
  color: #eafff2;
  background: rgba(53, 245, 154, 0.1);
  cursor: pointer;
  font-size: 12px;
}

.copy-editor-actions .copy-cancel-btn {
  color: #9ca2a9;
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
}

.copy-editor-actions .copy-restore-btn {
  color: #9ca2a9;
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
}

/* ── 空字幕兜底 ── */
.empty-copy-message {
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.62);
  font-size: 13px;
  line-height: 1.6;
}

/* ── 底部生成区域：大绿框 ── */
.change-list {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;
  margin-top: 18px;
  padding: 18px 20px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(23, 44, 36, 0.88), rgba(12, 28, 24, 0.92));
  border: 1px solid rgba(53, 245, 154, 0.2);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
}

.change-list-main {
  width: 100%;
}

.change-list > strong {
  display: block;
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.94);
  text-align: left;
}

.change-list-title {
  display: block;
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 800;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.96);
  text-align: left;
}

#changeList {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 22px;
  padding: 0;
  list-style: none;
  width: 100%;
}

.change-tag,
.change-empty {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  min-height: 32px;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  line-height: 1.3;
  white-space: nowrap;
}

.change-tag {
  background: rgba(53, 245, 154, 0.1);
  border: 1px solid rgba(53, 245, 154, 0.28);
}

.change-object {
  color: #f3f6f5;
  font-weight: 800;
}

.change-arrow {
  color: rgba(53, 245, 154, 0.72);
  font-weight: 800;
  font-size: 13px;
}

.change-value {
  color: #79ffc0;
  font-weight: 800;
}

.change-empty {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.56);
}

/* 补充生成要求 */
.custom-generate-panel {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
}

.custom-generate-summary {
  width: 100%;
  max-width: none;
  text-align: left;
  padding-top: 2px;
}

.custom-generate-summary strong {
  display: block;
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 800;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.96);
  text-align: left;
}

.custom-generate-summary p {
  margin: 0 0 10px;
  color: rgba(255, 255, 255, 0.58);
  font-size: 12px;
  line-height: 1.5;
  text-align: left;
}

#customAdjustmentInput {
  display: block;
  width: 100%;
  max-width: none;
  min-width: 100%;
  min-height: 84px;
  height: 84px;
  margin: 0;
  box-sizing: border-box;
  resize: vertical;
  border-radius: 14px;
  padding: 12px 14px;
  color: #fff;
  font-size: 13px;
  line-height: 1.6;
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.1);
  outline: none;
  font-family: inherit;
}

#customAdjustmentInput::placeholder {
  color: rgba(255, 255, 255, 0.34);
}

#customAdjustmentInput:focus {
  border-color: rgba(53, 245, 154, 0.3);
}

.custom-generate-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-top: 14px;
}

.generation-config-panel {
  margin-top: 14px;
}
.config-state { display: flex; align-items: center; gap: 10px; margin: 8px 0 0; color: rgba(255,255,255,.58); font-size: 12px; }
.config-state.error { color: #ff8585; }
.config-state.warning { color: #d5ad63; }
.config-state button { padding: 5px 9px; border-radius: 7px; color: #07110c; background: var(--green); font-size: 11px; font-weight: 800; }

.generation-config-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 8px;
}

.generation-config-grid label {
  display: grid;
  gap: 6px;
  color: rgba(255, 255, 255, 0.58);
  font-size: 12px;
}

.generation-config-grid select {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  color: #fff;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 9px;
}

.generation-config-text {
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}

.branch-cost-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  padding: 0 13px;
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.primary-button {
  border-radius: 999px;
  padding: 9px 18px;
  background: var(--green);
  color: #06110a;
  font-weight: 800;
  box-shadow: 0 0 26px rgba(53, 245, 154, 0.2);
}

#customDirectGenerateBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  min-width: 112px;
  padding: 0 22px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
}

.node-caption {
  color: #bfc2c8;
  font-size: 12px;
  font-weight: 700;
}

/* ── 素材弹窗 ── */
.modal {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(8px);
}

.modal-card {
  position: relative;
  width: min(760px, 100%);
  padding: 20px;
  border-radius: 16px;
  background: rgba(20, 21, 22, 0.98);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
}

.modal-card h2 {
  margin: 0;
  color: #f0f4f1;
  font-size: 18px;
  font-weight: 800;
}

.breakdown-subtitle {
  margin: 8px 0 16px;
  color: #a2aaad;
  font-size: 13px;
  line-height: 1.6;
}

.close-modal {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  display: grid;
  place-items: center;
}

.close-modal:hover {
  background: rgba(255, 255, 255, 0.14);
}

.asset-choices {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.upload-choices {
  grid-template-columns: 1fr;
}

.asset-choice-card {
  position: relative;
  display: grid;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background:
    radial-gradient(circle at 50% 18%, rgba(53, 245, 154, 0.18), transparent 34%),
    rgba(255, 255, 255, 0.04);
  color: #d8dadd;
  cursor: pointer;
  transition: border-color 0.16s ease, background 0.16s ease, transform 0.16s ease;
}

.asset-choice-card:hover {
  border-color: rgba(53, 245, 154, 0.56);
  background: rgba(53, 245, 154, 0.085);
  transform: translateY(-1px);
}

.asset-choice-card img {
  width: 100%;
  aspect-ratio: 16 / 10;
  border-radius: 10px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.05);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  filter: saturate(0.82) brightness(0.82);
}

.asset-choice-card div {
  display: grid;
  gap: 4px;
}

.asset-choice-card strong {
  color: #eef2f0;
  font-size: 13px;
}

.asset-choice-card span {
  color: #8e969a;
  font-size: 12px;
}

.asset-empty-hint {
  grid-column: 1 / -1;
  text-align: center;
  padding: 32px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
}

.upload-dropzone {
  display: grid;
  justify-items: center;
  gap: 8px;
  min-height: 180px;
  padding: 26px;
  border: 1px dashed rgba(53, 245, 154, 0.36);
  border-radius: 16px;
  background: rgba(53, 245, 154, 0.045);
  color: #dbe7df;
  cursor: pointer;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.upload-dropzone:hover {
  border-color: rgba(53, 245, 154, 0.72);
  background: rgba(53, 245, 154, 0.085);
}

.upload-dropzone span {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  color: #07120d;
  background: var(--green);
  font-size: 24px;
  font-weight: 700;
}

.upload-dropzone strong {
  font-size: 16px;
}

.upload-dropzone small {
  color: #8d9692;
  font-size: 12px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.ghost-button {
  padding: 9px 16px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: #c6ced0;
  font-size: 13px;
  cursor: pointer;
}

.ghost-button:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.16);
}
.empty-copy-message,
.empty-subject-message {
  margin: 8px 0 24px;
  color: rgba(255, 255, 255, 0.48);
  font-size: 15px;
  line-height: 1.6;
  font-weight: 400;
}
</style>
