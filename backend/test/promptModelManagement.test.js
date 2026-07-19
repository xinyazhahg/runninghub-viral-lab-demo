const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  selectTemplateType, buildPromptSnapshot, buildConfirmedPromptSnapshot, buildTimelinePrompt, buildSeedancePrompt,
  promptGenerationDuration, stripPromptGenerationConfig, validatePromptImageMappings,
} = require('../lib/promptBuilder');
const { validateModelSelection } = require('../lib/modelConfig');
const { DEFAULT_MODEL_CONFIG, isMissingModelConfigTable } = require('../config/defaultModelConfig');

const template = {
  template_id: 'subject-replacement', type: 'subject_replacement', version: 1,
  template_content: '{{system_prompt}}\n{{replacement_text}}\n{{user_requirement}}\n{{negative_prompt}}',
};

test('V1 and V2 keep independent Prompt snapshots and record differences', () => {
  const v1 = buildPromptSnapshot({
    template, replacements: [{ group: '主体', original: '人物', replacement: '模特A' }],
    breakdown: { shots: [{ time: '0-4', people: '人物', description: '人物站立' }] },
    userRequirement: '暖色', modelId: 'kling-v3-pro', modelParams: { duration: 4 },
  });
  const previous = { ...v1, version: 1 };
  const v2 = buildPromptSnapshot({
    template, replacements: [{ group: '主体', original: '人物', replacement: '模特B' }],
    breakdown: { shots: [{ time: '0-4', people: '人物', description: '人物站立' }] },
    userRequirement: '冷色', modelId: 'kling-v3-pro', modelParams: { duration: 10 }, previous,
  });
  assert.notEqual(v1.generated_prompt, v2.generated_prompt);
  assert.equal(v1.user_requirement, '暖色');
  assert.equal(v2.user_requirement, '冷色');
  assert.equal(v2.diff_from_previous.base_version, 1);
  assert.ok(v2.diff_from_previous.changed_fields.includes('generated_prompt'));
  assert.ok(v2.diff_from_previous.changed_fields.includes('model_params'));
});

test('automatic Prompt construction refuses missing shots or real shot times', () => {
  assert.throws(() => buildTimelinePrompt({ breakdown: { shots: [] } }), /缺少可靠时间轴/);
  assert.throws(() => buildTimelinePrompt({ breakdown: { shots: [{ description: '无时间镜头' }] } }), /缺少可靠时间轴/);
});

test('Seedance 2.0 Prompt uses Chinese asset references and target-duration segments', () => {
  const output = buildSeedancePrompt({
    duration: 10, ratio: '9:16',
    replacements: [{ group: '主体', original: '小狗', asset_id: 'image-1' }],
    referenceAssets: [{ type: 'video', assetId: 'video-1' }, { type: 'audio', assetId: 'audio-1' }],
    breakdown: { shots: [{ startTime: 0, endTime: 10, title: '回应提问', action: '小狗抬头回答', narrative: { dialogue: [{ speaker: '小狗', text: '妈妈好看。' }] }, cinematography: { cameraMovement: '固定镜头', shotSize: '中近景' } }] },
  });
  assert.deepEqual(output.assetBindings.map((item) => item.reference), ['@图片1', '@视频1', '@音频1']);
  assert.equal(output.duration, 10);
  assert.equal(output.segments[0].start, 0);
  assert.equal(output.segments.at(-1).end, 10);
  assert.match(output.prompt, /小狗.*\{妈妈好看。\}/);
  assert.doesNotMatch(output.prompt, /image-1|video-1|audio-1|\.jpg|https?:\/\/|blob:/);
});

test('Prompt template content is mandatory and never silently defaults', () => {
  assert.throws(() => buildPromptSnapshot({ template: null }), /模板不存在|内容为空/);
});

test('timeline Prompt keeps exact breakdown ranges and excludes system and negative language', () => {
  const prompt = buildTimelinePrompt({
    duration: 4, ratio: '9:16',
    replacements: [{ group: '主体', original: '原人物', replacement: '新人物.png', asset_id: 'asset-1' }],
    breakdown: { shots: [
      { time: '0-2', people: '原人物位于画面中央', scene: '室内', action: '抬手', shot_size: '中景', camera_movement: '缓慢推进', sound_effect: '衣物摩擦声' },
      { time: '2-8', people: '原人物位于右侧', scene: '室外', action: '转身', shot_size: '全景', transition: '硬切' },
    ] },
  });
  assert.match(prompt, /@图片1/);
  assert.match(prompt, /0–1秒/);
  assert.match(prompt, /1–4秒/);
  assert.match(prompt, /缓慢推进/);
  assert.match(prompt, /未识别到明确对白，不新增台词/);
  assert.match(prompt, /参考原视频拆解得到的剧情、动作、运镜、对白和节奏/);
  assert.match(prompt, /不生成字幕、水印或Logo/);
});

test('a user-edited full Prompt is persisted as the final Prompt version', () => {
  const snapshot = buildPromptSnapshot({
    template, breakdown: { shots: [] }, modelParams: { duration: 4, ratio: '9:16' },
    generatedPromptOverride: '用户手动修改后的完整时间轴 Prompt',
  });
  assert.equal(snapshot.generated_prompt, '用户手动修改后的完整时间轴 Prompt');
});

