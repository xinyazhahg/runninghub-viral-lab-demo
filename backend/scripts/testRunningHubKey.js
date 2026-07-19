#!/usr/bin/env node
'use strict';

const ENDPOINT = 'https://www.runninghub.cn/openapi/v2/resource/list';

async function main() {
  const apiKey = String(process.env.RUNNINGHUB_API_KEY || '').trim();
  if (!apiKey) {
    console.log(JSON.stringify({
      connected: false,
      httpStatus: null,
      totalResources: null,
      firstResource: null,
      errorCode: 'MISSING_API_KEY',
      errorMessage: 'RUNNINGHUB_API_KEY 未配置',
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ current: 1, size: 1 }),
    });
    const payload = await response.json().catch(() => null);
    const first = payload?.data?.records?.[0] || null;
    const connected = response.ok && payload?.code === 0;
    console.log(JSON.stringify({
      connected,
      httpStatus: response.status,
      totalResources: payload?.data?.total != null ? Number(payload.data.total) : null,
      firstResource: first ? {
        name: first.resourceName || null,
        type: first.resourceType || null,
      } : null,
      errorCode: connected ? null : (payload?.code ?? `HTTP_${response.status}`),
      errorMessage: connected ? null : (payload?.msg || payload?.message || '请求失败'),
    }, null, 2));
    if (!connected) process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({
      connected: false,
      httpStatus: null,
      totalResources: null,
      firstResource: null,
      errorCode: error?.code || 'NETWORK_ERROR',
      errorMessage: error?.message || '请求失败',
    }, null, 2));
    process.exitCode = 1;
  }
}

main();
