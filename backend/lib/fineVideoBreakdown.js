const BREAKDOWN_VERSION = 3;

const emptyText = (value) => typeof value === 'string' ? value.trim() : '';
const numberOrNull = (value) => value === null || value === undefined || value === ''
  ? null
  : (Number.isFinite(Number(value)) ? Number(value) : null);
const stringList = (value) => Array.isArray(value) ? [...new Set(value.map(String).map((item) => item.trim()).filter(Boolean))] : [];
const CLOTHING_PATTERN = /T\s*恤|背带裤|鞋子|小鞋|发绳|发夹|服装|衣服/;

function aggregateElements(values) {
  const elements = stringList(values);
  const hasClothing = elements.some((item) => CLOTHING_PATTERN.test(item));
  return [...(hasClothing ? ['小狗服装造型'] : []), ...elements.filter((item) => !CLOTHING_PATTERN.test(item))];
}

function normalizeDialogue(item = {}) {
  return {
    speaker: emptyText(item.speaker),
    text: emptyText(item.text),
    startTime: numberOrNull(item.startTime),
    endTime: numberOrNull(item.endTime),
    timeConfirmed: item.timeConfirmed !== false && numberOrNull(item.startTime) !== null && numberOrNull(item.endTime) !== null,
  };
}

function normalizeBeat(beat = {}, index = 0) {
  const startTime = numberOrNull(beat.startTime);
  const endTime = numberOrNull(beat.endTime);
  return {
    id: emptyText(beat.id) || `beat_${index + 1}`,
    startTime,
    endTime,
    duration: startTime !== null && endTime !== null ? Math.max(0, endTime - startTime) : null,
    timeConfirmed: beat.timeConfirmed !== false && startTime !== null && endTime !== null,
    title: emptyText(beat.title), trigger: emptyText(beat.trigger), action: emptyText(beat.action),
    expression: emptyText(beat.expression), emotionBefore: emptyText(beat.emotionBefore),
    emotionAfter: emptyText(beat.emotionAfter),
    dialogue: (Array.isArray(beat.dialogue) ? beat.dialogue : []).map(normalizeDialogue),
    continuity: emptyText(beat.continuity),
  };
}

function normalizeShot(shot = {}, index = 0) {
  const startTime = numberOrNull(shot.startTime);
  const endTime = numberOrNull(shot.endTime);
  const duration = numberOrNull(shot.duration) ?? (startTime !== null && endTime !== null ? Math.max(0, endTime - startTime) : null);
  const narrative = shot.narrative || {};
  const cinematography = shot.cinematography || {};
  const visualTreatment = shot.visualTreatment || {};
  const sound = shot.sound || {};
  const narrativeFunction = shot.narrativeFunction || {};
  const replaceable = shot.replaceable || {};
  return {
    id: emptyText(shot.id) || `shot_${index + 1}`,
    startTime, endTime, duration,
    thumbnailTime: numberOrNull(shot.thumbnailTime) ?? startTime,
    timeConfirmed: shot.timeConfirmed !== false && startTime !== null && endTime !== null,
    narrative: {
      scene: emptyText(narrative.scene), characters: stringList(narrative.characters),
      dialogue: (Array.isArray(narrative.dialogue) ? narrative.dialogue : []).map(normalizeDialogue),
      subtitles: (Array.isArray(narrative.subtitles) ? narrative.subtitles : []).map(normalizeDialogue),
      summary: emptyText(narrative.summary),
    },
    cinematography: {
      shotSize: emptyText(cinematography.shotSize), viewAngle: emptyText(cinematography.viewAngle),
      cameraPosition: emptyText(cinematography.cameraPosition), cameraMovement: emptyText(cinematography.cameraMovement),
      composition: emptyText(cinematography.composition), lensAndDepth: emptyText(cinematography.lensAndDepth),
    },
    visualTreatment: {
      lighting: emptyText(visualTreatment.lighting), colorTone: emptyText(visualTreatment.colorTone),
      contrast: emptyText(visualTreatment.contrast), imageTexture: emptyText(visualTreatment.imageTexture),
      editing: emptyText(visualTreatment.editing),
    },
    sound: {
      backgroundMusic: emptyText(sound.backgroundMusic), environmentSound: emptyText(sound.environmentSound),
      soundEffects: stringList(sound.soundEffects), laughter: emptyText(sound.laughter), audioSummary: emptyText(sound.audioSummary),
    },
    narrativeFunction: {
      shotPurpose: emptyText(narrativeFunction.shotPurpose), storyFunction: emptyText(narrativeFunction.storyFunction),
      emotionChange: emptyText(narrativeFunction.emotionChange),
    },
    beats: (Array.isArray(shot.beats) ? shot.beats : []).map(normalizeBeat),
    replaceable: {
      subjects: stringList(replaceable.subjects), scenes: stringList(replaceable.scenes), elements: aggregateElements(replaceable.elements),
      elementGroups: Array.isArray(replaceable.elementGroups) ? replaceable.elementGroups.map((group) => ({
        name: emptyText(group?.name), items: stringList(group?.items),
      })).filter((group) => group.name) : [],
    },
  };
}

