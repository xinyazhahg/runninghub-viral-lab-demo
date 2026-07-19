const test = require('node:test');
const assert = require('node:assert/strict');
const {
  callRunningHubGeminiVideoUnderstanding,
  parseStrictJsonContent, normalizeUnderstandingResponse,
  executeUnderstandingWithFallback, VIDEO_ANALYSIS_TIMEOUT_MS,
} = require('../services/videoUnderstandingService');
const { refineBreakdown } = require('../lib/breakdownRefiner');
const { legacyToFineBreakdown } = require('../lib/fineVideoBreakdown');

function dogBreakdown() {
  const dialogue = [
    ['画外音', '谁好看？', 0.2, 1.0], ['小狗', '妈妈好看。', 1.0, 2.0],
    ['画外音', '爸爸好看吗？', 2.0, 2.8], ['小狗', '爸爸不好看。', 2.8, 3.6],
    ['画外音', '别让爸爸听见了。', 3.6, 4.6], ['小狗', '爸爸可帅啦，爸爸帅死啦。', 5.4, 7.8],
  ].map(([speaker, text, startTime, endTime]) => ({ speaker, text, startTime, endTime, timeConfirmed: true }));
  return {
    summary: '小狗坐在客厅沙发区回应提问，震惊捂嘴后急忙改口，最后笑着倒在米色沙发上。',
    duration: 10, shotCount: 1, subjects: ['小狗'], scenes: ['客厅沙发区'],
    elements: ['粉色T恤', '黄色背带裤', '黄色鞋子', '橙色发夹'],
    shots: [{
      id: 'shot_1', startTime: 0, endTime: 10, duration: 10, thumbnailTime: 1, timeConfirmed: true,
      narrative: { scene: '客厅沙发区', characters: ['小狗'], dialogue, subtitles: [], summary: '固定机位记录小狗回答、震惊、改口和笑倒的完整过程。' },
      cinematography: { shotSize: '中近景', viewAngle: '平视', cameraPosition: '正面', cameraMovement: '固定镜头', composition: '小狗居中', lensAndDepth: '较深景深，主体与背景均较清晰' },
      visualTreatment: { lighting: '自然光', colorTone: '暖调', contrast: '', imageTexture: '写实', editing: '单镜头无转场' },
      sound: { backgroundMusic: '', environmentSound: '室内环境声', soundEffects: [], laughter: '结尾笑声', audioSummary: '画外音与小狗对白，结尾笑声' },
      narrativeFunction: { shotPurpose: '建立问答情境', storyFunction: '完成反转笑点', emotionChange: '平静到震惊紧张，再到讨好和开心' },
      beats: [
        ['回应提问', 0, 2, '小狗坐在沙发上回应提问'],
        ['对白变化', 2, 3.6, '表情和嘴部配合第二轮对白变化'],
        ['震惊捂嘴', 3.6, 5.4, '听到提醒后震惊并抬爪捂嘴'],
        ['急忙改口', 5.4, 7.8, '急忙改口夸奖爸爸'],
        ['笑着倒下', 7.8, 10, '开心笑着向后倒在沙发上'],
      ].map(([title, startTime, endTime, action], index) => ({ id: `beat_${index + 1}`, startTime, endTime, timeConfirmed: true, title, trigger: '', action, expression: '', emotionBefore: '', emotionAfter: '', dialogue: [], continuity: '' })),
      replaceable: { subjects: ['小狗'], scenes: ['客厅沙发区'], elements: ['粉色T恤', '黄色背带裤', '黄色鞋子', '橙色发夹'], elementGroups: [{ name: '小狗服装造型', items: ['粉色T恤', '黄色背带裤', '黄色鞋子', '橙色发夹'] }] },
    }],
  };
}

test('RunningHub AI站 Gemini 使用 video_url 联合分析画面音轨并要求严格 JSON', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      text: async () => JSON.stringify({
        model: 'rh-llm-g/rh-g-flash-35',
        choices: [{ message: { content: JSON.stringify(dogBreakdown()) } }],
        usage: { prompt_tokens: 120, completion_tokens: 80 },
      }),
    };
  };
  const output = await callRunningHubGeminiVideoUnderstanding({
    apiKey: 'runninghub-test-key',
    model: 'google/gemini-3.5-flash',
    videoUrl: 'https://runninghub.example/test.mp4',
    fetchImpl,
    requestId: 'req-gemini-video',
  });
  assert.equal(request.url, 'https://llm.runninghub.cn/v1/chat/completions');
  assert.equal(request.options.headers.Authorization, 'Bearer runninghub-test-key');
  assert.equal(request.body.model, 'google/gemini-3.5-flash');
  assert.equal(request.body.response_format.type, 'json_object');
  assert.equal(request.body.messages[0].content[1].type, 'video_url');
  assert.equal(request.body.messages[0].content[1].video_url.url, 'https://runninghub.example/test.mp4');
  assert.match(request.body.messages[0].content[0].text, /原始音轨/);
  assert.equal(output.provider, 'runninghub_llm');
  assert.equal(output.modelVersion, 'rh-llm-g/rh-g-flash-35');
  assert.equal(output.normalizedBreakdown.shots[0].beats.length, 5);
});

