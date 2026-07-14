const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createCoreSkillService, loadContracts } = require('../services/coreSkillService');

const logger = { info() {}, warn() {}, error() {}, debug() {} };
const service = createCoreSkillService({ logger });

test('three core Skill contracts expose the complete lightweight standard', () => {
  const contracts = loadContracts();
  assert.deepEqual(Object.keys(contracts).sort(), ['prompt_generation', 'video_generation', 'video_understanding']);
  for (const contract of Object.values(contracts)) {
    for (const field of ['name','description','input_schema','output_schema','provider','model','timeout','retry_policy','error_codes','cost_rule','implementation_files','standalone_test']) {
      assert.notEqual(contract[field], undefined, `${contract.name} missing ${field}`);
    }
  }
});

test('video understanding skill can be tested with a Mock without calling a provider', async () => {
  let called = 0;
  const output = await service.execute('video_understanding', {
    project_id: 'project-1', task_id: 'task-1', video_path: '/tmp/mock.mp4', prompt: 'mock prompt', original_asset_id: null,
  }, {}, async () => { called += 1; return '{"overview":{},"shots":[]}'; });
  assert.equal(called, 1);
  assert.match(output, /overview/);
});

test('prompt generation skill validates and returns the existing Prompt snapshot shape', async () => {
  const snapshot = {
    template_id: 'combined-v1', template_type: 'combined_replacement', template_version: 1,
    generated_prompt: 'mock prompt', model_id: 'kling-v3', model_params: {},
  };
  const output = await service.execute('prompt_generation', {
    project_id: 'project-1', task_id: null, template: {}, breakdown: {}, replacements: [],
    user_requirement: '', model_id: 'kling-v3', model_params: {}, previous: null,
  }, {}, async () => snapshot);
  assert.equal(output, snapshot);
});

test('video generation skill rejects an invalid Mock output with MODEL_RESULT_INVALID', async () => {
  await assert.rejects(() => service.execute('video_generation', {
    project_id: 'project-1', task_id: 'task-1', image_path: '/tmp/mock.jpg', prompt: 'mock prompt',
    model_id: 'kling-v3', model_endpoint: 'mock/endpoint', duration: 4, aspect_ratio: '9:16', resolution: '720p',
  }, {}, async () => ({ unexpected: true })), (error) => error.code === 'MODEL_RESULT_INVALID');
});

test('App.vue does not call concrete model providers directly', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '../../vue3-new/frontend-vue/src/App.vue'), 'utf8');
  assert.doesNotMatch(appSource, /runninghub\.cn|rhart-text-g-|multimodal-video/);
});