function assertFineBreakdown(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('视频理解结果不是 JSON 对象');
  for (const key of ['summary', 'duration', 'shotCount', 'subjects', 'scenes', 'elements', 'shots']) {
    if (!(key in value)) throw new Error(`视频理解结果缺少 ${key}`);
  }
  if (!Array.isArray(value.shots)) throw new Error('视频理解结果缺少 shots 数组');
  for (const [index, shot] of value.shots.entries()) {
    if (!shot || typeof shot !== 'object') throw new Error(`shot_${index + 1} 结构无效`);
    for (const key of ['narrative', 'cinematography', 'visualTreatment', 'sound', 'narrativeFunction', 'beats', 'replaceable']) {
      if (!shot[key] || (key !== 'beats' && typeof shot[key] !== 'object')) throw new Error(`shot_${index + 1} 缺少 ${key}`);
    }
    if (!Array.isArray(shot.beats)) throw new Error(`shot_${index + 1} 缺少 beats 数组`);
  }
  return value;
}

function normalizeFineBreakdown(value, metadata = {}) {
  assertFineBreakdown(value);
  const shots = value.shots.map(normalizeShot);
  const duration = numberOrNull(value.duration) ?? shots.reduce((max, shot) => Math.max(max, shot.endTime || 0), 0);
  const evidenceText = [value.summary, ...shots.flatMap((shot) => [shot.narrative.summary, ...shot.beats.flatMap((beat) => [beat.title, beat.action])])].join(' ');
  const unsupportedHallucination = (item) => ['厨房', '蛋糕', '桌子'].includes(item) && !evidenceText.includes(item);
  const scenes = stringList(value.scenes).filter((item) => !unsupportedHallucination(item));
  const elements = aggregateElements(value.elements).filter((item) => !unsupportedHallucination(item));
  const cleanedShots = shots.map((shot) => ({
    ...shot,
    narrative: { ...shot.narrative, scene: unsupportedHallucination(shot.narrative.scene) ? '' : shot.narrative.scene },
    replaceable: {
      ...shot.replaceable,
      scenes: shot.replaceable.scenes.filter((item) => !unsupportedHallucination(item)),
      elements: shot.replaceable.elements.filter((item) => !unsupportedHallucination(item)),
    },
  }));
  return {
    summary: emptyText(value.summary), duration, shotCount: shots.length,
    subjects: stringList(value.subjects), scenes, elements,
    shots: cleanedShots,
    previews: value.previews || { subjects: [], scenes: [], elements: [] },
    modelName: metadata.modelName || emptyText(value.modelName), modelVersion: metadata.modelVersion || emptyText(value.modelVersion),
    breakdownVersion: BREAKDOWN_VERSION,
  };
}

function legacyToFineBreakdown(value = {}, metadata = {}) {
  const overview = value.overview || {};
  const legacyShots = Array.isArray(value.shots) ? value.shots : [];
  return normalizeFineBreakdown({
    summary: overview.referenceVideo || overview.summary || '', duration: value.duration || 0,
    shotCount: legacyShots.length,
    subjects: overview.replaceableSubjects || [], scenes: overview.replaceableScenes || [], elements: overview.replaceableElements || [],
    shots: legacyShots.map((shot, index) => ({
      id: `shot_${index + 1}`, startTime: shot.startTime, endTime: shot.endTime,
      timeConfirmed: shot.timeConfirmed, thumbnailTime: shot.startTime,
      narrative: { scene: shot.scene || '', characters: shot.subjects || [], dialogue: [], subtitles: [], summary: shot.description || shot.actions || '' },
      cinematography: { shotSize: shot.shotSize || '', viewAngle: '', cameraPosition: '', cameraMovement: shot.camera || '', composition: '', lensAndDepth: '' },
      visualTreatment: { lighting: '', colorTone: '', contrast: '', imageTexture: '', editing: '' },
      sound: { backgroundMusic: '', environmentSound: '', soundEffects: [], laughter: '', audioSummary: shot.sound || '' },
      narrativeFunction: { shotPurpose: '', storyFunction: '', emotionChange: shot.emotion || '' },
      beats: [{ id: `beat_${index + 1}`, startTime: shot.startTime, endTime: shot.endTime, timeConfirmed: shot.timeConfirmed, title: shot.title || '', trigger: '', action: shot.actions || shot.action || '', expression: shot.expressions || '', emotionBefore: '', emotionAfter: shot.emotion || '', dialogue: [], continuity: '' }],
      replaceable: { subjects: shot.replaceableSubjects || [], scenes: shot.replaceableScenes || [], elements: shot.replaceableElements || [], elementGroups: [] },
    })),
  }, metadata);
}

module.exports = { BREAKDOWN_VERSION, assertFineBreakdown, normalizeFineBreakdown, legacyToFineBreakdown };
