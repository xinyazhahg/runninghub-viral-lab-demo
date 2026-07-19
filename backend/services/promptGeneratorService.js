const { createStructuredLlmClient } = require('./structuredLlmClient');
const { SEEDANCE_PROMPT_GENERATOR_SYSTEM_PROMPT } = require('../prompts/seedancePromptGeneratorSystemPrompt');
const { resolveSourceVideoDuration, validatePromptGeneratorResult } = require('../lib/promptAgentJson');

const DEFAULT_PROMPT_GENERATOR_MODEL = 'google/gemini-3.5-flash';

function referenceInstruction(binding) {
  const target = binding.targetPlaceholderId ? `，绑定目标 ${binding.targetPlaceholderId}` : '';
  const instructions = {
    character_reference: `${binding.reference} 用于主体外观参考，不复制图片背景`,
    scene_reference: `${binding.reference} 用于场景环境参考，不复制无关人物和物体`,
    prop_reference: `${binding.reference} 用于元素或道具参考`,
    style_reference: `${binding.reference} 用于视觉风格参考`,
    action_reference: `${binding.reference} 用于动作顺序、剧情节奏和运镜参考`,
    audio_reference: `${binding.reference} 用于对白节奏和音色参考`,
    general_reference: `${binding.reference} 用于通用视觉或内容参考`,
  };
  return `${instructions[binding.purpose] || `${binding.reference} 用于${binding.purposeLabel || '通用参考'}`}${target}`;
}

function executableTimelineContent(item, { isFinal = false, singleCharacterReference = '' } = {}) {
  let content = String(item?.content || '').trim()
    .replace(/求生欲爆发/g, '快速抬头，眼睛睁大')
    .replace(/谄媚/g, '连续点头，露出讨好表情')
    .replace(/狂喜/g, '张大嘴巴，眼睛睁大');
  if (singleCharacterReference) content = content.split(singleCharacterReference).join('主体');

  const segmentDuration = Number(item?.end) - Number(item?.start);
  const complexActions = ['倒下', '仰倒', '四脚朝天', '打滚', '翻滚'].filter((term) => content.includes(term));
  if (isFinal && segmentDuration <= 1.05 && complexActions.length > 1) {
    const trigger = content.match(/^(.{0,100}(?:听到|画外音|旁白|对白|声音|音效).{0,50}?(?:后|时))[，,;；]?/)?.[1] || '';
    content = `${trigger ? `${trigger}，` : ''}主体向后仰倒，四肢自然抬起，轻轻扭动身体`;
  }
  return content || '主体按原视频该时间段完成核心动作。';
}

function buildBasicPromptFromCreativePlan({ creativePlan, assetBindings, generationConfig, source }) {
  const sourceDuration = resolveSourceVideoDuration({ source });
  const characterBindings = assetBindings.filter((item) => item.purpose === 'character_reference');
  const singleCharacterReference = characterBindings.length === 1 ? characterBindings[0].reference : '';
  const timelineItems = creativePlan.timeline || [];
  const timeline = timelineItems.map((item, index) => (
    `${item.start}–${item.end}秒：${executableTimelineContent(item, {
      isFinal: index === timelineItems.length - 1,
      singleCharacterReference,
    })}`
  )).join('\n');
  const supportingReferences = assetBindings
    .filter((item) => item.purpose !== 'character_reference')
    .map(referenceInstruction)
    .join('；');
  const subjectConsistency = characterBindings.length
    ? characterBindings.map((binding) => `主体形象严格参考${binding.reference}，全程保持毛色、脸型、服装、体型一致，不发生外观漂移。`).join('\n')
    : '主体全程保持外观、毛色、脸型、服装和体型一致，不发生外观漂移。';
  const constraints = (creativePlan.globalConstraints || []).join('；') || '画面稳定、动作连续，不新增无依据内容';
  const endingContent = String(timelineItems.at(-1)?.content || '');
  const endingNeedsWiderShot = /(倒下|仰倒|打滚|翻滚|四脚朝天|完整肢体)/.test(endingContent);
  const cameraPlan = `单镜头连续拍摄，无剪辑；前段使用平视、正面、固定机位特写${endingNeedsWiderShot ? '；结尾轻微拉远到中近景，完整容纳主体肢体动作' : ''}。`;
  return `【视频时长】${sourceDuration}秒

【镜头与场景】
${cameraPlan}
${creativePlan.directorLogic || creativePlan.storyLogic || '保持原视频已确认的主体、承载物与空间关系。'}
主体、承载物与空间位置关系严格保持 Creative Plan 中已确认的布局。
${creativePlan.style ? `整体风格：${creativePlan.style}。` : ''}
${supportingReferences ? `参考素材：${supportingReferences}。` : ''}
画面规格为${generationConfig.aspectRatio || 'adaptive'}比例、${generationConfig.resolution || '720p'}；${constraints}。

【主体形象】
${subjectConsistency}

【时间轴】
${timeline}
`.trim();
}

