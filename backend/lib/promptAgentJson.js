const { appError } = require('./errorCodes');

function parseAgentJson(value, label = 'Agent') {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  const text = String(value || '').trim();
  const unfenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]?.trim() || text;
  try {
    const parsed = JSON.parse(unfenced);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON 不是对象');
    return parsed;
  } catch (error) {
    throw appError('MODEL_RESULT_INVALID', `${label} 未返回有效 JSON：${error.message}`);
  }
}

function stringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];
}

function resolveSourceVideoDuration({ source = {}, videoAnalysis = {} } = {}) {
  const sourceDuration = Number(source?.videoDuration);
  const analysisDuration = Number(videoAnalysis?.duration);
  const duration = Number.isFinite(sourceDuration) && sourceDuration > 0 ? sourceDuration : analysisDuration;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw appError('TASK_STATE_INVALID', '视频拆解结果缺少有效的原视频时长');
  }
  return duration;
}

function validateTimeline(timeline, sourceDuration) {
  if (!Array.isArray(timeline) || !timeline.length) throw appError('MODEL_RESULT_INVALID', 'Creative Plan 缺少 timeline');
  let cursor = 0;
  const normalized = timeline.map((item, index) => {
    const start = Number(item?.start);
    const end = Number(item?.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
      throw appError('MODEL_RESULT_INVALID', `Creative Plan timeline[${index}] 时间无效`);
    }
    if (Math.abs(start - cursor) > 0.11) {
      throw appError('MODEL_RESULT_INVALID', `Creative Plan timeline[${index}] 不连续`);
    }
    cursor = end;
    return {
      start, end, content: String(item.content || '').trim(),
      shotIds: stringArray(item.shotIds), beatIds: stringArray(item.beatIds),
    };
  });
  if (Math.abs(cursor - sourceDuration) > 0.11) {
    throw appError('MODEL_RESULT_INVALID', 'Creative Plan timeline 未覆盖完整原视频时长');
  }
  return normalized;
}

function validateCreativePlanResult(value, { sourceDuration, expectedBindings }) {
  const parsed = parseAgentJson(value, 'Director Agent');
  const plan = parsed.creativePlan;
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw appError('MODEL_RESULT_INVALID', 'Director Agent 缺少 creativePlan');
  for (const key of ['storyLogic', 'directorLogic', 'style']) {
    if (typeof plan[key] !== 'string') throw appError('MODEL_RESULT_INVALID', `Creative Plan 缺少 ${key}`);
  }
  const bindings = Array.isArray(parsed.assetBindings) ? parsed.assetBindings : [];
  const bindingKey = (item) => [
    item.reference, item.assetId, item.type, item.purpose,
    item.targetPlaceholderId || '', Number(item.confidence),
  ].join(':');
  const actualBindingKeys = bindings.map(bindingKey);
  const expectedBindingKeys = expectedBindings.map(bindingKey);
  if (JSON.stringify(actualBindingKeys) !== JSON.stringify(expectedBindingKeys)) {
    throw appError('MODEL_RESULT_INVALID', 'Director Agent 修改了权威素材绑定');
  }
  return {
    creativePlan: {
      storyLogic: plan.storyLogic.trim(), directorLogic: plan.directorLogic.trim(),
      changes: stringArray(plan.changes), unchanged: stringArray(plan.unchanged),
      timeline: validateTimeline(plan.timeline, sourceDuration), style: plan.style.trim(),
      globalConstraints: stringArray(plan.globalConstraints),
    },
    assetBindings: expectedBindings,
    warnings: stringArray(parsed.warnings),
  };
}

function extractReferences(text) {
  return [...new Set(String(text || '').match(/@(图片|视频|音频)\d+/g) || [])];
}

function promptHeaderDuration(text) {
  const match = String(text || '').match(/^【视频时长】\s*(\d+(?:\.\d+)?)\s*秒/);
  return match ? Number(match[1]) : null;
}

function promptTimelineRanges(text) {
  return [...String(text || '').matchAll(/(?:^|\n)\s*(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)\s*秒\s*[：:]/g)]
    .map((match) => ({ start: Number(match[1]), end: Number(match[2]) }));
}

function validatePromptDuration(text, sourceDuration) {
  if (Math.abs(Number(promptHeaderDuration(text)) - sourceDuration) > 0.11) {
    throw appError('MODEL_RESULT_INVALID', 'Prompt 顶部视频时长与原视频时长不一致');
  }
  const ranges = promptTimelineRanges(text);
  if (!ranges.length) throw appError('MODEL_RESULT_INVALID', 'Prompt 缺少时间轴');
  let cursor = 0;
  ranges.forEach((range, index) => {
    if (!Number.isFinite(range.start) || !Number.isFinite(range.end) || range.end <= range.start || Math.abs(range.start - cursor) > 0.11) {
      throw appError('MODEL_RESULT_INVALID', `Prompt 时间轴第 ${index + 1} 段无效或不连续`);
    }
    cursor = range.end;
  });
  if (Math.abs(cursor - sourceDuration) > 0.11) {
    throw appError('MODEL_RESULT_INVALID', 'Prompt 时间轴总长度与原视频时长不一致');
  }
}

function promptSection(text, heading, nextHeading = '') {
  const start = String(text || '').indexOf(heading);
  if (start < 0) return '';
  const contentStart = start + heading.length;
  const end = nextHeading ? String(text).indexOf(nextHeading, contentStart) : String(text).length;
  return String(text).slice(contentStart, end < 0 ? undefined : end).trim();
}

