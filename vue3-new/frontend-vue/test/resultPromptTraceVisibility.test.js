import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.join(dirname, '..')
const resultCard = fs.readFileSync(path.join(frontendRoot, 'src', 'components', 'ResultCard.vue'), 'utf8')
const app = fs.readFileSync(path.join(frontendRoot, 'src', 'App.vue'), 'utf8')
const backendService = fs.readFileSync(path.join(frontendRoot, '..', '..', 'backend', 'services', 'taskResultService.js'), 'utf8')

test('普通用户结果卡片不再展示 Prompt 版本与差异入口', () => {
  assert.doesNotMatch(resultCard, /查看\s*Prompt\s*版本与差异/i)
  assert.doesNotMatch(resultCard, /class="prompt-trace"/)
  assert.doesNotMatch(app, /@view-prompt=/)
})

test('Prompt 快照与差异仍由结果持久化服务保存', () => {
  assert.match(backendService, /p_prompt:/)
  assert.match(backendService, /p_user_requirement:/)
  assert.match(backendService, /p_model_params:/)
  assert.match(backendService, /p_diff_from_previous:/)
})
