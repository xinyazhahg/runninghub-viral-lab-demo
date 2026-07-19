#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const LIST_ENDPOINT = 'https://www.runninghub.cn/openapi/v2/resource/list';
const PAGE_SIZE = 50;
const FULL_LIST_TYPES = ['UNET'];
const SEARCH_TYPES = ['UNET', 'LORA', 'CHECKPOINT'];
const REPORT_PATH = path.resolve(__dirname, '../reports/runninghub-video-understanding-models.json');
const KEYWORDS = [
  'gemini', 'video understanding', 'video analysis', '视频理解', '视频分析', '多模态理解',
  '单帧分析', '音频理解', 'speech', 'audio', 'dialogue', '对白', '语音识别', '字幕识别',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const evidenceText = (item) => [
  item.resourceName, item.resourceType, item.nodeModelName, stripHtml(item.desc),
  ...(item.tags || []).map((tag) => tag.name),
  ...(item.versions || []).flatMap((version) => [version.baseModel, version.baseModelSubtype, version.desc, version.versionResourceName]),
].filter(Boolean).join(' ');

async function postJson(body, attempt = 0) {
  const response = await fetch(LIST_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RUNNINGHUB_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (response.ok && payload?.code === 0) return payload.data;
  if ((response.status === 429 || payload?.code === 1016) && attempt < 8) {
    await sleep(Math.min(15000, 1200 * (2 ** attempt)) + Math.floor(Math.random() * 300));
    return postJson(body, attempt + 1);
  }
  throw new Error(`RunningHub resource/list 请求失败：HTTP ${response.status}, code=${payload?.code ?? 'unknown'}, msg=${payload?.msg || 'unknown'}`);
}

async function listResourceType(resourceType) {
  const records = [];
  let current = 1;
  let pageCount = 1;
  do {
    const data = await postJson({ resourceType, current, size: PAGE_SIZE });
    records.push(...(data.records || []));
    pageCount = Number(data.pages || 1);
    process.stdout.write(`\r${resourceType}: ${current}/${pageCount} pages, ${records.length}/${data.total || '?'} records`);
    if (!data.hasNext) break;
    current += 1;
    await sleep(420);
  } while (current <= pageCount);
  process.stdout.write('\n');
  return records;
}

async function searchResourceType(resourceType, resourceName) {
  const records = [];
  let current = 1;
  do {
    const data = await postJson({ resourceType, resourceName, current, size: PAGE_SIZE });
    records.push(...(data.records || []));
    if (!data.hasNext) break;
    current += 1;
    await sleep(420);
  } while (current <= Number.MAX_SAFE_INTEGER);
  return records;
}

function explicitCapabilities(item) {
  const text = evidenceText(item);
  const lower = text.toLowerCase();
  const matches = KEYWORDS.filter((keyword) => lower.includes(keyword.toLowerCase()));
  const videoUnderstanding = /video understanding|video analysis|视频理解|视频分析|多模态理解/i.test(text);
  const videoInput = videoUnderstanding || /视频输入|输入视频|video input/i.test(text);
  const audioUnderstanding = /音频理解|audio understanding|audio analysis|语音识别|speech recognition|asr/i.test(text);
  const dialogueRecognition = /对白识别|dialogue recognition|语音识别|speech recognition|transcri/i.test(text);
  const singleFrame = /单帧分析|single[- ]frame analysis|image analysis|图片理解|图像理解/i.test(text);
  const structuredJson = /structured json|json output|结构化 json|严格 json/i.test(text);
  let priority = 4;
  if (videoInput && audioUnderstanding) priority = 1;
  else if (videoInput) priority = 2;
  else if (singleFrame || audioUnderstanding || dialogueRecognition) priority = 3;
  return { matches, videoUnderstanding, videoInput, audioUnderstanding, dialogueRecognition, singleFrame, structuredJson, priority };
}

function normalizeRecord(item) {
  const capability = explicitCapabilities(item);
  return {
    modelName: item.resourceName || null,
    modelId: item.id || null,
    resourceId: item.id || null,
    versionResourceIds: (item.versions || []).map((version) => version.id).filter(Boolean),
    provider: null,
    owner: item.owner?.name || null,
    capabilityType: capability.matches.length ? capability.matches : [],
    endpoint: null,
    inputTypes: null,
    outputTypes: null,
    supportsVideoInput: capability.videoInput ? true : null,
    supportsAudioUnderstanding: capability.audioUnderstanding ? true : null,
    supportsDialogueRecognition: capability.dialogueRecognition ? true : null,
    supportsStructuredJson: capability.structuredJson ? true : null,
    supportsSingleFrameAnalysis: capability.singleFrame ? true : null,
    status: null,
    pricing: null,
    resourceType: item.resourceType || null,
    nodeModelName: item.nodeModelName || null,
    description: stripHtml(item.desc),
    tags: (item.tags || []).map((tag) => tag.name).filter(Boolean),
    versions: (item.versions || []).map((version) => ({
      id: version.id || null,
      version: version.version || null,
      baseModel: version.baseModel || null,
      baseModelSubtype: version.baseModelSubtype || null,
      resourceName: version.versionResourceName || null,
      description: stripHtml(version.desc),
    })),
    evidence: {
      source: 'POST /openapi/v2/resource/list',
      matchedKeywords: capability.matches,
      capabilityFieldsReturnedByApi: false,
      inputOutputSchemaReturnedByApi: false,
      endpointReturnedByApi: false,
      pricingReturnedByApi: false,
      detailEndpointAvailable: false,
    },
    priority: capability.priority,
  };
}

async function main() {
  if (!process.env.RUNNINGHUB_API_KEY) throw new Error('缺少 RUNNINGHUB_API_KEY');
  const queriedAt = new Date().toISOString();
  const raw = [];
  const availableResourceCounts = {};
  for (const resourceType of SEARCH_TYPES) {
    const overview = await postJson({ resourceType, current: 1, size: 1 });
    availableResourceCounts[resourceType] = Number(overview.total || 0);
    await sleep(420);
  }
  for (const resourceType of FULL_LIST_TYPES) raw.push(...await listResourceType(resourceType));
  const searched = [];
  for (const resourceType of SEARCH_TYPES) {
    for (const keyword of KEYWORDS) {
      searched.push(...await searchResourceType(resourceType, keyword));
      await sleep(420);
    }
  }
  const byId = new Map([...raw, ...searched].map((item) => [item.id, item]));
  const allModels = [...byId.values()].map(normalizeRecord);
  const candidates = allModels
    .filter((item) => item.evidence.matchedKeywords.length)
    .sort((a, b) => a.priority - b.priority || a.modelName.localeCompare(b.modelName, 'zh-CN'));
  const verifiedCandidates = candidates.filter((item) => item.priority <= 3);
  const gemini = candidates.filter((item) => /gemini/i.test(`${item.modelName} ${item.description} ${item.versions.map((v) => v.baseModel).join(' ')}`));
  const topCandidates = verifiedCandidates.slice(0, 3);
  const report = {
    generatedAt: queriedAt,
    accountScope: 'current RUNNINGHUB_API_KEY',
    source: {
      endpoint: LIST_ENDPOINT, method: 'POST', pageSize: PAGE_SIZE,
      fullyPaginatedResourceTypes: FULL_LIST_TYPES,
      keywordSearchedResourceTypes: SEARCH_TYPES,
      availableResourceCounts,
    },
    totals: {
      resources: allModels.length,
      returnedAndDeduplicatedResources: allModels.length,
      byResourceType: Object.fromEntries(SEARCH_TYPES.map((type) => [type, allModels.filter((item) => item.resourceType === type).length])),
      keywordCandidates: candidates.length,
      capabilityVerifiedCandidates: verifiedCandidates.length,
    },
    limitations: [
      'resource/list 返回的是 ComfyUI 公共模型资源（UNET/LORA/CHECKPOINT），不是标准模型 API 或 LLM API 的能力目录。',
      `接口当前资源总量为 ${JSON.stringify(availableResourceCounts)}；完整分页 UNET，LORA/CHECKPOINT 仅按本报告全部目标关键词分页检索，避免把数万条无关社区权重误报为企业可调用模型 API。`,
      '接口未返回 provider、调用 endpoint、input/output schema、音频轨理解、结构化 JSON、状态或价格字段。',
      'RunningHub 官方文档未提供可按 resourceId 查询上述能力的公共详情接口，因此未调用猜测性的详情 URL。',
      'null 表示接口没有证据，不能解释为明确不支持。',
    ],
    conclusions: {
      geminiVideoUnderstandingModelExists: gemini.some((item) => item.supportsVideoInput === true),
      geminiNamedResources: gemini.map((item) => ({ modelName: item.modelName, resourceId: item.resourceId, evidence: item.evidence })),
      top3ForViralLab: topCandidates,
      top3Note: topCandidates.length === 3
        ? '仅按接口中的明确能力证据排序。'
        : `接口中只有 ${topCandidates.length} 个具备明确视频/音频分析证据的候选，未用名称猜测补足到 3 个。`,
      stillNeedExternalGeminiApi: topCandidates.length === 0 || !topCandidates.some((item) => item.supportsVideoInput && item.supportsAudioUnderstanding),
      recommendation: '若需要同时理解视频画面、原始音轨、对白时间轴并稳定输出严格 JSON，当前 resource/list 无法证明存在合格模型；应继续使用火山方舟，或接入可验证能力的外部 Gemini API。',
    },
    candidates,
    allModels,
  };
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report written: ${REPORT_PATH}`);
  console.log(JSON.stringify(report.totals));
  console.log(JSON.stringify(report.conclusions));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