function validatePromptStructure(text, expectedBindings, creativePlan = {}) {
  const headings = ['【视频时长】', '【镜头与场景】', '【主体形象】', '【时间轴】'];
  let cursor = -1;
  for (const heading of headings) {
    const matches = String(text).match(new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || [];
    const position = String(text).indexOf(heading);
    if (matches.length !== 1 || position <= cursor) {
      throw appError('MODEL_RESULT_INVALID', `Prompt 缺少、重复或错排固定结构 ${heading}`);
    }
    cursor = position;
  }

  const scene = promptSection(text, '【镜头与场景】', '【主体形象】');
  const subject = promptSection(text, '【主体形象】', '【时间轴】');
  const timeline = promptSection(text, '【时间轴】');
  if (!/单镜头连续拍摄/.test(scene) || !/无剪辑/.test(scene)) {
    throw appError('MODEL_RESULT_INVALID', 'Prompt 镜头与场景缺少单镜头连续拍摄约束');
  }
  if (!/(位于|坐在|站在|躺在|趴在|承载物|空间关系|空间位置)/.test(scene)) {
    throw appError('MODEL_RESULT_INVALID', 'Prompt 镜头与场景缺少主体与承载物的空间关系');
  }

  const characterBindings = expectedBindings.filter((item) => item.purpose === 'character_reference');
  for (const binding of characterBindings) {
    const consistencyRule = `主体形象严格参考${binding.reference}，全程保持毛色、脸型、服装、体型一致，不发生外观漂移。`;
    if (!subject.includes(consistencyRule)) {
      throw appError('MODEL_RESULT_INVALID', `Prompt 缺少${binding.reference}的主体一致性约束`);
    }
  }
  if (characterBindings.length === 1 && timeline.includes(characterBindings[0].reference)) {
    throw appError('MODEL_RESULT_INVALID', '单主体 Prompt 在时间轴重复绑定主体素材');
  }
  if (/(求生欲爆发|谄媚|狂喜)/.test(timeline)) {
    throw appError('MODEL_RESULT_INVALID', 'Prompt 时间轴使用了不可执行的抽象动作词');
  }
  if (/(光线|景深|整体氛围)/.test(timeline)) {
    throw appError('MODEL_RESULT_INVALID', 'Prompt 时间轴重复了全局镜头与氛围描述');
  }

  const expectedTimeline = Array.isArray(creativePlan.timeline) ? creativePlan.timeline : [];
  const actualRanges = promptTimelineRanges(text);
  if (expectedTimeline.length && (actualRanges.length !== expectedTimeline.length || actualRanges.some((range, index) => (
    Math.abs(range.start - Number(expectedTimeline[index]?.start)) > 0.11
    || Math.abs(range.end - Number(expectedTimeline[index]?.end)) > 0.11
  )))) {
    throw appError('MODEL_RESULT_INVALID', 'Prompt 时间轴未保留 Creative Plan 的真实时间段');
  }

  const planHasTrigger = expectedTimeline.some((item) => /(听到|画外音|旁白|对白|声音|音效|说道|提醒|触发)/.test(String(item?.content || '')));
  if (planHasTrigger && !/(听到|画外音|旁白|对白|声音|音效|说道|提醒|触发)/.test(timeline)) {
    throw appError('MODEL_RESULT_INVALID', 'Prompt 时间轴遗漏了 Creative Plan 中的对白或触发关系');
  }

  const timelineLines = [...timeline.matchAll(/(?:^|\n)\s*(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)\s*秒\s*[：:]([^\n]*)/g)];
  for (const match of timelineLines) {
    if (Number(match[2]) - Number(match[1]) > 1.05) continue;
    const actions = ['倒下', '仰倒', '四脚朝天', '打滚', '翻滚'].filter((term) => match[3].includes(term));
    if (actions.length > 1) throw appError('MODEL_RESULT_INVALID', 'Prompt 在 1 秒内安排了过多复杂动作');
  }
  if (/(倒下|仰倒|打滚|翻滚|四脚朝天)/.test(timeline) && /全程特写/.test(scene)) {
    throw appError('MODEL_RESULT_INVALID', 'Prompt 存在全程特写与结尾完整肢体动作冲突');
  }
}

function validatePromptGeneratorResult(value, { sourceDuration, expectedBindings, creativePlan = {} }) {
  const parsed = parseAgentJson(value, 'Prompt Generator');
  const finalPrompt = String(parsed.finalPrompt || '').trim();
  if (!finalPrompt) throw appError('MODEL_RESULT_INVALID', 'Prompt Generator 返回空 finalPrompt');
  validatePromptDuration(finalPrompt, sourceDuration);
  validatePromptStructure(finalPrompt, expectedBindings, creativePlan);
  const expected = expectedBindings.map((item) => item.reference);
  const required = expectedBindings.filter((item) => item.required !== false).map((item) => item.reference);
  const inPrompt = extractReferences(finalPrompt);
  const references = stringArray(parsed.references);
  if (inPrompt.some((item) => !expected.includes(item)) || references.some((item) => !expected.includes(item))) {
    throw appError('MODEL_RESULT_INVALID', 'Prompt Generator 引用了不存在的素材编号');
  }
  if (required.some((item) => !inPrompt.includes(item))) {
    throw appError('MODEL_RESULT_INVALID', 'Prompt Generator 缺少必须使用的替换素材');
  }
  return {
    finalPrompt,
    references: expected.filter((item) => inPrompt.includes(item)),
    negativeConstraints: stringArray(parsed.negativeConstraints),
    warnings: stringArray(parsed.warnings),
  };
}

module.exports = {
  parseAgentJson, resolveSourceVideoDuration, validateCreativePlanResult, validatePromptGeneratorResult,
  extractReferences, promptHeaderDuration, promptTimelineRanges, validatePromptStructure,
};
