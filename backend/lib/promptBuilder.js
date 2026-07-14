const SYSTEM_PROMPT = '严格依据参考视频和结构化替换数据生成视频，只修改用户明确选择的内容，保持原视频镜头结构、动作方向、运动节奏、构图和空间关系。';
const NEGATIVE_PROMPT = '不要新增无关人物、动物、物体、文字、字幕、水印或标志；不要删除未选择内容；不要改变镜头角度、运镜、景别和主体关系。';

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

function replacementText(replacements = []) {
  const lines = replacements
    .filter((item) => item?.group && item?.original && item?.replacement)
    .map((item) => `${item.group}“${item.original}”替换为“${item.replacement}”`);
  return lines.length ? `仅执行以下替换：${lines.join('；')}。` : '不替换未明确选择的内容。';
}

function preserveText(breakdown = {}) {
  const overview = breakdown?.overview || {};
  const shots = Array.isArray(breakdown?.shots) ? breakdown.shots : [];
  const list = (value) => Array.isArray(value) ? value.filter(Boolean).join('、') : String(value || '').trim();
  const actions = [...new Set(shots.map((shot) => shot?.action).filter(Boolean))].join('、');
  const cameras = [...new Set(shots.map((shot) => shot?.camera).filter(Boolean))].join('、');
  return [
    `主体：${list(overview.replaceableSubjects) || '保持原视频全部主体与主体关系'}`,
    `场景：${list(overview.replaceableScenes) || '保持原视频全部空间与环境'}`,
    `关键元素：${list(overview.replaceableElements) || '保持未选择的原有物体'}`,
    `动作与节奏：${actions || '严格沿用原视频动作方向、速度和节奏'}`,
    `镜头：${cameras || '严格沿用原视频镜头角度、顺序和运镜'}`,
  ].join('\n');
}

function fillTemplate(content, values) {
  return String(content || '').replace(/\{\{([a-z_]+)\}\}/g, (_match, key) => String(values[key] || ''));
}

function promptDiff(previous, current) {
  if (!previous) return { base_version: null, changed_fields: ['initial'] };
  const changed = [];
  for (const key of ['generated_prompt', 'user_requirement', 'replacement_summary', 'template_id', 'template_version', 'model_id', 'model_params']) {
    if (JSON.stringify(previous[key] ?? null) !== JSON.stringify(current[key] ?? null)) changed.push(key);
  }
  return { base_version: previous.version || null, changed_fields: changed };
}

function buildPromptSnapshot({ template, breakdown, replacements = [], userRequirement = '', modelId = '', modelParams = {}, previous = null }) {
  if (!template?.template_content) throw new Error('Prompt模板不存在或内容为空');
  const generatedPrompt = fillTemplate(template.template_content, {
    system_prompt: SYSTEM_PROMPT,
    replacement_text: replacementText(replacements),
    preserve_text: preserveText(breakdown),
    user_requirement: String(userRequirement || '').trim() || '无额外要求',
    negative_prompt: NEGATIVE_PROMPT,
  }).trim();
  if (!generatedPrompt) throw new Error('生成Prompt不能为空');
  const snapshot = {
    template_id: template.template_id,
    template_type: template.type,
    template_version: Number(template.version),
    system_prompt: SYSTEM_PROMPT,
    generated_prompt: generatedPrompt,
    user_requirement: String(userRequirement || '').trim(),
    replacement_summary: replacements,
    negative_prompt: NEGATIVE_PROMPT,
    model_id: modelId,
    model_params: modelParams,
  };
  snapshot.diff_from_previous = promptDiff(previous, snapshot);
  return snapshot;
}

module.exports = { selectTemplateType, buildPromptSnapshot, promptDiff, SYSTEM_PROMPT, NEGATIVE_PROMPT };
