#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { callRunningHubGeminiVideoUnderstanding } = require('../services/videoUnderstandingService');

async function uploadToRunningHub(videoPath) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(videoPath)], { type: 'video/mp4' }), path.basename(videoPath));
  const response = await fetch('https://www.runninghub.cn/openapi/v2/media/upload/binary', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.RUNNINGHUB_API_KEY}` }, body: form,
  });
  const body = await response.json().catch(() => ({}));
  const url = body?.data?.download_url;
  if (!response.ok || !url) throw new Error(body?.msg || `视频上传失败：HTTP ${response.status}`);
  return url;
}

async function main() {
  const videoPath = process.argv[2];
  if (!videoPath) throw new Error('用法：node scripts/test-video-understanding.js <video.mp4> [public-or-signed-url]');
  if (!process.env.RUNNINGHUB_API_KEY) throw new Error('缺少 RUNNINGHUB_API_KEY');
  const resolvedPath = path.resolve(videoPath);
  const output = await callRunningHubGeminiVideoUnderstanding({
    apiKey: process.env.RUNNINGHUB_API_KEY,
    model: process.env.VIDEO_UNDERSTANDING_MODEL,
    baseUrl: process.env.RUNNINGHUB_LLM_BASE_URL,
    videoUrl: process.argv[3] || await uploadToRunningHub(resolvedPath),
  });
  process.stdout.write(`${JSON.stringify({
    modelName: output.modelName,
    modelVersion: output.modelVersion,
    elapsedMs: output.elapsedMs,
    usage: output.usage,
    estimatedCost: output.estimatedCost,
    normalizedBreakdown: output.normalizedBreakdown,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