test('confirmed Prompt snapshot preserves user text while removing embedded generation config', () => {
  const finalPrompt = '@图片1：用户修改后的素材说明\n【生成配置】\n生成时长：10s\n用户追加内容';
  const snapshot = buildConfirmedPromptSnapshot({
    template, finalPrompt, automaticPrompt: '@图片1：自动版本\n【生成配置】\n生成时长：10s',
    promptSource: 'user_edited', editedAt: '2026-07-16T00:00:00.000Z',
    replacements: [{ group: '主体', replacement: '奥利奥.jpg' }],
    modelParams: { duration: 10 },
  });
  assert.equal(snapshot.generated_prompt, '@图片1：用户修改后的素材说明\n用户追加内容');
  assert.equal(snapshot.prompt_source, 'user_edited');
  assert.equal(snapshot.prompt_status, 'confirmed');
  assert.equal(snapshot.model_params.prompt_workflow.final_prompt, snapshot.generated_prompt);
});

test('Prompt image mapping must match current replacement assets', () => {
  assert.deepEqual(validatePromptImageMappings('@图片1 x @图片2 y @图片1', 2), ['@图片1', '@图片2']);
  assert.throws(() => validatePromptImageMappings('@图片1 only', 2), /素材映射/);
});

test('generate-prompt route has no Task creation, billing freeze, or video provider call', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const start = source.indexOf("app.post('/api/generate-prompt'");
  const end = source.indexOf('app.post("/api/generate-video"', start);
  const route = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(route, /directorAgentService/);
  assert.match(route, /promptGeneratorService/);
  assert.match(route, /buildSeedancePrompt_fallback/);
  assert.match(route, /resolveSourceVideoDuration/);
  assert.doesNotMatch(route, /submittedGenerationConfig\.duration|req\.body\.duration/);
  assert.doesNotMatch(route, /createTask\(|freezeTask\(|runSeedance2Generation|\/api\/generate-video/);
});

test('generated and historical edited Prompts keep source video duration without an embedded generation config section', () => {
  const breakdown = { shots: [{ time: '0-10', description: '单镜头内容' }] };
  const modelParams = {
    duration: 10, aspect_ratio: '16:9', resolution: '720p',
    model_id: 'seedance-2.0', model_name: 'Seedance 2.0',
  };
  const automatic = buildPromptSnapshot({ template, breakdown, modelParams }).generated_prompt;
  const editedOldPrompt = `${automatic}\n【生成配置】\n比例：16:9\n清晰度：720p\n生成模型：Seedance 2.0\n生成时长：4s\n用户编辑内容`;
  const synchronized = buildPromptSnapshot({
    template, breakdown, modelParams, generatedPromptOverride: editedOldPrompt,
  }).generated_prompt;
  assert.equal(promptGenerationDuration(automatic), 10);
  assert.equal(promptGenerationDuration(synchronized), 10);
  assert.match(automatic, /^【视频时长】10秒/);
  assert.doesNotMatch(automatic, /【生成配置】|清晰度：|生成模型：|生成时长：/);
  assert.doesNotMatch(synchronized, /【生成配置】|清晰度：|生成模型：|生成时长：/);
  assert.match(synchronized, /用户编辑内容/);
  assert.equal(stripPromptGenerationConfig(editedOldPrompt), synchronized);
});

test('template selection covers single and combined replacements', () => {
  assert.equal(selectTemplateType([{ group: '主体' }]), 'subject_replacement');
  assert.equal(selectTemplateType([{ group: '场景' }]), 'scene_replacement');
  assert.equal(selectTemplateType([{ group: '元素' }]), 'element_replacement');
  assert.equal(selectTemplateType([{ group: '主体' }, { group: '场景' }]), 'combined_replacement');
});

test('model configuration rejects unsupported duration and accepts supported parameters', () => {
  const model = {
    model_id: 'kling-v3-pro', model_name: '可灵 v3.0 Pro', provider: 'RunningHub', endpoint: 'endpoint', status: 'active',
    supported_durations: ['4', '10'], supported_ratios: ['9:16'], supported_resolutions: ['720p'],
  };
  assert.equal(validateModelSelection(model, { duration: '4', aspectRatio: '9:16', resolution: '720p' }).duration, '4');
  assert.throws(() => validateModelSelection(model, { duration: '8', aspectRatio: '9:16', resolution: '720p' }), /时长不受当前模型支持/);
});

test('Prompt creation model validation ignores target duration while keeping ratio and resolution validation', () => {
  const { validatePromptModelSelection } = require('../lib/modelConfig');
  const model = {
    model_id: 'seedance-2.0', model_name: 'Seedance 2.0', status: 'active', provider: 'runninghub', endpoint: 'seedance',
    supported_durations: ['4'], supported_ratios: ['9:16'], supported_resolutions: ['720p'],
  };
  const config = validatePromptModelSelection(model, { duration: '10', aspectRatio: '9:16', resolution: '720p' });
  assert.equal(config.ratio, '9:16');
  assert.equal('duration' in config, false);
});

test('missing model_configs table exposes Seedance as the only compatibility model without enabling billing', () => {
  assert.equal(isMissingModelConfigTable({ code: 'PGRST205', message: 'schema cache' }), true);
  assert.equal(DEFAULT_MODEL_CONFIG.model_id, 'seedance-2.0');
  assert.ok(DEFAULT_MODEL_CONFIG.supported_durations.includes('4'));
  assert.ok(DEFAULT_MODEL_CONFIG.supported_ratios.includes('9:16'));
  assert.deepEqual(DEFAULT_MODEL_CONFIG.supported_resolutions, ['480p', '720p']);
  assert.notEqual(DEFAULT_MODEL_CONFIG.cost_rule.enabled, true);
});

test('migration creates Prompt and model tables and atomic Result linkage', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/004_prompt_model_management.sql'), 'utf8');
  assert.match(sql, /create table if not exists public\.prompt_versions/i);
  assert.match(sql, /create table if not exists public\.prompt_templates/i);
  assert.match(sql, /create table if not exists public\.model_configs/i);
  assert.match(sql, /update public\.results set prompt_id = created_prompt\.id/i);
  assert.match(sql, /Generated prompt must not be empty/i);
});
