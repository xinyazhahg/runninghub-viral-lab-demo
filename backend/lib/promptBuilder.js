const { buildPromptAssetBindings } = require('./promptAssetBindings');

const SYSTEM_PROMPT = '严格依据当前视频拆解结果生成正向视频Prompt；一个拆解镜头对应一个时间段，沿用真实起止时间，不新增无关人物、剧情、动作、场景或转场。';
const NEGATIVE_PROMPT = '不出现水印、字幕、Logo；不新增无关人物和物体；保持替换主体身份一致；避免人物变形、肢体异常、闪烁、穿模和主体漂移。';

function selectTemplateType(replacements = []) {
  const groups = new Set(replacements.map((item) => String(item?.group || '').trim()).filter(Boolean));
  if (groups.has('商品')) return 'product_video';
  if (groups.has('风格')) return 'style_transfer';
  if (groups.size !== 1) return 'combined_replacement';
  if (groups.has('主体')) return 'subject_replacement';
  if (groups.has('场景')) return 'scene_replacement';
  if (groups.has('元素')) return 'element_replacement';
  return 'combined_replacement';
}

function value(source, keys, fallback = '') {
  for (const key of keys) {
    const found = source?.[key];
    if (Array.isArray(found) && found.length) return found.join('、');
    if (found !== undefined && found !== null && String(found).trim() && String(found).trim() !== '未识别') return String(found).trim();
  }
  return fallback;
}

function buildReferences(replacements) {
  return replacements
    .filter((item) => item?.group && item?.replacement && item.group !== '字幕/文案')
    .map((item, index) => ({ ...item, reference: `@Image${index + 1}` }));
}

function appliesToShot(item, shot) {
  const original = String(item.original || '').trim();
  if (original && JSON.stringify(shot || {}).includes(original)) return true;
  if (item.group === '主体') return Boolean(value(shot, ['character', 'people', 'person', 'subject']));
  if (item.group === '场景') return Boolean(value(shot, ['scene', 'location', 'environment']));
  if (item.group === '元素') return Boolean(value(shot, ['elements', 'objects', 'props']));
  return false;
}

function finalVisualValue(group, originalValue, shot, refs, fallback) {
  const applied = refs.filter((item) => item.group === group && appliesToShot(item, shot));
  if (applied.length) return applied.map((item) => `${item.reference}（${item.replacement}）`).join('、');
  return originalValue || fallback;
}

function exactTime(shot, index) {
  const time = value(shot, ['time', 'timeRange', 'time_range'], '');
  if (!time) throw new Error(`镜头${index + 1}缺少真实起止时间，无法构建生成Prompt`);
  return time;
}

function lightingSection(shots) {
  const signatures = shots.map((shot) => [
    value(shot, ['scene'], ''), value(shot, ['lighting', 'light'], ''), value(shot, ['color', 'colorTone'], ''),
  ].join('|'));
  const hasChange = new Set(signatures.filter(Boolean)).size > 1;
  if (!hasChange) {
    const shot = shots[0] || {};
    return `全片：${value(shot, ['lighting', 'light'], '自然且符合场景逻辑的光线')}；${value(shot, ['color', 'colorTone'], '统一协调的色调')}；${value(shot, ['description'], '画面质感与视频内容一致')}。`;
  }
  return shots.map((shot, index) => `${exactTime(shot, index)}：${value(shot, ['lighting', 'light'], '依据该镜头场景形成自然明暗关系')}；${value(shot, ['color', 'colorTone'], '色调与场景氛围一致')}；${value(shot, ['scene', 'description'], '画面质感连贯')}。`).join('\n');
}

