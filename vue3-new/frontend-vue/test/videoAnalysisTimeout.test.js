import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const appSource = fs.readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const apiSource = fs.readFileSync(new URL('../src/api.js', import.meta.url), 'utf8')

test('视频分析前端等待 330 秒并识别后端超时状态', () => {
  assert.match(appSource, /VIDEO_ANALYSIS_WAIT_TIMEOUT_MS\s*=\s*330_000/)
  assert.match(appSource, /\['failed', 'timeout', 'cancelled'\]\.includes\(data\.status\)/)
  assert.match(appSource, /data\.errorCode\s*\|\|\s*data\.code\s*\|\|\s*\(data\.status === 'timeout' \? 'VIDEO_ANALYSIS_TIMEOUT'/)
  assert.match(apiSource, /VIDEO_ANALYSIS_TIMEOUT:\s*'视频分析超时，请重新尝试'/)
})

test('上传、分析、长时分析和无需重传的重新分析状态已接入', () => {
  assert.match(appSource, /正在上传视频/)
  assert.match(appSource, /正在分析视频/)
  assert.match(appSource, /分析时间较长，请勿关闭页面/)
  assert.match(appSource, /retryVideoAnalysis/)
  assert.match(appSource, />重新分析<\/button>/)
})
