import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hasRevisionChanges, nextVersionId, resetItemsForRevision } from '../src/revisionFlow.js'
import { formatGenerationSpecs } from '../src/generationPresentation.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('重新改造重置待提交数据但保留输入对象中的原始识别信息', () => {
  const items = [{
    id: 'subject-1', group: '主体', title: '小狗', original: '小狗', current: '奥利奥.jpg',
    changed: true, assetId: 'asset-1', assetUrl: 'https://asset/1', replacement: '奥利奥.jpg',
    subjectPreviewUrl: 'https://preview/original',
  }]
  const reset = resetItemsForRevision(items, 'https://video/cover')
  assert.equal(reset[0].title, '小狗')
  assert.equal(reset[0].current, '小狗')
  assert.equal(reset[0].changed, false)
  assert.equal(reset[0].assetId, '')
  assert.equal(reset[0].replacement, '')
  assert.equal(reset[0].previewUrl, 'https://preview/original')
  assert.equal(items[0].assetId, 'asset-1')
})

test('没有替换或新要求时禁止重复生成', () => {
  assert.equal(hasRevisionChanges([{ group: '主体', changed: false }], ''), false)
  assert.equal(hasRevisionChanges([{ group: '主体', changed: true }], ''), true)
  assert.equal(hasRevisionChanges([], '画面更明亮'), true)
})

test('新版本始终基于现有最高版本递增', () => {
  assert.equal(nextVersionId([{ id: 'V1' }, { id: 'V3' }, { id: 'V2' }]), 'V4')
})

test('结果卡片使用最终10s配置而不是旧4s标签', () => {
  const specs = formatGenerationSpecs({
    ratio: '16:9', quality: '720p', duration: '10s', model: 'Seedance 2.0', creditCost: 12,
  })
  assert.match(specs, /10s/)
  assert.doesNotMatch(specs, /4s/)
})

test('点击重新改造的处理函数不调用生成、计费或任务接口', () => {
  const source = fs.readFileSync(path.join(root, 'src/App.vue'), 'utf8')
  const handler = source.match(/function handleRevise\(version\) \{([\s\S]*?)\n\}/)?.[1] || ''
  assert.ok(handler.includes("focusFlowNode('replaceRail'"))
  assert.ok(handler.includes("adjustmentText.value = ''"))
  assert.ok(handler.includes('createEmptyPromptDraft()'))
  assert.doesNotMatch(handler, /startGeneration|executeGenerate|authFetch|generate-video|freeze|billing/)
  assert.doesNotMatch(handler, /versions\.value\s*=|breakdownData\.value\s*=|uploadedVideo\.[A-Za-z]+\s*=/)
})
