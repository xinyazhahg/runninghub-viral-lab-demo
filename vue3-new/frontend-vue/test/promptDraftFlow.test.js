import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  applyGeneratedPrompt, createEmptyPromptDraft, editPromptDraft, markPromptDraftStale,
  promptInputFingerprint, stripPromptGenerationConfig, validatePromptDraft,
} from '../src/promptDraftFlow.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const automaticPrompt = '@图片1：主体素材\n按时间划分的剧情和动作：\n主体按镜头时间轴完成动作。'
const replacements = [{ assetId: 'asset-1', url: 'https://asset/1', group: '主体', name: '奥利奥.jpg' }]

test('生成 Prompt 建立 draft，用户编辑后提交内容保持为用户版本', () => {
  const fingerprint = promptInputFingerprint({ replacements, ratio: '9:16' })
  const creativePlan = { storyLogic: '保持原剧情' }
  const draft = applyGeneratedPrompt(createEmptyPromptDraft(), {
    finalPrompt: automaticPrompt, creativePlan, warnings: ['提示'],
    source: { creativePlan: 'director_agent', prompt: 'seedance_prompt_generator' },
  }, fingerprint)
  assert.deepEqual(draft.creativePlan, creativePlan)
  assert.deepEqual(draft.warnings, ['提示'])
  const edited = editPromptDraft(draft, `${automaticPrompt}\n用户明确修改`)
  assert.equal(edited.status, 'edited')
  assert.equal(edited.promptSource, 'user_edited')
  assert.match(edited.finalPrompt, /用户明确修改/)
  assert.equal(validatePromptDraft({ state: edited, currentFingerprint: fingerprint, replacementCount: 1 }), '')
})

test('旧 Prompt 的内嵌生成配置在展示和编辑前被清理', () => {
  const legacy = `${automaticPrompt}\n【生成配置】\n比例：adaptive\n清晰度：720p\n生成模型：Seedance 2.0\n生成时长：4s`
  assert.equal(stripPromptGenerationConfig(legacy), automaticPrompt)
  const draft = applyGeneratedPrompt(createEmptyPromptDraft(), { prompt: legacy }, 'fingerprint')
  assert.equal(draft.finalPrompt, automaticPrompt)
})

test('素材或配置变化会使 Prompt stale，且 stale Prompt 不能提交', () => {
  const fingerprint = promptInputFingerprint({ replacements, ratio: '9:16' })
  const draft = applyGeneratedPrompt(createEmptyPromptDraft(), { prompt: automaticPrompt }, fingerprint)
  const stale = markPromptDraftStale(draft)
  const changed = promptInputFingerprint({ replacements, ratio: '16:9' })
  assert.equal(stale.status, 'stale')
  assert.match(validatePromptDraft({ state: stale, currentFingerprint: changed, replacementCount: 1 }), /重新生成创作方案/)
})

test('目标生成时长不参与创作方案指纹或提交校验', () => {
  const fingerprintAt4s = promptInputFingerprint({ replacements, ratio: '9:16', duration: '4s' })
  const fingerprintAt10s = promptInputFingerprint({ replacements, ratio: '9:16', duration: '10s' })
  assert.equal(fingerprintAt4s, fingerprintAt10s)
  const draft = applyGeneratedPrompt(createEmptyPromptDraft(), { prompt: automaticPrompt }, fingerprintAt4s)
  assert.equal(validatePromptDraft({ state: draft, currentFingerprint: fingerprintAt10s, replacementCount: 1 }), '')
})

test('首次生成配置同步原视频时长，且不把配置时长传给 Prompt 生成', () => {
  const source = fs.readFileSync(path.join(root, 'src/App.vue'), 'utf8')
  const syncHandler = source.match(/function syncInitialGenerationDurationToSource\(rawDuration\) \{([\s\S]*?)\n\}/)?.[1] || ''
  assert.match(syncHandler, /activeGenerationOptions\.value\.durations/)
  assert.match(syncHandler, /resultParams\.duration = `\$\{selectedDuration\}s`/)
  assert.match(source, /syncInitialGenerationDurationToSource\(info\.durationSeconds\)/)
  assert.match(source, /syncInitialGenerationDurationToSource\(currentSourceVideoDuration\(\)\)/)
  assert.match(source, /generationDurationChangedByUser/)
})

test('生成 Prompt 请求与确认生成请求在前端入口明确分离', () => {
  const source = fs.readFileSync(path.join(root, 'src/App.vue'), 'utf8')
  const promptHandler = source.match(/async function handleGeneratePrompt\(\) \{([\s\S]*?)\n\}/)?.[1] || ''
  assert.match(promptHandler, /\/api\/generate-prompt/)
  assert.match(promptHandler, /source:\s*\{\s*videoDuration:\s*currentSourceVideoDuration\(\)\s*\}/)
  assert.doesNotMatch(promptHandler, /duration:\s*resultParams\.duration|generationConfig:[\s\S]*?duration:/)
  assert.doesNotMatch(promptHandler, /\/api\/generate-video|freeze|billing|executeGenerate|createTask/)
  const confirmHandler = source.match(/async function handleConfirmGeneration\(\) \{([\s\S]*?)\n\}/)?.[1] || ''
  assert.match(confirmHandler, /validatePromptDraft/)
  assert.match(confirmHandler, /startGeneration/)
})
