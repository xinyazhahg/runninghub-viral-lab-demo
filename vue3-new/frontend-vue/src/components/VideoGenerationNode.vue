<script setup>
import { computed, ref, watch } from 'vue'
import { stripPromptGenerationConfig } from '../promptDraftFlow.js'
import PromptEditor from './PromptEditor.vue'
import FlowNodeHeader from './FlowNodeHeader.vue'
import { REFERENCE_PURPOSE_OPTIONS, purposeLabel } from '../referenceBinding.js'
import { referenceAcceptFor, validateReferenceFileType } from '../referenceFileTypes.js'

const props = defineProps({
  generationConfig: { type: Object, default: () => ({}) },
  generationOptions: { type: Object, default: () => ({ models: [], ratios: [], resolutions: [], durations: [] }) },
  estimatedPriceText: { type: String, default: '费用计算中' },
  priceStatus: { type: String, default: 'loading' },
  priceError: { type: String, default: '' },
  configStatus: { type: String, default: 'loading' },
  configError: { type: String, default: '' },
  configWarning: { type: String, default: '' },
  promptStatus: { type: String, default: 'idle' },
  promptValue: { type: String, default: '' },
  promptMappings: { type: Array, default: () => [] },
  creativePlan: { type: Object, default: null },
  promptError: { type: String, default: '' },
  promptGenerationFailed: { type: Boolean, default: false },
  generationError: { type: String, default: '' },
  isGeneratingPrompt: { type: Boolean, default: false },
  isGenerating: { type: Boolean, default: false },
  generationStatus: { type: String, default: '' },
  generationPhase: { type: String, default: '' },
  result: { type: Object, default: null },
  referenceAssets: { type: Array, default: () => [] },
  referenceUploading: { type: Boolean, default: false },
})

const emit = defineEmits([
  'update:generationConfig', 'update:prompt', 'generate',
  'retry-config', 'retry-generation', 'retry-prompt',
  'upload-reference', 'delete-reference',
  'update-reference-binding',
])

const referenceMode = ref('multi')
const referenceFileInput = ref(null)
const pendingReferenceType = ref(null)
const pendingReplaceAsset = ref(null)
const referenceTypeError = ref('')
const previewAsset = ref(null)
const promptExpanded = ref(false)
const configExpanded = ref(false)

function chooseReference(type, replaceAsset = null) {
  if (!referenceAcceptFor(type)) return
  console.info('[reference-upload] entry_clicked', { entryType: type, replacingAssetId: replaceAsset?.assetId || null })
  pendingReferenceType.value = type
  pendingReplaceAsset.value = replaceAsset
  referenceTypeError.value = ''
  if (referenceFileInput.value) {
    referenceFileInput.value.value = ''
    referenceFileInput.value.accept = referenceAcceptFor(type)
    referenceFileInput.value.click()
  }
}

function resetReferenceSelection() {
  pendingReferenceType.value = null
  pendingReplaceAsset.value = null
  if (referenceFileInput.value) {
    referenceFileInput.value.value = ''
    referenceFileInput.value.accept = ''
  }
}

function onReferenceFile(event) {
  const file = event.target.files?.[0]
  const expectedType = pendingReferenceType.value
  const replaceAsset = pendingReplaceAsset.value
  resetReferenceSelection()
  if (!file || !expectedType) return
  const validation = validateReferenceFileType(expectedType, file)
  console.info('[reference-upload] file_selected', {
    entryType: expectedType, fileName: file.name, fileType: file.type || '', detectedType: validation.actualType,
  })
  if (!validation.ok) {
    const label = { image: '图片', video: '视频', audio: '音频' }[expectedType]
    referenceTypeError.value = `参考素材类型与上传文件不匹配，请选择${label}文件。`
    return
  }
  referenceTypeError.value = ''
  emit('upload-reference', { expectedType, type: expectedType, file, replaceAsset })
}

const promptStale = computed(() => props.promptStatus === 'stale')
const visiblePrompt = computed(() => stripPromptGenerationConfig(props.promptValue))
const replacementHighlightTerms = computed(() => props.referenceAssets.map((asset) => asset.reference).filter(Boolean))
const promptHasOverflow = computed(() => visiblePrompt.value.split(/\r?\n/).length > 8 || visiblePrompt.value.length > 520)
const configReady = computed(() => props.configStatus === 'ready'
  && props.generationOptions.models?.length
  && props.generationOptions.ratios?.length
  && props.generationOptions.resolutions?.length
  && props.generationOptions.durations?.length)