function createPromptGeneratorService({ llmClient = createStructuredLlmClient(), logger = null } = {}) {
  async function generate(input = {}, context = {}) {
    const sourceDuration = resolveSourceVideoDuration(input);
    const generationConfig = input.generationConfig || {};
    const normalizedInput = {
      creativePlan: input.creativePlan || {},
      assetBindings: Array.isArray(input.assetBindings) ? input.assetBindings : [],
      source: { videoDuration: sourceDuration },
      generationConfig: {
        modelId: String(generationConfig.modelId || 'seedance-2.0'),
        modelName: String(generationConfig.modelName || ''),
        aspectRatio: String(generationConfig.aspectRatio || 'adaptive'),
        resolution: String(generationConfig.resolution || '720p'),
      },
    };
    const model = process.env.PROMPT_GENERATOR_MODEL || process.env.DIRECTOR_AGENT_MODEL || process.env.VIDEO_UNDERSTANDING_MODEL || DEFAULT_PROMPT_GENERATOR_MODEL;
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await llmClient.complete({
          model, systemPrompt: SEEDANCE_PROMPT_GENERATOR_SYSTEM_PROMPT, input: normalizedInput,
          timeoutMs: Number(process.env.PROMPT_GENERATOR_TIMEOUT_MS) || 120000,
        });
        const validated = validatePromptGeneratorResult(response.content, {
          sourceDuration,
          expectedBindings: normalizedInput.assetBindings,
          creativePlan: normalizedInput.creativePlan,
        });
        logger?.info?.({ ...context, action: 'prompt_generator.generate', status: 'success', modelName: response.model || model, metadata: { attempt } });
        return { ...validated, model: response.model || model, attempts: attempt, mode: 'seedance_prompt_generator' };
      } catch (error) {
        lastError = error;
        logger?.warn?.({ ...context, action: 'prompt_generator.generate', status: attempt < 2 ? 'retrying' : 'failed', modelName: model, errorCode: error.code || 'MODEL_RESULT_INVALID', errorMessage: error.message, metadata: { attempt } });
      }
    }
    const finalPrompt = buildBasicPromptFromCreativePlan(normalizedInput);
    const fallback = validatePromptGeneratorResult({
      finalPrompt,
      references: normalizedInput.assetBindings.map((item) => item.reference),
      negativeConstraints: normalizedInput.creativePlan.globalConstraints || [],
      warnings: [`Prompt Generator 调用失败，已使用基础模板：${lastError?.code || 'MODEL_RESULT_INVALID'}`],
    }, {
      sourceDuration,
      expectedBindings: normalizedInput.assetBindings,
      creativePlan: normalizedInput.creativePlan,
    });
    return { ...fallback, model: null, attempts: 2, mode: 'basic_template', fallbackReason: lastError?.code || 'MODEL_RESULT_INVALID' };
  }

  return { generate, buildBasicPromptFromCreativePlan };
}

module.exports = { createPromptGeneratorService, buildBasicPromptFromCreativePlan, DEFAULT_PROMPT_GENERATOR_MODEL };
