import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const app = fs.readFileSync(path.join(root, 'src/App.vue'), 'utf8')
const replaceRail = fs.readFileSync(path.join(root, 'src/components/ReplaceRail.vue'), 'utf8')
const generationNode = fs.readFileSync(path.join(root, 'src/components/VideoGenerationNode.vue'), 'utf8')
const uploadNode = fs.readFileSync(path.join(root, 'src/components/UploadCard.vue'), 'utf8')
const resultNode = fs.readFileSync(path.join(root, 'src/components/ResultCard.vue'), 'utf8')
const promptEditor = fs.readFileSync(path.join(root, 'src/components/PromptEditor.vue'), 'utf8')
const api = fs.readFileSync(path.join(root, 'src/api.js'), 'utf8')

function functionBody(name) {
  return app.match(new RegExp(`async function ${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n\\}`))?.[1] || ''
}

test('上传替换节点只开始创作，不展示视频配置、预计积分或视频提交按钮', () => {
  const template = replaceRail.split('<template>')[1]?.split('</template>')[0] || ''
  assert.match(template, /changedSummaryItems/)
  assert.match(template, /<div class="change-summary-muted">修改：<\/div>/)
  assert.match(template, /change-summary-item/)
  assert.match(template, /change-summary-result"> → /)
  assert.match(replaceRail, /暂未修改/)
  assert.doesNotMatch(template, /本次修改|change-list-main|change-tag/)
  assert.match(replaceRail, /开始创作/)
  assert.match(replaceRail, /正在理解参考视频\.\.\.[\s\S]*分析剧情、镜头、节奏与导演思路/)
  assert.match(replaceRail, /正在分析导演思路\.\.\.[\s\S]*规划作品结构与创作逻辑/)
  assert.match(replaceRail, /正在生成创作方案\.\.\.[\s\S]*融合新的角色、场景和参考素材/)
  assert.doesNotMatch(template, /补充生成要求|customAdjustmentInput/)
  assert.doesNotMatch(template, /视频比例|视频清晰度|视频时长|生成模型|预计积分|确认生成视频/)
})

test('Prompt 请求开始即创建节点，成功聚焦，失败展示可重试状态', () => {
  const handler = functionBody('handleGeneratePrompt')
  assert.match(handler, /\/api\/generate-prompt/)
  assert.match(handler, /applyGeneratedPrompt/)
  assert.match(handler, /focusFlowNode\('videoGenerationNode'\)/)
  assert.doesNotMatch(handler, /\/api\/generate-video|executeGenerate|freeze|billing/)
  assert.match(app, /v-if="flowMode === 'customizing' && generationNodeVisible"/)
  assert.match(app, /generationNodeVisible = computed\(\(\) => \([\s\S]*promptDraft\.status !== 'idle'[\s\S]*isGeneratingPrompt\.value[\s\S]*promptGenerationFailed\.value/)
  assert.match(handler, /catch \(error\)[\s\S]*promptGenerationError\.value/)
  assert.match(generationNode, /正在生成创作提示词[\s\S]*正在结合视频拆解和参考素材生成，请稍候/)
  assert.match(generationNode, /提示词生成失败，请重试[\s\S]*emit\('retry-prompt'\)/)
  assert.match(app, /@retry-prompt="handleGeneratePrompt"/)
})

test('视频生成节点按素材、创作方案、Prompt、配置、操作顺序轻量展示', () => {
  const references = generationNode.indexOf('class="node-section reference-section"')
  const director = generationNode.indexOf('class="director-plan"')
  const config = generationNode.indexOf('生成配置')
  const prompt = generationNode.indexOf('完整 Prompt')
  const actions = generationNode.indexOf('class="generation-actions"')
  assert.ok(references > -1 && references < director)
  assert.ok(director < prompt)
  assert.ok(prompt < config)
  assert.ok(config < actions)
  assert.doesNotMatch(generationNode, /class="generation-preview"|视频生成后将在这里展示/)
  assert.match(generationNode, /视频正在生成中[\s\S]*视频已生成[\s\S]*视频生成失败/)
  assert.doesNotMatch(generationNode, />重新生成 Prompt<|emit\('regenerate-prompt'\)/)
  assert.ok(generationNode.indexOf('预计积分') < generationNode.indexOf("emit('generate')"))
  assert.match(generationNode, /'生成视频'/)
})

test('画布四个主节点使用统一序号标题，首页空态不显示序号', () => {
  assert.match(uploadNode, /FlowNodeHeader v-if="video\.name \|\| status !== 'idle'" step="01" title="视频解析"/)
  assert.match(replaceRail, /FlowNodeHeader step="02" title="上传替换与定制"/)
  assert.match(generationNode, /FlowNodeHeader step="03" title="创作提示词与配置"/)
  assert.match(resultNode, /FlowNodeHeader step="04" title="视频结果"/)
  assert.doesNotMatch(app, /global-step|stepper|步骤条/)
})

test('参考素材、Prompt、生成配置和 Creative Plan 都按需展开', () => {
  assert.match(generationNode, /reference-preview-button[\s\S]*previewAsset = asset/)
  assert.match(generationNode, /displayReference[\s\S]*Image[\s\S]*Video[\s\S]*Audio/)
  assert.match(generationNode, /导演创作方案[\s\S]*creativePlan\.storyLogic[\s\S]*creativePlan\.directorLogic[\s\S]*creativePlan\.changes[\s\S]*creativePlan\.unchanged/)
  assert.doesNotMatch(generationNode, /creativePlan\.timeline/)
  assert.match(generationNode, /promptExpanded \|\| !promptHasOverflow[\s\S]*展开全部[\s\S]*收起/)
  assert.match(promptEditor, /@focus="handleFocus"[\s\S]*is-collapsed/)
  assert.match(generationNode, /configSummary[\s\S]*configExpanded[\s\S]*生成配置/)
})

test('生成按钮只受生成态、Prompt、素材上传和配置完整性约束，正常态为绿色', () => {
  const disabled = generationNode.match(/const generateDisabled = computed\(\(\) =>([\s\S]*?)\)\nconst configSummary/)?.[1] || ''
  assert.match(disabled, /isGenerating[\s\S]*isGeneratingPrompt[\s\S]*promptGenerationFailed[\s\S]*referenceUploading[\s\S]*configReady[\s\S]*promptValue/)
  assert.doesNotMatch(disabled, /priceStatus|promptStale/)
  assert.match(generationNode, /\.generation-actions \.primary-button[\s\S]*background: var\(--green\)/)
  assert.match(generationNode, /\.primary-button:disabled[\s\S]*background: rgba\(255,255,255,.1\)/)
})

test('03参考素材上传成功后立即复用现有 Prompt 生成请求并持久化界面状态', () => {
  const uploadHandler = functionBody('uploadGenerationReference')
  const promptHandler = functionBody('handleGeneratePrompt')
  assert.match(uploadHandler, /persistReferenceAsset[\s\S]*extraReferenceAssets\.value\.push[\s\S]*await handleGeneratePrompt\(\)/)
  assert.match(promptHandler, /isGeneratingPrompt\.value = true[\s\S]*persistPromptUiState\('generating'\)/)
  assert.match(promptHandler, /applyGeneratedPrompt[\s\S]*persistPromptUiState\('success'\)/)
  assert.match(promptHandler, /catch \(error\)[\s\S]*persistPromptUiState\('failed'\)/)
  assert.match(app, /restorePromptUiState\(project\.id\)/)
})

test('最新结果默认展示，旧结果进入历史版本折叠区', () => {
  assert.match(app, /latestDisplayVersion = computed/)
  assert.match(app, /historicalDisplayVersions = computed/)
  assert.match(app, /<details v-if="historicalDisplayVersions\.length"[^>]*class="history-results"/)
  assert.match(app, /历史版本（\{\{ historicalDisplayVersions\.length \}\}）/)
})

test('用户编辑后的 Prompt 是视频请求唯一提交内容，只有视频按钮链路创建任务', () => {
  const confirm = functionBody('handleConfirmGeneration')
  const execute = functionBody('executeGenerate')
  assert.match(confirm, /validatePromptDraft/)
  assert.match(confirm, /startGeneration/)
  assert.match(execute, /promptDraft\.finalPrompt\.trim\(\)/)
  assert.match(execute, /formData\.append\('prompt', description\)/)
  assert.match(execute, /\/api\/generate-video/)
  assert.doesNotMatch(functionBody('handleGeneratePrompt'), /\/api\/generate-video/)
})

test('只有比例变化使创作方案 stale，目标时长与清晰度不影响已有方案', () => {
  const updateBlock = app.match(/function updateGenerationConfig\(nextConfig\) \{([\s\S]*?)\n\}/)?.[1] || ''
  assert.match(updateBlock, /\['ratio'\]/)
  assert.doesNotMatch(updateBlock, /\['duration'|\['quality'/)
  assert.match(updateBlock, /markPromptDraftStale/)
})

test('03参考素材使用物理类型并携带用途，刷新时按 purpose 恢复', () => {
  assert.match(api, /persistReferenceAsset\(projectId, file, assetType, binding = \{\}\)/)
  assert.match(api, /formData\.append\('file', file\)[\s\S]*formData\.append\('assetType', assetType\)[\s\S]*formData\.append\('purpose', binding\.purpose/)
  assert.doesNotMatch(api, /multipart\/form-data|Content-Type['"]\s*:\s*['"]multipart/)
  assert.match(app, /persistReferenceAsset\(projectId\.value, file, type, binding\)/)
  assert.match(app, /\.filter\(isReferenceAsset\)[\s\S]*type: persistedAssetType\(asset\)/)
  assert.match(app, /referenceAssetIds', JSON\.stringify\(extraReferenceAssets\.value\.map\(\(asset\) => asset\.assetId\)\)/)
})

test('用途标签可轻量修改并持久化完整绑定字段', () => {
  assert.match(generationNode, /REFERENCE_PURPOSE_OPTIONS[\s\S]*aria-label="素材用途"/)
  assert.match(generationNode, /emit\('update-reference-binding', \{ asset, purpose:/)
  assert.match(app, /updateProjectAssetBinding\(projectId\.value, asset\.assetId, nextBinding\)/)
  assert.match(app, /assetRef:[\s\S]*targetPlaceholderId:[\s\S]*confidence:/)
})

test('03参考素材入口独立校验类型并在完成或取消后清空选择状态', () => {
  assert.match(generationNode, /const pendingReferenceType = ref\(null\)/)
  assert.match(generationNode, /referenceAcceptFor\(type\)/)
  assert.match(generationNode, /validateReferenceFileType\(expectedType, file\)/)
  assert.match(generationNode, /emit\('upload-reference', \{ expectedType, type: expectedType, file, replaceAsset \}\)/)
  assert.match(generationNode, /@cancel="resetReferenceSelection"/)
  assert.match(generationNode, /function resetReferenceSelection\(\)[\s\S]*pendingReferenceType\.value = null[\s\S]*pendingReplaceAsset\.value = null/)
  assert.match(generationNode, /\[reference-upload\] entry_clicked/)
  assert.match(generationNode, /\[reference-upload\] file_selected/)
  assert.match(api, /\[reference-upload\] request/)
  assert.match(app, /\[reference-upload\] response/)
})