function numericTime(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseTimeRange(shot = {}) {
  const directStart = numericTime(shot.startTime ?? shot.start_time);
  const directEnd = numericTime(shot.endTime ?? shot.end_time);
  if (directStart !== null && directEnd !== null && directEnd > directStart) return [directStart, directEnd];
  const match = String(shot.time || shot.timeRange || '').match(/(\d+(?:\.\d+)?)\s*[-–—至]\s*(\d+(?:\.\d+)?)/);
  if (!match || Number(match[2]) <= Number(match[1])) return null;
  return [Number(match[1]), Number(match[2])];
}

function normalizedTimelineUnits(breakdown = {}) {
  const shots = Array.isArray(breakdown.shots) ? breakdown.shots : [];
  const units = [];
  for (const [shotIndex, shot] of shots.entries()) {
    const beats = Array.isArray(shot.beats) && shot.beats.length ? shot.beats : [shot];
    for (const [beatIndex, beat] of beats.entries()) {
      const range = parseTimeRange(beat) || parseTimeRange(shot);
      if (!range) continue;
      units.push({
        shot, beat, shotIndex, beatIndex, sourceStart: range[0], sourceEnd: range[1],
        title: beat.title || shot.title || shot.narrative?.summary || `剧情阶段${units.length + 1}`,
        action: beat.action || shot.action || shot.actions || shot.narrative?.summary || shot.description || '',
        expression: beat.expression || shot.expression || '',
        emotion: [beat.emotionBefore, beat.emotionAfter].filter(Boolean).join('到') || shot.narrativeFunction?.emotionChange || shot.emotion || '',
      });
    }
  }
  return units.sort((a, b) => a.sourceStart - b.sourceStart);
}

function targetSegmentLimit(duration) {
  if (duration <= 8) return 2;
  if (duration <= 12) return 3;
  return 4;
}

function selectCoreUnits(units, limit) {
  if (units.length <= limit) return units;
  const selected = [units[0]];
  for (let index = 1; index < limit - 1; index += 1) {
    const sourceIndex = Math.round(index * (units.length - 1) / (limit - 1));
    selected.push(units[sourceIndex]);
  }
  selected.push(units[units.length - 1]);
  return [...new Map(selected.map((item) => [`${item.sourceStart}-${item.sourceEnd}`, item])).values()];
}

function remapTimeline(units, duration) {
  const chosen = selectCoreUnits(units, targetSegmentLimit(duration));
  if (!chosen.length) throw new Error('视频拆解结果缺少可靠时间轴，无法生成 Seedance Prompt');
  const weights = chosen.map((unit) => Math.max(0.25, unit.sourceEnd - unit.sourceStart));
  const totalWeight = weights.reduce((sum, item) => sum + item, 0);
  let cursor = 0;
  return chosen.map((unit, index) => {
    const end = index === chosen.length - 1
      ? duration
      : Number((cursor + duration * weights[index] / totalWeight).toFixed(1));
    const segment = { ...unit, start: cursor, end };
    cursor = end;
    return segment;
  });
}

function collectDialogue(breakdown = {}) {
  const rows = [];
  for (const shot of breakdown.shots || []) {
    const dialogue = shot.narrative?.dialogue || shot.dialogue || [];
    const list = Array.isArray(dialogue) ? dialogue : (String(dialogue || '').trim() ? [{ text: dialogue }] : []);
    for (const line of list) {
      const text = String(line.text || line.dialogue || '').trim();
      if (!text) continue;
      rows.push({ speaker: line.speaker || '说话人未确认', text, action: line.action || line.expression || '' });
    }
  }
  return [...new Map(rows.map((line) => [`${line.speaker}:${line.text}`, line])).values()];
}

function buildSeedanceAssetBindings(replacements = [], referenceAssets = []) {
  return buildPromptAssetBindings(replacements, referenceAssets);
}

function buildSeedancePrompt({ breakdown = {}, replacements = [], referenceAssets = [], duration = 10, ratio = '9:16', audioReferenceSupported = true }) {
  const targetDuration = Number(duration);
  if (!Number.isFinite(targetDuration) || targetDuration < 4 || targetDuration > 15) throw new Error('Seedance 2.0 目标时长必须为4到15秒');
  const units = normalizedTimelineUnits(breakdown);
  const segments = remapTimeline(units, targetDuration);
  const dialogue = collectDialogue(breakdown);
  const estimatedSpeechSeconds = dialogue.reduce((sum, line) => sum + Math.max(0.8, line.text.replace(/\s/g, '').length / 4), 0);
  if (estimatedSpeechSeconds > targetDuration) {
    const error = new Error(`当前${targetDuration}秒时长不足以完整容纳全部对白，请增加生成时长或允许压缩对白。`);
    error.code = 'PROMPT_DURATION_INSUFFICIENT';
    throw error;
  }
  const bindings = buildSeedanceAssetBindings(replacements, referenceAssets)
    .filter((item) => audioReferenceSupported || !item.reference.startsWith('@音频'));
  const bindingText = bindings.map((item) => {
    if (item.purpose === '主体形象') return `参考${item.reference}中的主体形象，仅使用主体身份、外观和服装，不复制图片背景。`;
    if (item.purpose === '场景环境') return `场景参考${item.reference}中的环境，不复制其中无关人物和物体。`;
    if (item.reference.startsWith('@视频')) return `参考${item.reference}中的动作顺序、剧情节奏和运镜。`;
    if (item.reference.startsWith('@音频')) return `参考${item.reference}中的对白节奏和音色。`;
    return `参考${item.reference}中的${item.purpose}。`;
  }).join('\n');
  const replacementRules = replacements.map((item, index) => `仅将原视频中的${item.original || item.group}替换为@图片${index + 1}定义的${item.group}；`).join('');
  const timelineText = segments.map((segment) => {
    const shot = segment.shot || {};
    const camera = shot.cinematography || {};
    const movement = camera.cameraMovement || shot.cameraMovement || shot.camera_movement || '固定镜头';
    const framing = [camera.viewAngle, camera.cameraPosition, camera.shotSize].filter(Boolean).join('') || '正面平视中近景';
    const sound = shot.sound || {};
    const soundText = [sound.backgroundMusic ? `（${sound.backgroundMusic}）` : '', sound.environmentSound ? `<${sound.environmentSound}>` : '', ...(sound.soundEffects || []).map((item) => `<${item}>`)].filter(Boolean).join(' ');
    return `${segment.start}–${segment.end}秒：${movement}，${framing}；${segment.action || '按拆解结果完成该阶段动作'}；${segment.expression ? `表情与情绪由${segment.expression}${segment.emotion ? `，${segment.emotion}` : ''}` : segment.emotion || ''}；${soundText}`.replace(/；\s*$/, '。');
  }).join('\n');
  const dialogueText = dialogue.length
    ? dialogue.map((line) => `${line.speaker}${line.action ? `在${line.action}时` : ''}说道：{${line.text}}`).join('\n')
    : '未识别到明确对白，不新增台词。';
  const firstShot = (breakdown.shots || [])[0] || {};
  const visual = firstShot.visualTreatment || {};
  const prompt = `【视频时长】${targetDuration}秒

${bindingText || '使用当前已绑定参考素材。'}

整体生成任务：参考原视频拆解得到的剧情、动作、运镜、对白和节奏，重新生成一条${targetDuration}秒、${ratio}比例的新视频；这是参考生成任务，不是严格编辑原视频。

按时间划分的剧情和动作：
${timelineText}

镜头语言：严格使用拆解结果中的真实机位、景别和运镜；未识别到运镜时保持固定镜头，不新增无依据的复杂运镜。

对白与声音：
${dialogueText}
${dialogue.length ? '' : '（背景音乐与原视频节奏一致）'}
用户未要求字幕，默认不生成字幕。

光线、风格与画质：${visual.lighting || firstShot.lighting || '保持拆解结果中的自然光线'}；${visual.colorTone || firstShot.colorTone || '保持原有色调和画面质感'}；主体清晰，动作连续。

必须保持内容：${replacementRules || '不改变已识别主体、场景和元素。'}保持原视频的剧情结构、动作顺序、对白顺序、机位和情绪变化；未声明替换的内容保持不变。

质量约束：主体身份、毛色、脸型、服装和身体比例保持一致；五官清晰，不变形；不出现多余肢体、重复主体或错误人脸；画面稳定，无闪烁、无主体漂移；动作连续自然；对白、口型、表情和动作尽量同步；不生成字幕、水印或Logo；不新增拆解中不存在的人物、道具和场景。`;
  return {
    prompt: prompt.trim(), assetBindings: bindings.map(({ reference, assetId, purpose }) => ({ reference, assetId, purpose })),
    duration: targetDuration, segments: segments.map(({ start, end, action, title }) => ({ start, end, content: `${title}：${action}` })), warnings: [],
  };
}

function buildTimelinePrompt({
  breakdown = {}, replacements = [], userRequirement = '', duration = 10, ratio = '9:16',
  resolution = '未指定', modelName = '未指定', referenceAssets = [],
}) {
  return buildSeedancePrompt({ breakdown, replacements, referenceAssets, duration, ratio }).prompt;
  const overview = breakdown?.overview || {};
  const shots = Array.isArray(breakdown?.shots) ? breakdown.shots : [];
  if (!shots.length) throw new Error('视频拆解结果缺少镜头时间轴，无法构建生成Prompt');
  shots.forEach((shot, index) => exactTime(shot, index));
  const refs = buildReferences(replacements);
  const summary = value(overview, ['referenceVideo', 'summary', 'videoSummary'], value(shots[0], ['description'], '当前视频内容'));
  const isAnimation = /动画|插画|卡通|漫画|二维|三维|3D/i.test(`${summary} ${shots.map((shot) => shot.description || '').join(' ')}`);
  const referenceText = refs.length
    ? refs.map((item) => `${item.reference}：${item.group}素材“${item.replacement}”，用于所有包含“${item.original || item.group}”的对应镜头。`).join('\n')
    : '无外部替换图片素材。';
  const rhythm = value(overview, ['rhythm', 'pace'], value(shots[0], ['rhythm'], '节奏由现有镜头时长和动作推进形成'));
  const timelineText = shots.map((shot, index) => {
    const description = value(shot, ['description'], '按该镜头已识别内容呈现画面');
    const subject = finalVisualValue('主体', value(shot, ['character', 'people', 'subject']), shot, refs, '该镜头已识别主体');
    const scene = finalVisualValue('场景', value(shot, ['scene', 'location', 'environment']), shot, refs, description);
    const elements = finalVisualValue('元素', value(shot, ['elements', 'objects', 'props']), shot, refs, '画面中的已识别关键元素');
    const camera = value(shot, ['camera'], '依据镜头自然语言描述做克制的镜头语言补全');
    return `【${exactTime(shot, index)}｜${value(shot, ['title'], `镜头${index + 1}`)}】
画面描述：${description}
景别：${value(shot, ['shot_size', 'shotSize', 'framing'], camera)}
视角和机位：${value(shot, ['camera_position', 'cameraPosition', 'angle'], camera)}
运镜：${value(shot, ['camera_movement', 'cameraMovement'], camera)}
主体位置：${value(shot, ['character_position', 'characterPosition', 'position'], `${subject}处于${value(shot, ['people'], '画面主要位置')}`)}
主体外观和服装：${subject}
动作过程：${value(shot, ['action'], description)}
表情和情绪变化：${value(shot, ['expression', 'emotion'], '与该镜头动作和情境一致')}
场景与关键元素：${scene}；${elements}
连续关系：${index === 0 ? '建立人物、场景和动作起点' : `承接镜头${index}的主体身份、空间方向和动作状态`}`;
  }).join('\n\n');
  const dialogueLines = shots.map((shot, index) => {
    const text = value(shot, ['dialogue', 'voiceOver', 'voice_over', 'narration', 'speech'], '');
    return text ? `${exactTime(shot, index)}：${text}` : '';
  }).filter(Boolean);
  const soundLines = shots.map((shot, index) => {
    const sound = value(shot, ['sound', 'audio', 'soundEffect', 'sound_effect', 'sfx'], '');
    const music = value(shot, ['music', 'backgroundMusic', 'background_music'], '');
    const rhythmText = value(shot, ['rhythm'], '');
    const combined = [sound, music, rhythmText].filter(Boolean).join('；');
    return combined ? `${exactTime(shot, index)}：${combined}` : '';
  }).filter(Boolean);
  const extra = String(userRequirement || '').trim();
  return `${referenceText}

【整体画面风格】
${isAnimation ? '动画或插画风格' : '写实影像风格'}；围绕“${summary}”形成统一氛围；构图依据现有各镜头主体位置和场景关系；视频比例为${ratio}；整体节奏为${rhythm}。

【调色和打光】
${lightingSection(shots)}

【视频提示词】
${timelineText}

【对白/旁白】
${dialogueLines.length ? dialogueLines.join('\n') : '无明确台词或旁白'}

【音效】
${soundLines.length ? soundLines.join('\n') : `环境声、动作声和音乐节奏与“${rhythm}”一致，不指定具体歌曲名称。`}
${extra ? `\n【用户补充生成要求】\n${extra}` : ''}`;
}

function stripPromptGenerationConfig(prompt) {
  const lines = String(prompt || '').split(/\r?\n/);
  const kept = [];
  let insideConfig = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '【生成配置】') {
      insideConfig = true;
      continue;
    }
    if (insideConfig && /^(比例|清晰度|生成模型|生成时长)：/.test(trimmed)) continue;
    if (insideConfig && !trimmed) continue;
    insideConfig = false;
    kept.push(line);
  }
  return kept.join('\n').trim();
}

