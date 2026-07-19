const test = require('node:test');
const assert = require('node:assert/strict');
const { createDirectorAgentService } = require('../services/directorAgentService');
const { createPromptGeneratorService, buildBasicPromptFromCreativePlan } = require('../services/promptGeneratorService');
const { buildPromptAssetBindings, orderAssetsForSeedance } = require('../lib/promptAssetBindings');
const { DIRECTOR_AGENT_SYSTEM_PROMPT } = require('../prompts/directorAgentSystemPrompt');
const { SEEDANCE_PROMPT_GENERATOR_SYSTEM_PROMPT } = require('../prompts/seedancePromptGeneratorSystemPrompt');

const bindings = [{
  reference: '@图片1', assetRef: '@图片1', assetId: 'asset-1', type: 'image',
  purpose: 'character_reference', purposeLabel: '主体外观参考',
  targetPlaceholderId: 'subject_01', confidence: 0.94, required: true,
}];
const creativePlanPayload = {
  creativePlan: {
    storyLogic: '保持原剧情反转', directorLogic: '压缩为一个连续镜头', changes: ['替换主体'],
    unchanged: ['对白顺序'], timeline: [{ start: 0, end: 10, content: '主体完成原动作', shotIds: ['shot_1'], beatIds: ['beat_1'] }],
    style: '写实', globalConstraints: ['不新增人物'],
  },
  assetBindings: bindings,
  warnings: [],
};

test('Director Agent 一次调用返回 Creative Plan，不生成最终 Prompt', async () => {
  let calls = 0;
  let actualInput;
  const service = createDirectorAgentService({ llmClient: { async complete(request) { calls += 1; actualInput = request.input; return { content: JSON.stringify(creativePlanPayload), model: 'mock-director' }; } } });
  const result = await service.generate({ source: { videoDuration: 10 }, videoAnalysis: { duration: 10 }, generationConfig: { duration: 4 }, assetBindings: bindings });
  assert.equal(calls, 1);
  assert.equal(actualInput.source.videoDuration, 10);
  assert.equal('duration' in actualInput.generationConfig, false);
  assert.equal(result.creativePlan.timeline.at(-1).end, 10);
  assert.equal(result.creativePlan.storyLogic, '保持原剧情反转');
  assert.equal('finalPrompt' in result, false);
});

test('Director Agent 首次失败后自动重试一次', async () => {
  let calls = 0;
  const service = createDirectorAgentService({ llmClient: { async complete() { calls += 1; return { content: calls === 1 ? 'not-json' : JSON.stringify(creativePlanPayload) }; } } });
  const result = await service.generate({ videoAnalysis: { duration: 10 }, generationConfig: { duration: 4 }, assetBindings: bindings });
  assert.equal(calls, 2);
  assert.equal(result.attempts, 2);
});

test('Prompt Generator 输出 Final Prompt 和引用', async () => {
  let actualInput;
  const finalPrompt = `【视频时长】10秒

【镜头与场景】
单镜头连续拍摄，无剪辑；前段平视、正面、固定机位特写。主体位于原场景承载物中央。

【主体形象】
主体形象严格参考@图片1，全程保持毛色、脸型、服装、体型一致，不发生外观漂移。

【时间轴】
0–10秒：主体完成原动作。`;
  const service = createPromptGeneratorService({ llmClient: { async complete(request) { actualInput = request.input; return { content: JSON.stringify({ finalPrompt, references: ['@图片1'], negativeConstraints: ['不新增人物'], warnings: [] }), model: 'mock-generator' }; } } });
  const result = await service.generate({ source: { videoDuration: 10 }, creativePlan: creativePlanPayload.creativePlan, assetBindings: bindings, generationConfig: { duration: 4, aspectRatio: 'adaptive', resolution: '720p' } });
  assert.equal(actualInput.source.videoDuration, 10);
  assert.equal('duration' in actualInput.generationConfig, false);
  assert.equal(result.finalPrompt, finalPrompt);
  assert.deepEqual(result.references, ['@图片1']);
  assert.equal(result.mode, 'seedance_prompt_generator');
});

test('Prompt Generator 连续失败后根据 Creative Plan 使用基础模板', async () => {
  let calls = 0;
  const service = createPromptGeneratorService({ llmClient: { async complete() { calls += 1; return { content: '{}' }; } } });
  const result = await service.generate({ source: { videoDuration: 10 }, creativePlan: creativePlanPayload.creativePlan, assetBindings: bindings, generationConfig: { duration: 4, aspectRatio: 'adaptive', resolution: '720p' } });
  assert.equal(calls, 2);
  assert.equal(result.mode, 'basic_template');
  assert.match(result.finalPrompt, /^【视频时长】10秒/);
  assert.match(result.finalPrompt, /0–10秒/);
  assert.doesNotMatch(result.finalPrompt, /生成4秒/);
  assert.match(result.finalPrompt, /@图片1/);
  assert.match(result.finalPrompt, /【镜头与场景】[\s\S]*【主体形象】[\s\S]*【时间轴】/);
  assert.match(result.finalPrompt, /主体形象严格参考@图片1，全程保持毛色、脸型、服装、体型一致，不发生外观漂移/);
});