test('小狗精细拆解聚合服装且不产生厨房、蛋糕、桌子', async () => {
  const raw = dogBreakdown();
  raw.scenes.push('厨房'); raw.elements.push('蛋糕', '桌子');
  raw.shots[0].replaceable.elements.push('蛋糕', '桌子');
  const fetchImpl = async () => ({ ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify(raw) } }] }) });
  const { normalizedBreakdown } = await callRunningHubGeminiVideoUnderstanding({ apiKey: 'test-key', videoUrl: 'https://example.com/dog.mp4', fetchImpl });
  const serialized = JSON.stringify(normalizedBreakdown);
  assert.equal(serialized.includes('厨房'), false);
  assert.equal(serialized.includes('蛋糕'), false);
  assert.equal(serialized.includes('桌子'), false);
  assert.deepEqual(normalizedBreakdown.elements, ['小狗服装造型']);
  assert.equal(normalizedBreakdown.shots[0].cinematography.cameraMovement, '固定镜头');
});

test('统一解析对象、JSON字符串、Markdown JSON与嵌套结果', () => {
  const value = { summary: 'test', shots: [] };
  assert.equal(normalizeUnderstandingResponse(value), value);
  assert.deepEqual(normalizeUnderstandingResponse(JSON.stringify(value)), value);
  assert.deepEqual(normalizeUnderstandingResponse(`\`\`\`json\n${JSON.stringify(value)}\n\`\`\``), value);
  assert.deepEqual(normalizeUnderstandingResponse({ result: { content: JSON.stringify(value) } }), value);
  assert.deepEqual(normalizeUnderstandingResponse(JSON.stringify(JSON.stringify(value))), value);
  assert.deepEqual(normalizeUnderstandingResponse({
    taskId: 'rh-task', status: 'SUCCESS',
    results: [{ url: null, outputType: 'text', text: JSON.stringify(value) }],
  }), value);
  assert.deepEqual(normalizeUnderstandingResponse({
    data: JSON.stringify({ output: { content: `\`\`\`json\n${JSON.stringify(value)}\n\`\`\`` } }),
  }), value);
});

test('RunningHub results[0].text 可转换为前端 normalized_breakdown', () => {
  const legacy = {
    overview: {
      referenceVideo: '一只小狗坐在客厅沙发上。', shotCount: 1,
      replaceableSubjects: ['小狗'], replaceableScenes: ['客厅沙发'], replaceableElements: ['小狗服装'],
    },
    shots: [{
      id: 'shot1', time: '00:00-00:10', title: '小狗坐在沙发上',
      description: '一只小狗坐在客厅沙发上回应画外音。', action: '小狗回应提问',
      people: '小狗', scene: '客厅沙发', elements: ['小狗服装'], camera: '中景，固定机位',
    }],
  };
  const envelope = { taskId: 'rh-task', status: 'SUCCESS', results: [{ outputType: 'text', text: JSON.stringify(legacy) }] };
  const parsed = normalizeUnderstandingResponse(envelope, { provider: 'runninghub', model: 'video-to-text', requestId: 'req-rh' });
  const normalized = legacyToFineBreakdown(refineBreakdown(parsed), { modelName: 'video-to-text', modelVersion: 'legacy' });
  assert.equal(normalized.summary, legacy.overview.referenceVideo);
  assert.equal(normalized.shots.length >= 1, true);
  assert.equal(normalized.modelName, 'video-to-text');
  assert.equal(normalized.breakdownVersion, 3);
});

test('非 JSON 文本返回包含 provider、model、类型、摘要和 request_id 的明确错误', () => {
  assert.throws(
    () => parseStrictJsonContent('普通自由文本', { provider: 'runninghub_llm', model: 'google/gemini-3.5-flash', requestId: 'req-1' }),
    (error) => error.code === 'MODEL_RESULT_INVALID'
      && /provider=runninghub_llm/.test(error.message)
      && /model=google\/gemini-3\.5-flash/.test(error.message)
      && /response_type=string/.test(error.message)
      && /request_id=req-1/.test(error.message)
      && /普通自由文本/.test(error.message),
  );
});

test('新模型请求失败后 fallback 成功，格式失败不会静默 fallback', async () => {
  let fallbackCalls = 0;
  const requestError = Object.assign(new Error('temporary unavailable'), { code: 'MODEL_REQUEST_FAILED' });
  const output = await executeUnderstandingWithFallback({
    primary: async () => { throw requestError; },
    fallback: async () => { fallbackCalls += 1; return { provider: 'runninghub_fallback', normalizedBreakdown: dogBreakdown() }; },
  });
  assert.equal(output.provider, 'runninghub_fallback');
  assert.equal(fallbackCalls, 1);

  const formatError = Object.assign(new Error('invalid json'), { code: 'MODEL_RESULT_INVALID' });
  await assert.rejects(() => executeUnderstandingWithFallback({
    primary: async () => { throw formatError; },
    fallback: async () => { fallbackCalls += 1; return {}; },
  }), /invalid json/);
  assert.equal(fallbackCalls, 1);
});

test('Gemini 视频分析默认等待 300 秒并保留 AbortController', async () => {
  assert.equal(VIDEO_ANALYSIS_TIMEOUT_MS, 300000);
  const fetchImpl = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    }, { once: true });
  });
  await assert.rejects(
    () => callRunningHubGeminiVideoUnderstanding({
      apiKey: 'test-key', videoUrl: 'https://example.com/video.mp4', fetchImpl, timeoutMs: 5,
    }),
    (error) => error.code === 'VIDEO_ANALYSIS_TIMEOUT'
      && error.message === '视频分析超时，请重新尝试'
      && error.elapsedMs >= 5,
  );
});