function synchronizePromptGenerationConfig(prompt, modelParams = {}) {
  return stripPromptGenerationConfig(prompt);
}

function promptGenerationDuration(prompt) {
  const text = String(prompt || '');
  const match = text.match(/^【视频时长】\s*(\d+(?:\.\d+)?)\s*秒/)
    || text.match(/【生成配置】[\s\S]*?生成时长：\s*(\d+(?:\.\d+)?)s/i);
  return match ? Number(match[1]) : null;
}

function promptDiff(previous, current) {
  if (!previous) return { base_version: null, changed_fields: ['initial'] };
  const changed = [];
  for (const key of ['generated_prompt', 'user_requirement', 'replacement_summary', 'template_id', 'template_version', 'model_id', 'model_params']) {
    if (JSON.stringify(previous[key] ?? null) !== JSON.stringify(current[key] ?? null)) changed.push(key);
  }
  return { base_version: previous.version || null, changed_fields: changed };
}

function buildPromptSnapshot({ template, breakdown, replacements = [], userRequirement = '', modelId = '', modelParams = {}, previous = null, generatedPromptOverride = '' }) {
  if (!template?.template_content) throw new Error('Prompt模板不存在或内容为空');
  const generatedPrompt = synchronizePromptGenerationConfig(String(generatedPromptOverride || '').trim() || buildTimelinePrompt({
    breakdown, replacements, userRequirement,
    duration: modelParams.duration || 10,
    ratio: modelParams.aspect_ratio || modelParams.ratio || '9:16',
    resolution: modelParams.resolution,
    modelName: modelParams.model_name || modelParams.modelLabel || modelParams.model_id,
  }), modelParams);
  if (!generatedPrompt) throw new Error('生成Prompt不能为空');
  const snapshot = {
    template_id: template.template_id, template_type: template.type, template_version: Number(template.version),
    system_prompt: SYSTEM_PROMPT, generated_prompt: generatedPrompt,
    user_requirement: String(userRequirement || '').trim(), replacement_summary: replacements,
    negative_prompt: NEGATIVE_PROMPT, model_id: modelId, model_params: modelParams,
  };
  snapshot.diff_from_previous = promptDiff(previous, snapshot);
  return snapshot;
}