test('宠物剧情规则要求保留触发、控制动作密度并执行最终自检', () => {
  assert.match(DIRECTOR_AGENT_SYSTEM_PROMPT, /dialogue、trigger、sound、narrative/);
  assert.match(DIRECTOR_AGENT_SYSTEM_PROMPT, /触发内容[→\s]+主体反应/);
  assert.match(DIRECTOR_AGENT_SYSTEM_PROMPT, /四项合计必须控制在 200 个汉字以内/);
  assert.match(DIRECTOR_AGENT_SYSTEM_PROMPT, /不得在这四项中写时间轴、分镜、Prompt 描述/);
  assert.match(SEEDANCE_PROMPT_GENERATOR_SYSTEM_PROMPT, /【视频时长】、【镜头与场景】、【主体形象】、【时间轴】/);
  assert.match(SEEDANCE_PROMPT_GENERATOR_SYSTEM_PROMPT, /单主体时/);
  assert.match(SEEDANCE_PROMPT_GENERATOR_SYSTEM_PROMPT, /不发生外观漂移/);
  assert.match(SEEDANCE_PROMPT_GENERATOR_SYSTEM_PROMPT, /不得把 Creative Plan 原文重复成第二份方案/);
});

test('基础兜底模板也保留四段结构、真实时间段并简化一秒结尾动作', () => {
  const prompt = buildBasicPromptFromCreativePlan({
    source: { videoDuration: 10 },
    generationConfig: { aspectRatio: 'adaptive', resolution: '720p' },
    assetBindings: bindings,
    creativePlan: {
      storyLogic: '画外音提醒后宠物作出反应',
      directorLogic: '主体位于沙发中央，保持与靠背的空间关系',
      style: '写实', globalConstraints: ['不新增主体'], changes: [], unchanged: [],
      timeline: [
        { start: 0, end: 5.5, content: '听到画外音提醒后，主体立即抬头，眼睛睁大' },
        { start: 5.5, end: 9, content: '主体抬起双爪捂住嘴巴，表情无辜' },
        { start: 9, end: 10, content: '听到画外音后，主体倒下、四脚朝天并打滚' },
      ],
    },
  });
  assert.match(prompt, /^【视频时长】10秒[\s\S]*【镜头与场景】[\s\S]*【主体形象】[\s\S]*【时间轴】/);
  assert.match(prompt, /结尾轻微拉远到中近景/);
  assert.match(prompt, /9–10秒：听到画外音后，主体向后仰倒，四肢自然抬起，轻轻扭动身体/);
  assert.equal((prompt.match(/@图片1/g) || []).length, 1);
});

test('素材绑定顺序同时决定引用和 SeeDance URL 数组顺序', () => {
  const replacements = [
    { group: '主体', asset_id: 'image-b' },
    { group: '场景', asset_id: 'image-a' },
  ];
  const references = [{ id: 'video-a', asset_type: 'video', purpose: 'general_reference' }];
  const orderedBindings = buildPromptAssetBindings(replacements, references);
  assert.deepEqual(orderedBindings.map((item) => item.reference), ['@图片1', '@图片2', '@视频1']);
  assert.deepEqual(orderedBindings.map((item) => item.assetRef), ['@图片1', '@图片2', '@视频1']);
  const ordered = orderAssetsForSeedance(orderedBindings, [
    { id: 'image-a', public_url: 'https://asset/a' },
    { id: 'video-a', public_url: 'https://asset/video' },
    { id: 'image-b', public_url: 'https://asset/b' },
  ]);
  assert.deepEqual(ordered.imageUrls, ['https://asset/b', 'https://asset/a']);
  assert.deepEqual(ordered.videoUrls, ['https://asset/video']);
});

test('图片、视频、音频用途和目标占位符不影响 SeeDance 的权威顺序', () => {
  const references = [
    { id: 'image-extra', asset_type: 'image', purpose: 'scene_reference', target_placeholder_id: 'scene_01', confidence: 0.9, public_url: 'https://asset/image-extra' },
    { id: 'video-extra', asset_type: 'video', purpose: 'action_reference', target_placeholder_id: 'subject_01', confidence: 0.8, public_url: 'https://asset/video-extra' },
    { id: 'audio-extra', asset_type: 'audio', purpose: 'audio_reference', confidence: 0.99, public_url: 'https://asset/audio-extra' },
  ];
  const orderedBindings = buildPromptAssetBindings([{ group: '主体', asset_id: 'replacement' }], references);
  assert.deepEqual(orderedBindings.map((item) => item.reference), ['@图片1', '@图片2', '@视频1', '@音频1']);
  assert.deepEqual(orderedBindings.slice(1).map((item) => item.purpose), ['scene_reference', 'action_reference', 'audio_reference']);
  const ordered = orderAssetsForSeedance(orderedBindings, [
    { id: 'replacement', public_url: 'https://asset/replacement' }, ...references,
  ]);
  assert.deepEqual(ordered.imageUrls, ['https://asset/replacement', 'https://asset/image-extra']);
  assert.deepEqual(ordered.videoUrls, ['https://asset/video-extra']);
  assert.deepEqual(ordered.audioUrls, ['https://asset/audio-extra']);
});
