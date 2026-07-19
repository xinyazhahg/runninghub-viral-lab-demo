import test from 'node:test'
import assert from 'node:assert/strict'
import { inferReferenceBinding, purposeLabel } from '../src/referenceBinding.js'

const placeholders = [
  { id: 'subject_01', group: '主体', original: '人物', changed: false },
  { id: 'scene_01', group: '场景', original: '厨房', changed: false },
  { id: 'element_01', group: '元素', original: '蛋糕', changed: false },
]

test('图片优先匹配02节点主体、场景和元素占位', () => {
  assert.deepEqual(inferReferenceBinding({ type: 'image', fileName: '厨房参考.png', placeholders }), {
    purpose: 'scene_reference', targetPlaceholderId: 'scene_01', confidence: 0.94,
  })
  assert.equal(inferReferenceBinding({ type: 'image', fileName: '人物肖像.jpg', placeholders }).purpose, 'character_reference')
  assert.equal(inferReferenceBinding({ type: 'image', fileName: '蛋糕产品.png', placeholders }).purpose, 'prop_reference')
})

test('视频和音频使用类型默认值，无法判断的图片提示通用参考', () => {
  assert.equal(inferReferenceBinding({ type: 'video', fileName: 'motion.mp4', placeholders }).purpose, 'action_reference')
  assert.equal(inferReferenceBinding({ type: 'audio', fileName: 'voice.wav', placeholders }).purpose, 'audio_reference')
  const unknown = inferReferenceBinding({ type: 'image', fileName: 'IMG_001.png', placeholders })
  assert.equal(unknown.purpose, 'general_reference')
  assert.ok(unknown.confidence < 0.5)
  assert.equal(purposeLabel(unknown.purpose), '通用参考')
})