const generateDisabled = computed(() => props.isGenerating
  || props.isGeneratingPrompt
  || props.promptGenerationFailed
  || props.referenceUploading
  || !configReady.value
  || !String(props.promptValue || '').trim())
const configSummary = computed(() => {
  const model = props.generationConfig.model
    || props.generationOptions.models?.find((item) => item.id === props.generationConfig.modelId)?.label
    || 'SeeDance 2.0'
  return `${model} · ${props.generationConfig.duration || '--'} · ${props.generationConfig.ratio || '--'} · ${String(props.generationConfig.quality || '--').toUpperCase()}`
})
const generationState = computed(() => {
  if (props.isGenerating) return { type: 'running', text: '视频正在生成中' }
  if (props.result?.videoUrl) return { type: 'success', text: '视频已生成' }
  if (props.generationStatus === 'timeout') return { type: 'failed', text: '视频生成超时' }
  if (['failed', 'timeout', 'cancelled'].includes(props.generationStatus)) return { type: 'failed', text: '视频生成失败' }
  return null
})

watch(() => props.promptStatus, (status, previous) => {
  if (status === 'draft' && previous !== 'draft') promptExpanded.value = false
})

function displayReference(asset) {
  return String(asset.reference || '')
    .replace(/^@图片/, 'Image')
    .replace(/^@视频/, 'Video')
    .replace(/^@音频/, 'Audio')
}

function assetPurposeLabel(asset) {
  if (asset.purpose) return purposeLabel(asset.purpose)
  if (asset.locked && asset.type === 'image') return '替换素材'
  return { image: '图片参考', video: '视频参考', audio: '音频参考' }[asset.type] || '参考素材'
}

function updateConfig(key, value) {
  emit('update:generationConfig', { ...props.generationConfig, [key]: value })
}
</script>

