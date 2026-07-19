const { normalizeFineBreakdown } = require('../lib/fineVideoBreakdown');

const DEFAULT_RUNNINGHUB_LLM_BASE_URL = 'https://llm.runninghub.cn/v1';
const DEFAULT_RUNNINGHUB_GEMINI_MODEL = 'google/gemini-3.5-flash';
const VIDEO_ANALYSIS_TIMEOUT_MS = 300000;

const OUTPUT_TEMPLATE = {
  summary: '', duration: 0, shotCount: 0, subjects: [], scenes: [], elements: [],
  shots: [{
    id: 'shot_1', startTime: 0, endTime: 0, duration: 0, thumbnailTime: 0, timeConfirmed: true,
    narrative: { scene: '', characters: [], dialogue: [{ speaker: '', text: '', startTime: 0, endTime: 0, timeConfirmed: true }], subtitles: [], summary: '' },
    cinematography: { shotSize: '', viewAngle: '', cameraPosition: '', cameraMovement: '', composition: '', lensAndDepth: '' },
    visualTreatment: { lighting: '', colorTone: '', contrast: '', imageTexture: '', editing: '' },
    sound: { backgroundMusic: '', environmentSound: '', soundEffects: [], laughter: '', audioSummary: '' },
    narrativeFunction: { shotPurpose: '', storyFunction: '', emotionChange: '' },
    beats: [{ id: 'beat_1', startTime: 0, endTime: 0, timeConfirmed: true, title: '', trigger: '', action: '', expression: '', emotionBefore: '', emotionAfter: '', dialogue: [], continuity: '' }],
    replaceable: { subjects: [], scenes: [], elements: [], elementGroups: [{ name: '小狗服装造型', items: [] }] },
  }],
};

function videoUnderstandingSystemPrompt() {
  return `你是专业广告拉片师。联合分析视频画面与原始音轨，以严格 JSON 对象输出，不得添加 Markdown 或解释。
所有面向用户展示的自然语言字段内容必须只使用自然、流畅的简体中文，包括但不限于 summary、镜头标题、触发、动作、表情、情绪、主体、场景、镜头语言、声音、对白和字幕。禁止输出英文描述或中英文混写；JSON 字段名、id、数字、时间和布尔值保持模板规定的格式。
先按真实剪辑、场景切换或机位变化划分物理镜头 shot；再在每个 shot 内按说话人、新对白、关键动作、表情、情绪、主体状态和剧情因果变化划分 beat。固定机位不等于只有一个 beat。
对白必须来自音轨，字幕必须单独放入 subtitles；没有字幕不能推断没有对白。每条对白必须含 speaker/text/startTime/endTime/timeConfirmed。
所有时间必须来自音频或画面依据，禁止平均分配；无法确认时 startTime/endTime 使用 null 且 timeConfirmed=false。
镜头语言无法可靠判断时返回空字符串，禁止使用套话。可替换项只允许来自真实画面证据，服装默认聚合为“小狗服装造型”，具体服饰放 elementGroups.items。
宁可留空也不要编造厨房、蛋糕、桌子或其他无依据内容。
输出结构必须与下列 JSON 的字段、层级和类型完全一致：${JSON.stringify(OUTPUT_TEMPLATE)}`;
}

function videoUnderstandingPrompt() {
  return '请分析所附视频的完整画面和原始音轨，严格按照系统要求返回 JSON。';
}

const NON_USER_FACING_STRING_KEYS = new Set(['id', 'modelName', 'modelVersion']);

function containsEnglishNaturalLanguage(value) {
  return /\b[A-Za-z]{2,}\b/.test(String(value || ''));
}

function collectEnglishNaturalLanguageFields(value, path = [], parentKey = '') {
  if (typeof value === 'string') {
    if (NON_USER_FACING_STRING_KEYS.has(parentKey) || !containsEnglishNaturalLanguage(value)) return [];
    return [{ path, text: value }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectEnglishNaturalLanguageFields(item, [...path, index], parentKey));
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => (
    NON_USER_FACING_STRING_KEYS.has(key)
      ? []
      : collectEnglishNaturalLanguageFields(item, [...path, key], key)
  ));
}

function parseJsonObject(content) {
  if (content && typeof content === 'object' && !Array.isArray(content)) return content;
  const text = String(content || '').trim();
  const unwrapped = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]?.trim() || text;
  const parsed = JSON.parse(unwrapped);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('语言兜底结果不是 JSON 对象');
  return parsed;
}

function pathKey(path) {
  return JSON.stringify(path);
}

function setValueAtPath(target, path, value) {
  let cursor = target;
  for (let index = 0; index < path.length - 1; index += 1) cursor = cursor[path[index]];
  cursor[path.at(-1)] = value;
}