function buildConfirmedPromptSnapshot({
  template, finalPrompt, automaticPrompt = '', promptSource = 'system_generated', editedAt = null,
  replacements = [], userRequirement = '', modelId = '', modelParams = {}, previous = null,
}) {
  if (!template?.template_content) throw new Error('Prompt模板不存在或内容为空');
  const confirmedPrompt = stripPromptGenerationConfig(finalPrompt);
  if (!confirmedPrompt) throw new Error('生成Prompt不能为空');
  const source = promptSource === 'user_edited' ? 'user_edited' : 'system_generated';
  const workflow = {
    prompt_status: 'confirmed',
    prompt_source: source,
    edited_at: source === 'user_edited' ? (editedAt || new Date().toISOString()) : null,
    automatic_prompt: stripPromptGenerationConfig(automaticPrompt || confirmedPrompt),
    final_prompt: confirmedPrompt,
  };
  const snapshot = {
    template_id: template.template_id, template_type: template.type, template_version: Number(template.version),
    system_prompt: SYSTEM_PROMPT, generated_prompt: confirmedPrompt,
    user_requirement: String(userRequirement || '').trim(), replacement_summary: replacements,
    negative_prompt: NEGATIVE_PROMPT, model_id: modelId,
    model_params: { ...modelParams, prompt_workflow: workflow },
    ...workflow,
  };
  snapshot.diff_from_previous = promptDiff(previous, snapshot);
  return snapshot;
}

function promptImageReferences(prompt) {
  return [...new Set(String(prompt || '').match(/@图片\d+/g) || [])]
    .sort((left, right) => Number(left.replace(/\D/g, '')) - Number(right.replace(/\D/g, '')));
}

function validatePromptImageMappings(prompt, replacementCount, { requiredCount = replacementCount } = {}) {
  const expected = Array.from({ length: Number(replacementCount) || 0 }, (_, index) => `@图片${index + 1}`);
  const required = expected.slice(0, Number(requiredCount) || 0);
  const actual = promptImageReferences(prompt);
  if (actual.some((reference) => !expected.includes(reference)) || required.some((reference) => !actual.includes(reference))) {
    throw new Error('Prompt 中的 @Image 素材映射与当前替换图片不一致，请重新生成 Prompt。');
  }
  return actual;
}

module.exports = {
  selectTemplateType, buildPromptSnapshot, buildConfirmedPromptSnapshot, buildTimelinePrompt, buildSeedancePrompt,
  stripPromptGenerationConfig,
  synchronizePromptGenerationConfig, promptGenerationDuration, promptImageReferences,
  validatePromptImageMappings, promptDiff, buildSeedanceAssetBindings, SYSTEM_PROMPT, NEGATIVE_PROMPT,
};