<template>
  <article class="video-generation-node flow-node">
    <FlowNodeHeader step="03" title="创作提示词与配置" />

    <div v-if="generationState" :class="['generation-status-bar', `is-${generationState.type}`]" role="status">
      <span v-if="generationState.type === 'running'" class="generation-spinner"></span>
      <span v-else class="status-dot"></span>
      <strong>{{ generationState.text }}</strong>
      <small v-if="generationState.type === 'running'">{{ generationPhase || '任务已提交，请稍候' }}</small>
      <small v-else-if="generationState.type === 'failed'">{{ generationError || '生成任务未完成' }}</small>
      <button v-if="generationState.type === 'failed'" type="button" @click="emit('retry-generation')">重新生成</button>
    </div>

    <section class="node-section reference-section">
      <div class="reference-heading">
        <strong>参考素材</strong>
        <div class="reference-tabs">
          <button type="button" :class="{ active: referenceMode === 'multi' }" @click="referenceMode = 'multi'">多参</button>
          <button type="button" :class="{ active: referenceMode === 'frames' }" @click="referenceMode = 'frames'">首尾帧</button>
        </div>
      </div>
      <div v-if="referenceMode === 'multi'" class="reference-assets">
        <article v-for="asset in referenceAssets" :key="asset.key || asset.assetId" class="reference-card">
          <div class="reference-content">
          <button type="button" class="reference-preview-button" :aria-label="`预览 ${displayReference(asset)}`" @click="previewAsset = asset">
            <img v-if="asset.type === 'image'" :src="asset.url" :alt="asset.name" />
            <span v-else class="reference-file-icon">{{ asset.type === 'audio' ? '♫' : '▶' }}</span>
          </button>
            <span class="reference-meta">
              <span class="reference-purpose-row">
              <strong>{{ displayReference(asset) }}</strong>
                <b>·</b>
                <select
                  v-if="!asset.locked"
                  :value="asset.purpose || 'general_reference'"
                  aria-label="素材用途"
                  @change="emit('update-reference-binding', { asset, purpose: $event.target.value })"
                >
                  <option v-for="option in REFERENCE_PURPOSE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
                <small v-else>{{ assetPurposeLabel(asset) }}</small>
              </span>
              <em v-if="asset.needsConfirmation">请确认用途</em>
            </span>
          </div>
          <span v-if="!asset.locked" class="reference-controls">
            <button type="button" @click="chooseReference(asset.type, asset)">重传</button>
            <button type="button" @click="emit('delete-reference', asset)">×</button>
          </span>
        </article>
        <button type="button" class="reference-add" :disabled="referenceUploading" @click="chooseReference('image')">＋ Image</button>
        <button type="button" class="reference-add" :disabled="referenceUploading" @click="chooseReference('audio')">＋ Audio</button>
        <button type="button" class="reference-add" :disabled="referenceUploading" @click="chooseReference('video')">＋ Video</button>
      </div>
      <p v-else class="state-text">首尾帧模式入口已保留，后续版本开放。</p>
      <p v-if="referenceTypeError" class="state-text error">{{ referenceTypeError }}</p>
      <input
        ref="referenceFileInput"
        class="reference-file-input"
        type="file"
        :accept="referenceAcceptFor(pendingReferenceType)"
        @change="onReferenceFile"
        @cancel="resetReferenceSelection"
      />
    </section>

    <details v-if="creativePlan" class="director-plan">
      <summary>导演创作方案</summary>
      <div class="director-plan-content">
        <p v-if="creativePlan.storyLogic"><strong>剧情</strong>{{ creativePlan.storyLogic }}</p>
        <p v-if="creativePlan.directorLogic"><strong>导演思路</strong>{{ creativePlan.directorLogic }}</p>
        <div v-if="creativePlan.changes?.length"><strong>替换内容</strong><ul><li v-for="item in creativePlan.changes" :key="item">{{ item }}</li></ul></div>
        <div v-if="creativePlan.unchanged?.length"><strong>保持内容</strong><ul><li v-for="item in creativePlan.unchanged" :key="item">{{ item }}</li></ul></div>
      </div>
    </details>

    <section class="node-section prompt-section">
      <div class="section-heading">
        <strong>完整 Prompt</strong>
        <span v-if="isGeneratingPrompt" class="prompt-heading-state">生成中</span>
        <span v-else-if="promptGenerationFailed" class="prompt-heading-state is-error">生成失败</span>
        <span v-else-if="promptStatus === 'edited'">已修改</span>
        <span v-else-if="promptStatus === 'stale'">已失效</span>
        <span v-else>可编辑</span>
      </div>
      <div v-if="isGeneratingPrompt" class="prompt-loading-state" role="status" aria-live="polite">
        <span class="prompt-loading-spinner" aria-hidden="true"></span>
        <div>
          <strong>正在生成创作提示词<span class="loading-ellipsis" aria-hidden="true"></span></strong>
          <p>正在结合视频拆解和参考素材生成，请稍候</p>
        </div>
      </div>
      <div v-else-if="promptGenerationFailed" class="prompt-failed-state" role="alert">
        <span class="status-dot" aria-hidden="true"></span>
        <div>
          <strong>提示词生成失败，请重试</strong>
          <p v-if="promptError">{{ promptError }}</p>
        </div>
        <button type="button" @click="emit('retry-prompt')">重新生成</button>
      </div>
      <template v-else>
        <p v-if="promptStale" class="state-text error">素材或生成内容已变化，请重新生成创作方案。</p>
        <ul v-if="promptMappings.length" class="mapping-list">
          <li v-for="mapping in promptMappings" :key="mapping.reference">
            <strong>{{ mapping.reference }}</strong>：{{ mapping.group }}<template v-if="mapping.name && mapping.name !== mapping.group"> · {{ mapping.name }}</template>
          </li>
        </ul>
        <PromptEditor
          :model-value="visiblePrompt"
          :highlight-terms="replacementHighlightTerms"
          :disabled="isGenerating"
          :expanded="promptExpanded || !promptHasOverflow"
          @update:model-value="emit('update:prompt', $event)"
          @focus="promptExpanded = true"
        />
        <button v-if="promptHasOverflow" type="button" class="prompt-expand-button" @click="promptExpanded = !promptExpanded">
          {{ promptExpanded ? '收起' : '展开全部' }}
        </button>
        <p v-if="promptError" class="state-text error">{{ promptError }}</p>
      </template>
    </section>

    <section class="node-section config-section">
      <button type="button" class="config-summary" :aria-expanded="configExpanded" @click="configExpanded = !configExpanded">
        <span><strong>生成配置</strong><small>{{ configSummary }}</small></span>
        <b>{{ configExpanded ? '收起' : '展开' }}</b>
      </button>
      <p v-if="configStatus === 'loading'" class="state-text">模型配置加载中…</p>
      <p v-else-if="configStatus === 'error'" class="state-text error">
        {{ configError || '模型配置加载失败' }}
        <button type="button" @click="emit('retry-config')">重试</button>
      </p>
      <p v-else-if="configWarning" class="state-text warning">{{ configWarning }}</p>
      <div v-if="configStatus === 'ready' && configExpanded" class="config-grid">
        <label>视频比例
          <select :value="generationConfig.ratio" :disabled="isGenerating" @change="updateConfig('ratio', $event.target.value)">
            <option v-for="value in generationOptions.ratios" :key="value" :value="value">{{ value }}</option>
          </select>
        </label>
        <label>视频清晰度
          <select :value="generationConfig.quality" :disabled="isGenerating" @change="updateConfig('quality', $event.target.value)">
            <option v-for="value in generationOptions.resolutions" :key="value" :value="value">{{ value.toUpperCase() }}</option>
          </select>
        </label>
        <label>视频时长
          <select :value="generationConfig.duration" :disabled="isGenerating" @change="updateConfig('duration', $event.target.value)">
            <option v-for="value in generationOptions.durations" :key="value" :value="`${value}s`">{{ value }}s</option>
          </select>
        </label>
        <label>生成模型
          <select :value="generationConfig.modelId" disabled>
            <option v-for="item in generationOptions.models" :key="item.id" :value="item.id">{{ item.label }}</option>
          </select>
        </label>
      </div>
    </section>

    <div class="generation-actions">
      <div class="generation-cost">
        <span>预计积分：{{ estimatedPriceText }}</span>
        <small v-if="priceStatus === 'error'">{{ priceError || '费用暂不可用' }}</small>
      </div>
      <button type="button" class="primary-button" :disabled="generateDisabled" :aria-busy="isGenerating" @click="emit('generate')">
        <span v-if="isGenerating" class="button-spinner"></span>
        {{ isGenerating ? '生成中…' : '生成视频' }}
      </button>
    </div>
    <p v-if="generationError && !['failed', 'timeout', 'cancelled'].includes(generationStatus)" class="state-text error">{{ generationError }}</p>

    <div v-if="previewAsset" class="asset-preview-modal" @pointerdown.stop @click.self="previewAsset = null">
      <section class="asset-preview-dialog">
        <button type="button" class="asset-preview-close" aria-label="关闭预览" @click="previewAsset = null">×</button>
        <strong>{{ displayReference(previewAsset) }} · {{ assetPurposeLabel(previewAsset) }}</strong>
        <img v-if="previewAsset.type === 'image'" :src="previewAsset.url" :alt="previewAsset.name" />
        <video v-else-if="previewAsset.type === 'video'" :src="previewAsset.url" controls playsinline></video>
        <audio v-else :src="previewAsset.url" controls></audio>
        <small>{{ previewAsset.name }}</small>
      </section>
    </div>
  </article>