async function ensureSimplifiedChineseBreakdown({
  breakdown, apiKey, model, fetchImpl, baseUrl, signal, requestId,
}) {
  const pendingFields = collectEnglishNaturalLanguageFields(breakdown);
  if (!pendingFields.length) return { breakdown, translationApplied: false };

  const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 12000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: '你是视频拆解字段翻译器。只把输入中的英文自然语言翻译为自然、流畅的简体中文。必须逐项保留 path，不得增加、删除、合并或重排条目，不得修改 JSON 路径、时间、数字、镜头数量或其他数据。只输出 {"translations":[{"path":[],"text":""}]} JSON。',
        },
        { role: 'user', content: JSON.stringify({ translations: pendingFields }) },
      ],
    }),
  });
  const rawText = await response.text();
  let body;
  try { body = rawText ? JSON.parse(rawText) : {}; } catch { body = { raw: rawText }; }
  if (!response.ok) {
    const error = new Error(body?.error?.message || body?.message || `视频拆解中文化请求失败：HTTP ${response.status}`);
    error.status = response.status;
    error.code = body?.error?.code || body?.code || 'MODEL_REQUEST_FAILED';
    throw error;
  }

  let translated;
  try {
    translated = parseJsonObject(body?.choices?.[0]?.message?.content);
  } catch (cause) {
    const error = new Error(`视频拆解中文化结果格式异常：request_id=${requestId || 'unknown'}`);
    error.code = 'MODEL_RESULT_INVALID';
    error.cause = cause;
    throw error;
  }
  const allowedPaths = new Set(pendingFields.map((item) => pathKey(item.path)));
  const translations = Array.isArray(translated.translations) ? translated.translations : [];
  const translatedByPath = new Map(translations
    .filter((item) => Array.isArray(item?.path) && typeof item?.text === 'string' && allowedPaths.has(pathKey(item.path)))
    .map((item) => [pathKey(item.path), item.text.trim()]));
  const missing = pendingFields.filter((item) => {
    const text = translatedByPath.get(pathKey(item.path));
    return !text || containsEnglishNaturalLanguage(text);
  });
  if (missing.length) {
    const error = new Error(`视频拆解中文化不完整：${missing.length} 个字段仍含英文或缺失`);
    error.code = 'MODEL_RESULT_INVALID';
    error.requestId = requestId;
    throw error;
  }

  const localized = structuredClone(breakdown);
  pendingFields.forEach((item) => setValueAtPath(localized, item.path, translatedByPath.get(pathKey(item.path))));
  return { breakdown: localized, translationApplied: true };
}

function responseType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function responseSummary(value, limit = 360) {
  let text;
  try { text = typeof value === 'string' ? value : JSON.stringify(value); } catch { text = String(value); }
  return String(text || '').replace(/\s+/g, ' ').slice(0, limit);
}

function responseShape(value) {
  const object = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  const nestedType = (key) => object && key in object ? responseType(object[key]) : 'missing';
  return {
    responseType: responseType(value),
    topLevelKeys: object ? Object.keys(object).slice(0, 40) : [],
    resultType: nestedType('result'),
    dataType: nestedType('data'),
    outputType: nestedType('output'),
    contentType: nestedType('content'),
    resultsType: nestedType('results'),
    responseSummary: responseSummary(value),
  };
}

function understandingResponseError(response, context = {}, cause = null) {
  const provider = context.provider || 'unknown';
  const model = context.model || 'unknown';
  const requestId = context.requestId || 'unknown';
  const type = responseType(response);
  const summary = responseSummary(response);
  const error = new Error(`视频理解结果格式异常：provider=${provider}, model=${model}, response_type=${type}, request_id=${requestId}, response_summary=${summary || '<empty>'}`);
  error.code = 'MODEL_RESULT_INVALID';
  error.provider = provider;
  error.model = model;
  error.requestId = requestId;
  error.responseType = type;
  error.responseSummary = summary;
  error.cause = cause || undefined;
  return error;
}

function normalizeUnderstandingResponse(response, context = {}, depth = 0) {
  if (depth > 16) throw understandingResponseError(response, context);
  if (typeof response === 'string') {
    const trimmed = response.trim();
    // 仅当整个响应是 Markdown 代码块时去壳，避免误把 JSON 字符串内部的
    // content: "```json ...```" 当作最外层代码块截断。
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]?.trim();
    const unwrapped = fenced || trimmed;
    try {
      return normalizeUnderstandingResponse(JSON.parse(unwrapped), context, depth + 1);
    } catch (error) {
      if (error?.code === 'MODEL_RESULT_INVALID') throw error;
      throw understandingResponseError(response, context, error);
    }
  }
  if (Array.isArray(response)) {
    for (const item of response) {
      try { return normalizeUnderstandingResponse(item, context, depth + 1); } catch (error) {
        if (error?.code !== 'MODEL_RESULT_INVALID') throw error;
      }
    }
    throw understandingResponseError(response, context);
  }
  if (!response || typeof response !== 'object') throw understandingResponseError(response, context);
  if (Array.isArray(response.shots)
    || (response.overview && typeof response.overview === 'object')
    || response.summary !== undefined
    || response.shotCount !== undefined) return response;
  for (const key of [
    'result', 'data', 'output', 'content', 'text', 'results',
    'response', 'payload', 'value', 'message', 'choices',
  ]) {
    if (response[key] === undefined || response[key] === null) continue;
    try { return normalizeUnderstandingResponse(response[key], context, depth + 1); } catch (error) {
      if (error?.code !== 'MODEL_RESULT_INVALID') throw error;
    }
  }
  throw understandingResponseError(response, context);
}

