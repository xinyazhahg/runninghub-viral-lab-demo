const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ERROR_DEFINITIONS } = require('../lib/errorCodes');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('视频分析超时使用独立 504 错误码并持久化 timeout 状态', () => {
  assert.deepEqual(ERROR_DEFINITIONS.VIDEO_ANALYSIS_TIMEOUT, [504, '视频分析超时，请重新尝试']);
  assert.match(serverSource, /errorCode === 'VIDEO_ANALYSIS_TIMEOUT'/);
  assert.match(serverSource, /status: timedOut \? "timeout" : "failed"/);
  assert.match(serverSource, /error_code: errorCode/);
  assert.match(serverSource, /code: errorCode, errorCode/);
});

test('视频上传、Gemini 调用和总耗时都有结构化日志', () => {
  assert.match(serverSource, /video_understanding\.video_upload_completed/);
  assert.match(serverSource, /video_understanding\.gemini_completed/);
  assert.match(serverSource, /video_understanding\.total_completed/);
  assert.match(serverSource, /video_analysis\.task_completed/);
});