</template>

<style scoped>
.video-generation-node { position: relative; display: grid; gap: 12px; width: 720px; padding: 18px; border: 1px solid var(--line); border-radius: 16px; background: rgba(18, 19, 20, .96); box-shadow: 0 24px 68px rgba(0,0,0,.42); }
.generation-status-bar { display: flex; align-items: center; gap: 8px; min-height: 38px; padding: 8px 11px; border: 1px solid rgba(255,255,255,.09); border-radius: 10px; color: #d8dfdc; background: rgba(255,255,255,.035); }
.generation-status-bar strong { font-size: 12px; }
.generation-status-bar small { min-width: 0; flex: 1; overflow: hidden; color: var(--muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.generation-status-bar button { padding: 4px 9px; border-radius: 7px; color: #ffd1d1; background: rgba(255,92,92,.1); }
.generation-status-bar.is-success { border-color: rgba(53,245,154,.22); color: #9effc9; background: rgba(53,245,154,.06); }
.generation-status-bar.is-failed { border-color: rgba(255,92,92,.22); color: #ffaaaa; background: rgba(255,92,92,.06); }
.generation-spinner, .button-spinner { width: 14px; height: 14px; flex: 0 0 auto; border: 2px solid rgba(53,245,154,.18); border-top-color: var(--green); border-radius: 50%; animation: spin .8s linear infinite; }
.status-dot { width: 7px; height: 7px; flex: 0 0 auto; border-radius: 50%; background: currentColor; }
@keyframes spin { to { transform: rotate(360deg); } }
.node-section { display: grid; gap: 10px; padding: 14px; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; background: rgba(255,255,255,.025); }
.node-section > strong, .section-heading strong { color: #f0f3f2; }
.reference-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.reference-heading > strong { color: #f0f3f2; }
.reference-tabs { display: flex; gap: 4px; padding: 3px; border-radius: 9px; background: rgba(255,255,255,.05); }
.reference-tabs button { min-height: 28px; padding: 0 11px; border: 0; border-radius: 7px; color: var(--muted); background: transparent; font-size: 12px; }
.reference-tabs button.active { color: #09130e; background: var(--green); font-weight: 800; }
.reference-assets { display: flex; gap: 7px; width: 100%; overflow-x: auto; padding-bottom: 2px; }
.reference-card, .reference-add { position: relative; flex: 0 0 auto; height: 58px; box-sizing: border-box; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: #0b0e0d; }
.reference-card { width: 194px; padding: 5px; }
.reference-content { display: grid; grid-template-columns: 42px minmax(0,1fr); align-items: center; gap: 8px; width: 100%; height: 100%; }
.reference-preview-button { display: block; width: 42px; height: 42px; padding: 0; color: inherit; background: transparent; text-align: left; }
.reference-preview-button img { width: 42px; height: 42px; object-fit: cover; border-radius: 7px; }
.reference-file-icon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 7px; color: #79ffc0; background: rgba(53,245,154,.09); font-size: 17px; }
.reference-meta { display: grid; min-width: 0; gap: 2px; }
.reference-purpose-row { display: flex; min-width: 0; align-items: center; gap: 3px; }
.reference-purpose-row strong { flex: 0 0 auto; color: #79ffc0; font-size: 11px; }
.reference-purpose-row b { color: rgba(255,255,255,.34); font-size: 10px; }
.reference-purpose-row select { min-width: 0; width: 92px; padding: 0; border: 0; color: #d9dfdc; background: transparent; font-size: 10px; }
.reference-meta small { overflow: hidden; color: var(--muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.reference-meta em { color: #ffd379; font-size: 9px; font-style: normal; }
.reference-controls { position: absolute; top: 3px; right: 3px; display: none; gap: 3px; }
.reference-card:hover .reference-controls, .reference-card:focus-within .reference-controls { display: flex; }
.reference-controls button { min-width: 20px; height: 20px; padding: 0 4px; border-radius: 5px; color: #fff; background: rgba(0,0,0,.78); font-size: 9px; }
.reference-add { display: grid; place-items: center; min-width: 72px; padding: 0 9px; color: rgba(255,255,255,.68); border-style: dashed; font-size: 11px; }
.reference-add:hover { color: #79ffc0; border-color: rgba(53,245,154,.35); }
.reference-file-input { display: none; }
.director-plan { padding: 0 13px; border: 1px solid rgba(255,255,255,.08); border-radius: 11px; background: rgba(255,255,255,.02); }
.director-plan summary { padding: 11px 0; cursor: pointer; color: #dbe1de; font-size: 12px; font-weight: 800; }
.director-plan-content { display: grid; gap: 9px; padding: 0 0 13px; color: var(--muted); font-size: 12px; line-height: 1.55; }
.director-plan-content p, .director-plan-content ul, .director-plan-content ol { margin: 0; }
.director-plan-content p { display: grid; gap: 3px; }
.director-plan-content ul, .director-plan-content ol { padding-left: 18px; }
.director-plan-content strong { display: block; margin-bottom: 3px; color: #e8eeeb; }
.config-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
.config-grid label { display: grid; gap: 6px; color: var(--muted); font-size: 12px; }
.config-grid select { min-height: 38px; padding: 0 10px; border: 1px solid rgba(255,255,255,.11); border-radius: 9px; color: #fff; background: #151817; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.section-heading span { color: var(--muted); font-size: 12px; }
.section-heading .prompt-heading-state { color: #9bcfb4; }
.section-heading .prompt-heading-state.is-error { color: #ff9696; }
.prompt-loading-state, .prompt-failed-state { display: flex; align-items: center; gap: 12px; min-height: 148px; padding: 18px; box-sizing: border-box; border: 1px solid rgba(53,245,154,.13); border-radius: 10px; background: #0b0e0d; }
.prompt-loading-state > div, .prompt-failed-state > div { display: grid; min-width: 0; flex: 1; gap: 5px; }
.prompt-loading-state strong, .prompt-failed-state strong { color: #e9efec; font-size: 13px; }
.prompt-loading-state p, .prompt-failed-state p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
.prompt-loading-spinner { width: 22px; height: 22px; flex: 0 0 auto; border: 2px solid rgba(53,245,154,.18); border-top-color: var(--green); border-radius: 50%; animation: spin .8s linear infinite; }
.loading-ellipsis::after { content: '...'; display: inline-block; width: 1.5em; overflow: hidden; vertical-align: bottom; animation: loading-dots 1.2s steps(4,end) infinite; }
@keyframes loading-dots { 0% { width: 0; } 100% { width: 1.5em; } }
.prompt-failed-state { min-height: 112px; border-color: rgba(255,92,92,.2); background: rgba(255,92,92,.035); }
.prompt-failed-state .status-dot { color: #ff9696; }
.prompt-failed-state button { flex: 0 0 auto; padding: 7px 11px; border-radius: 8px; color: #ffd1d1; background: rgba(255,92,92,.11); }
.mapping-list { display: grid; gap: 4px; margin: 0; padding-left: 20px; color: var(--muted); font-size: 12px; }
.prompt-expand-button { justify-self: end; padding: 4px 2px; color: #8eeebb; background: transparent; font-size: 11px; font-weight: 800; }
.config-section { gap: 8px; }
.config-summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; color: #f0f3f2; background: transparent; text-align: left; }
.config-summary span { display: flex; min-width: 0; align-items: center; gap: 10px; }
.config-summary small { overflow: hidden; color: var(--muted); font-size: 11px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.config-summary b { color: #83efb7; font-size: 10px; }
.generation-actions { display: flex; align-items: center; justify-content: flex-end; gap: 14px; }
.generation-cost { display: grid; justify-items: end; gap: 2px; color: var(--muted); font-size: 11px; line-height: 1.35; font-weight: 500; }
.generation-cost small { color: #ff9696; font-size: 10px; }
.generation-actions .primary-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-width: 132px; min-height: 44px; padding: 0 20px; border-radius: 10px; color: #04120a; background: var(--green); font-weight: 900; box-shadow: 0 0 24px rgba(53,245,154,.18); }
.generation-actions .primary-button:hover:not(:disabled) { box-shadow: 0 0 30px rgba(53,245,154,.32); }
.generation-actions .primary-button:disabled { cursor: not-allowed; color: rgba(255,255,255,.4); background: rgba(255,255,255,.1); box-shadow: none; }
.button-spinner { border-color: rgba(4,18,10,.2); border-top-color: #04120a; }
.state-text { margin: 0; color: var(--muted); font-size: 12px; }
.state-text.error { color: #ff9696; }
.state-text.warning { color: #ffd379; }
.asset-preview-modal { position: fixed; inset: 0; z-index: 120; display: grid; place-items: center; padding: 24px; background: rgba(0,0,0,.72); backdrop-filter: blur(8px); }
.asset-preview-dialog { position: relative; display: grid; gap: 12px; width: min(680px, 88vw); max-height: 82vh; padding: 18px; border: 1px solid rgba(255,255,255,.13); border-radius: 14px; background: #131615; }
.asset-preview-dialog > strong { color: #f0f4f2; }
.asset-preview-dialog > img, .asset-preview-dialog > video { width: 100%; max-height: 66vh; object-fit: contain; border-radius: 10px; background: #080a09; }
.asset-preview-dialog > audio { width: 100%; }
.asset-preview-dialog > small { color: var(--muted); }
.asset-preview-close { position: absolute; top: 10px; right: 10px; z-index: 2; width: 30px; height: 30px; border-radius: 50%; color: #fff; background: rgba(0,0,0,.68); }
@media (max-width: 820px) { .video-generation-node { width: min(720px, calc(100vw - 32px)); } .config-grid { grid-template-columns: 1fr; } }
</style>
