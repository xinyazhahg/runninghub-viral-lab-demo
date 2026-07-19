import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const component = fs.readFileSync(path.join(dirname, '..', 'src', 'components', 'BreakdownModal.vue'), 'utf8')
const app = fs.readFileSync(path.join(dirname, '..', 'src', 'App.vue'), 'utf8')

test('精细拆解弹窗使用左右镜头卡片并展示完整信息模块', () => {
  for (const label of ['叙事要素', '台词对白', '镜头语言', '影像处理', '声音', '叙事功能', '动作阶段']) {
    assert.match(component, new RegExp(label))
  }
  assert.match(component, /class="shot-side"/)
  assert.match(component, /class="shot-detail fine-detail"/)
  assert.match(component, /grid-template-columns: 210px minmax\(0, 1fr\)/)
  assert.match(component, /fine-detail \.beats-section \{ grid-column: 1 \/ -1/)
  assert.doesNotMatch(component, /original-video-section|上传替换与定制|<details/)
  assert.match(component, /shot\.narrative\?\.dialogue/)
  assert.match(component, /shot\.cinematography\?\.cameraMovement/)
  assert.match(component, /shot\.beats/)
})

test('前端识别 v3 normalized_breakdown 并保留旧结构兼容入口', () => {
  assert.match(app, /function normalizeFineBreakdownData/)
  assert.match(app, /breakdownVersion \|\| 0\) >= 3/)
  assert.match(app, /output_data\?\.normalized_breakdown/)
  assert.match(app, /function normalizeBreakdownData/)
})
