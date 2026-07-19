import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanBreakdownResult } from '../src/utils/cleanBreakdown.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const appSource = fs.readFileSync(path.join(dirname, '..', 'src', 'App.vue'), 'utf8')
const serverSource = fs.readFileSync(path.join(dirname, '..', '..', '..', 'backend', 'server.js'), 'utf8')

test('前端 v2 拆解只按 finalBreakdown 证据集合做减法', () => {
  const output = cleanBreakdownResult({
    breakdownVersion: 2,
    evidence: {
      subjects: ['小狗'],
      scenes: ['客厅', '米色沙发'],
      elements: ['小狗服装', '发绳', '米色沙发'],
    },
    overview: {
      replaceableSubjects: ['小狗'],
      replaceableScenes: ['客厅', '米色沙发', '厨房'],
      replaceableElements: ['小狗服装', '发绳', '米色沙发', '蛋糕', '桌子'],
    },
    shots: [{
      scene: '客厅、米色沙发、厨房',
      elements: ['小狗服装', '发绳', '米色沙发', '蛋糕', '桌子'],
      replaceableScenes: ['客厅', '厨房'],
      replaceableElements: ['米色沙发', '蛋糕'],
    }],
  })
  assert.deepEqual(output.overview.replaceableScenes, ['客厅', '米色沙发'])
  assert.deepEqual(output.overview.replaceableElements, ['小狗服装', '发绳', '米色沙发'])
  assert.equal(output.shots[0].scene, '客厅、米色沙发')
  assert.deepEqual(output.shots[0].elements, ['小狗服装', '发绳', '米色沙发'])
})

test('普通项目恢复与轮询只读取 normalized_breakdown', () => {
  const restoreBlock = appSource.slice(appSource.indexOf('async function restoreProjectTasksAndResults'), appSource.indexOf('async function restoreProjectState'))
  const analysisBlock = appSource.slice(appSource.indexOf('async function handleUploaded'), appSource.indexOf('function handleReplace'))
  assert.match(restoreBlock, /output_data\.normalized_breakdown/)
  assert.doesNotMatch(restoreBlock, /output_data\.result|rawResult|finalBreakdown/)
  assert.match(analysisBlock, /data\.normalizedBreakdown/)
  assert.doesNotMatch(analysisBlock, /parseBreakdownResult\(data\.result\)/)
})

test('后端保存 raw_understanding_result 与 normalized_breakdown，并兼容旧数据', () => {
  assert.match(serverSource, /raw_understanding_result/)
  assert.match(serverSource, /normalized_breakdown/)
  assert.match(serverSource, /materializeBreakdownOutput/)
  assert.match(serverSource, /CURRENT_BREAKDOWN_VERSION\s*=\s*2/)
})