function parseStrictJsonContent(content, context = {}) {
  return normalizeUnderstandingResponse(content, context);
}

function shouldFallbackUnderstandingError(error) {
  return !['MODEL_RESULT_INVALID', 'MODEL_CONTENT_REJECTED'].includes(error?.code);
}

async function executeUnderstandingWithFallback({ primary, fallback }) {
  try {
    return await primary();
  } catch (error) {
    if (!shouldFallbackUnderstandingError(error) || typeof fallback !== 'function') throw error;
    return fallback(error);
  }
}

async function callRunningHubGeminiVideoUnderstanding({
  apiKey,
  model = DEFAULT_RUNNINGHUB_GEMINI_MODEL,
  videoUrl,
  fetchImpl = fetch,
  timeoutMs = VIDEO_ANALYSIS_TIMEOUT_MS,
  baseUrl = DEFAULT_RUNNINGHUB_LLM_BASE_URL,
  requestId = '',
}) {
  if (!apiKey) throw Object.assign(new Error('未配置 RUNNINGHUB_API_KEY'), { code: 'MODEL_UNAVAILABLE' });
  if (!videoUrl) throw Object.assign(new Error('缺少 Gemini 视频 URL 输入'), { code: 'MODEL_REQUEST_FAILED' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 12000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: videoUnderstandingSystemPrompt() },
          {
          role: 'user',
          content: [
            { type: 'text', text: videoUnderstandingPrompt() },
            { type: 'video_url', video_url: { url: videoUrl } },
          ],
          },
        ],
      }),
    });
    const rawText = await response.text();
    let body;
    try { body = rawText ? JSON.parse(rawText) : {}; } catch { body = { raw: rawText.slice(0, 360) }; }
    if (!response.ok) {
      const error = new Error(body?.error?.message || body?.message || `RunningHub Gemini 视频理解请求失败：HTTP ${response.status}`);
      error.status = response.status;
      error.code = body?.error?.code || body?.code || 'MODEL_REQUEST_FAILED';
      throw error;
    }
    const content = body?.choices?.[0]?.message?.content;
    const parsedUnderstandingResult = normalizeUnderstandingResponse(content, {
      provider: 'runninghub_llm', model, requestId,
    });
    const localized = await ensureSimplifiedChineseBreakdown({
      breakdown: parsedUnderstandingResult,
      apiKey,
      model,
      fetchImpl,
      baseUrl,
      signal: controller.signal,
      requestId,
    });
    const rawUnderstandingResult = localized.breakdown;
    const normalizedBreakdown = normalizeFineBreakdown(rawUnderstandingResult, {
      modelName: model,
      modelVersion: body?.model || model,
    });
    return {
      rawUnderstandingResult,
      normalizedBreakdown,
      modelName: model,
      modelVersion: body?.model || model,
      usage: body?.usage || {},
      estimatedCost: null,
      elapsedMs: Date.now() - startedAt,
      provider: 'runninghub_llm',
      fallback: false,
      translationApplied: localized.translationApplied,
      responseShape: responseShape(body),
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw Object.assign(new Error('视频分析超时，请重新尝试'), {
        code: 'VIDEO_ANALYSIS_TIMEOUT',
        elapsedMs: Math.max(timeoutMs, Date.now() - startedAt),
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  DEFAULT_RUNNINGHUB_LLM_BASE_URL, DEFAULT_RUNNINGHUB_GEMINI_MODEL, VIDEO_ANALYSIS_TIMEOUT_MS,
  OUTPUT_TEMPLATE, callRunningHubGeminiVideoUnderstanding,
  parseStrictJsonContent, normalizeUnderstandingResponse,
  responseSummary, responseType, responseShape, shouldFallbackUnderstandingError,
  executeUnderstandingWithFallback, videoUnderstandingPrompt,
  videoUnderstandingSystemPrompt, containsEnglishNaturalLanguage,
  collectEnglishNaturalLanguageFields, ensureSimplifiedChineseBreakdown,
};
