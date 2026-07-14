const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { selectTemplateType, buildPromptSnapshot } = require('../lib/promptBuilder');
const { validateModelSelection } = require('../lib/modelConfig');
const { DEFAULT_MODEL_CONFIG, isMissingModelConfigTable } = require('../config/defaultModelConfig');

const template = {
  template_id: 'subject-replacement', type: 'subject_replacement', version: 1,
  template_content: '{{system_prompt}}\n{{replacement_text}}\n{{user_requirement}}\n{{negative_prompt}}',
};

test('V1 and V2 keep independent Prompt snapshots and record differences', () => {
  const v1 = buildPromptSnapshot({
    template, replacements: [{ group: '主体', original: '人物', replacement: '模特A' }],
    userRequirement: '暖色', modelId: 'kling-v3-pro', modelParams: { duration: 4 },
  });
  const previous = { ...v1, version: 1 };
  const v2 = buildPromptSnapshot({
    template, replacements: [{ group: '主体', original: '人物', replacement: '模特B' }],
    userRequirement: '冷色', modelId: 'kling-v3-pro', modelParams: { duration: 10 }, previous,
  });
  assert.notEqual(v1.generated_prompt, v2.generated_prompt);
  assert.equal(v1.user_requirement, '暖色');
  assert.equal(v2.user_requirement, '冷色');
  assert.equal(v2.diff_from_previous.base_version, 1);
  assert.ok(v2.diff_from_previous.changed_fields.includes('generated_prompt'));
  assert.ok(v2.diff_from_previous.changed_fields.includes('model_params'));
});

test('Prompt template content is mandatory and never silently defaults', () => {
  assert.throws(() => buildPromptSnapshot({ template: null }), /模板不存在|内容为空/);
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

test('missing model_configs table exposes a complete compatibility model without enabling billing', () => {
  assert.equal(isMissingModelConfigTable({ code: 'PGRST205', message: 'schema cache' }), true);
  assert.equal(DEFAULT_MODEL_CONFIG.model_id, 'kling-v3-pro');
  assert.ok(DEFAULT_MODEL_CONFIG.supported_durations.includes('4'));
  assert.ok(DEFAULT_MODEL_CONFIG.supported_ratios.includes('9:16'));
  assert.ok(DEFAULT_MODEL_CONFIG.supported_resolutions.includes('720p'));
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
