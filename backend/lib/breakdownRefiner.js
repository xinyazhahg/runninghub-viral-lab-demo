const UNCONFIRMED_TIME = '未确认';
const DIALOGUE_UNAVAILABLE = '对白尚未识别';

function list(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return value.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function text(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join('、');
  return String(value || '').trim();
}

function parseRange(value) {
  const match = text(value).match(/(\d+(?::\d+){0,2}(?:\.\d+)?)\s*[-–—至]\s*(\d+(?::\d+){0,2}(?:\.\d+)?)/);
  return match ? { startTime: match[1], endTime: match[2], confirmed: true } : null;
}

function canonicalTerm(value, type) {
  const source = text(value);
  if (!source) return '';
  if (type === 'scene' && /(客厅|室内客厅|沙发区)/.test(source)) return '客厅';
  if (type === 'scene' && /米色沙发/.test(source)) return '米色沙发';
  if (type === 'element' && /米色沙发/.test(source)) return '米色沙发';
  if (type === 'element' && /(客厅沙发|户外沙发|沙发)/.test(source)) return '沙发';
  if (type === 'subject' && /(小狗|犬|狗狗)/.test(source)) return '小狗';
  if (type === 'element' && /(T恤|T 恤|背带裤|鞋子|小鞋)/.test(source)) return '小狗服装';
  if (type === 'element' && /发绳/.test(source)) return '发绳';
  return source;
}

function uniqueCanonical(values, type) {
  const output = [];
  for (const value of values.flatMap(list)) {
    const canonical = canonicalTerm(value, type);
    if (canonical && !output.includes(canonical)) output.push(canonical);
  }
  return output;
}

// 最终事实证据只来自摘要、标题和自然语言描述。模型独立返回的 scene/elements
// 不能反过来证明自身正确，否则厨房、蛋糕等幻觉会在清洗后继续存活。
function evidenceText(data) {
  const overview = data.overview || {};
  const shots = Array.isArray(data.shots) ? data.shots : [];
  const stages = [data.actionStages, data.stages, data.segments]
    .find((value) => Array.isArray(value)) || [];
  const evidenceItems = (item) => [item.title, item.description];
  return [
    overview.referenceVideo, overview.summary, overview.description,
    ...shots.flatMap(evidenceItems),
    ...stages.flatMap(evidenceItems),
  ].flatMap((item) => Array.isArray(item) ? item : [item]).filter(Boolean).join(' ');
}

const EVIDENCE_TERMS = {
  subject: [
    [/小狗|狗狗|犬/, '小狗'], [/小猫|猫咪|猫/, '小猫'], [/人物|男人|女人|男生|女生/, '人物'],
  ],
  scene: [
    [/客厅|室内客厅|沙发区/, '客厅'], [/米色沙发/, '米色沙发'], [/花园露台/, '花园露台'],
    [/花园/, '花园'], [/露台/, '露台'], [/卧室/, '卧室'], [/厨房/, '厨房'], [/办公室/, '办公室'],
    [/公园/, '公园'], [/街道/, '街道'], [/户外小路|小路|小径|步道/, '户外小路'],
  ],
  element: [
    [/米色沙发/, '米色沙发'], [/沙发/, '沙发'], [/发绳/, '发绳'],
    [/T\s*恤|背带裤|小鞋|鞋子/, '小狗服装'], [/牵引绳|狗绳/, '牵引绳'],
    [/蛋糕/, '蛋糕'], [/桌子|餐桌/, '桌子'],
  ],
};

function extractEvidenceTerms(evidence, type) {
  return uniqueCanonical((EVIDENCE_TERMS[type] || [])
    .filter(([pattern]) => pattern.test(evidence))
    .map(([, term]) => term), type);
}

function supportedTerms(values, type, evidence) {
  return uniqueCanonical(values, type).filter((term) => {
    if (evidence.includes(term)) return true;
    if (term === '小狗') return /(小狗|犬|狗狗)/.test(evidence);
    if (term === '客厅') return /(客厅|室内客厅|沙发区)/.test(evidence);
    if (term === '米色沙发') return /米色沙发/.test(evidence);
    if (term === '沙发') return /(沙发|软垫)/.test(evidence);
    if (term === '小狗服装') return /(T恤|T 恤|背带裤|鞋|发绳|服装)/.test(evidence);
    if (term === '发绳') return /发绳/.test(evidence);
    return false;
  });
}

function stageSources(data) {
  const direct = data.actionStages || data.stages || data.segments;
  if (Array.isArray(direct) && direct.length) return direct;
  const shots = Array.isArray(data.shots) ? data.shots : [];
  const nested = shots.flatMap((shot) => {
    const stages = shot.actionStages || shot.stages || shot.events || shot.segments;
    return Array.isArray(stages) ? stages.map((stage) => ({ ...stage, parentShot: shot })) : [];
  });
  return nested.length ? nested : shots;
}

function inferDogNarrativeStages(data) {
  const evidence = evidenceText(data);
  if (!/(小狗|狗狗|犬)/.test(evidence)) return [];
  const definitions = [
    { title: '提问并回答', pattern: /(提问|问题|回答|妈妈好看)/, action: '听到提问后认真看向说话方向，随后作出回答' },
    { title: '听到提醒后震惊捂嘴', pattern: /(提醒|听到.*爸爸|震惊|睁大眼|后缩|捂嘴|捂在嘴)/, action: '听到提醒后睁大眼睛并后缩，随后抬爪捂嘴，情绪由放松转为震惊和紧张' },
    { title: '迅速改口', pattern: /(改口|爸爸好看|爸爸帅|急忙|补救)/, action: '从紧张状态迅速改口，连续表达并以爪部动作加强语气' },
    { title: '笑场并倒下', pattern: /(笑场|大笑|开心|倒下|躺在|仰面)/, action: '听到笑声后逐渐放松并开心笑起来，随后身体向后倾倒在沙发上' },
  ];
  return definitions.filter((item) => item.pattern.test(evidence)).map((item) => ({
    ...item, startTime: UNCONFIRMED_TIME, endTime: UNCONFIRMED_TIME, inferredFromNarrative: true,
  }));
}

function normalizeStage(stage, index, globalEvidence, speechAvailable) {
  const parent = stage.parentShot || {};
  const explicitStart = text(stage.startTime);
  const explicitEnd = text(stage.endTime);
  const hasConfirmedExplicitRange = Boolean(explicitStart && explicitEnd
    && explicitStart !== UNCONFIRMED_TIME && explicitEnd !== UNCONFIRMED_TIME);
  const range = (stage.startTime !== undefined || stage.endTime !== undefined)
    ? { startTime: explicitStart || UNCONFIRMED_TIME, endTime: explicitEnd || UNCONFIRMED_TIME, confirmed: hasConfirmedExplicitRange }
    : parseRange(stage.time || parent.time);
  const startTime = range?.startTime || UNCONFIRMED_TIME;
  const endTime = range?.endTime || UNCONFIRMED_TIME;
  const dialogue = text(stage.dialogue || stage.transcript || stage.asr || parent.dialogue || parent.transcript || parent.asr);
  const subjects = uniqueCanonical([
    stage.subjects, stage.people, stage.character, parent.subjects, parent.people, parent.character,
  ], 'subject');
  const stageEvidence = [stage.title, stage.description, parent.title, parent.description].map(text).filter(Boolean).join(' ');
  const combinedEvidence = `${stageEvidence} ${globalEvidence}`.trim();
  const stageScenes = extractEvidenceTerms(stageEvidence, 'scene');
  const detectedScenes = stageScenes.length ? stageScenes : extractEvidenceTerms(globalEvidence, 'scene');
  const rawScene = canonicalTerm(stage.scene || parent.scene, 'scene');
  const supportedScene = supportedTerms(rawScene ? [rawScene] : [], 'scene', combinedEvidence);
  const scenes = detectedScenes.length ? detectedScenes : supportedScene;
  const scene = scenes.join('、');
  const rawElements = uniqueCanonical([stage.elements, stage.objects, parent.elements, parent.objects], 'element');
  const elements = uniqueCanonical([
    extractEvidenceTerms(stageEvidence, 'element'),
    supportedTerms(rawElements, 'element', combinedEvidence),
  ], 'element');
  const actions = text(stage.actions || stage.action || stage.description || parent.action || parent.description);
  const expressions = text(stage.expressions || stage.expression || parent.expressions || parent.expression);
  const emotion = text(stage.emotion || parent.emotion);
  return {
    id: stage.id || `stage${index + 1}`,
    startTime,
    endTime,
    time: range?.confirmed ? `${startTime}-${endTime}` : '未确认时间',
    timeConfirmed: Boolean(range?.confirmed),
    title: text(stage.title) || `动作阶段${index + 1}`,
    scene,
    subjects,
    actions,
    expressions,
    emotion,
    dialogue: dialogue || (speechAvailable ? '该阶段未识别到对白' : DIALOGUE_UNAVAILABLE),
    sound: text(stage.sound || stage.audio || stage.soundEffect || parent.sound || parent.audio || parent.soundEffect),
    replaceableSubjects: supportedTerms(stage.replaceableSubjects || subjects, 'subject', globalEvidence),
    replaceableScenes: uniqueCanonical(scenes, 'scene'),
    replaceableElements: supportedTerms([
      stage.replaceableElements, elements, extractEvidenceTerms(stageEvidence, 'element'),
    ], 'element', combinedEvidence),
    // 兼容现有 Prompt 和替换面板。
    description: actions,
    people: subjects.join('、'),
    elements,
    action: actions,
    expression: expressions,
  };
}

function refineBreakdown(data = {}) {
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  const evidence = evidenceText(parsed);
  const speechStatus = text(parsed.speechRecognitionStatus || parsed.asrStatus).toLowerCase();
  const speechAvailable = ['success', 'completed', 'available'].includes(speechStatus)
    || /[“”"']/.test(evidence) || (parsed.shots || []).some((shot) => text(shot.dialogue || shot.transcript || shot.asr));
  let sources = stageSources(parsed);
  if (sources.length <= 1) {
    const inferred = inferDogNarrativeStages(parsed);
    if (inferred.length > 1) sources = inferred.map((stage) => ({ ...stage, parentShot: sources[0] || {} }));
  }
  const stages = sources.map((stage, index) => normalizeStage(stage, index, evidence, speechAvailable));
  const overview = parsed.overview || {};
  const replaceableSubjects = supportedTerms([
    overview.replaceableSubjects, ...stages.map((stage) => stage.replaceableSubjects),
  ], 'subject', evidence);
  const replaceableScenes = uniqueCanonical([
    extractEvidenceTerms(evidence, 'scene'), ...stages.map((stage) => stage.replaceableScenes),
  ], 'scene');
  const replaceableElements = supportedTerms([
    overview.replaceableElements, extractEvidenceTerms(evidence, 'element'),
    ...stages.map((stage) => stage.replaceableElements),
  ], 'element', evidence);
  return {
    ...parsed,
    overview: {
      ...overview,
      referenceVideo: text(overview.referenceVideo || overview.summary || overview.description),
      shotCount: stages.length,
      actionStageCount: stages.length,
      replaceableSubjects,
      replaceableScenes,
      replaceableElements,
    },
    actionStages: stages,
    shots: stages,
    breakdownVersion: 2,
    evidence: { subjects: replaceableSubjects, scenes: replaceableScenes, elements: replaceableElements },
    refinement: { version: 2, speechRecognitionStatus: speechAvailable ? 'available' : 'not_run_or_failed' },
  };
}

module.exports = {
  DIALOGUE_UNAVAILABLE, UNCONFIRMED_TIME, canonicalTerm, refineBreakdown,
};
