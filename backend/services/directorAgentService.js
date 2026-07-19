const { createStructuredLlmClient } = require('./structuredLlmClient');
const { DIRECTOR_AGENT_SYSTEM_PROMPT } = require('../prompts/directorAgentSystemPrompt');
const { resolveSourceVideoDuration, validateCreativePlanResult } = require('../lib/promptAgentJson');

const DEFAULT_DIRECTOR_MODEL = 'google/gemini-3.5-flash';

function normalizeContext(context = {}) {
  return {
    projectId: String(context.projectId || ''),
    previousCreativePlan: context.previousCreativePlan && typeof context.previousCreativePlan === 'object' ? context.previousCreativePlan : null,
    previousPrompt: String(context.previousPrompt || ''),
    generationCount: Number(context.generationCount) || 0,
    history: Array.isArray(context.history) ? context.history : [],
    userPreference: context.userPreference && typeof context.userPreference === 'object' ? context.userPreference : {},
  };
}

function createDirectorAgentService({ llmClient = createStructuredLlmClient(), logger = null } = {}) {
  async function generate(input = {}, context = {}) {
    const generationConfig = input.generationConfig || {};
    const sourceDuration = resolveSourceVideoDuration(input);
    const normalizedInput = {
      source: { videoDuration: sourceDuration },
      videoAnalysis: input.videoAnalysis || {},
      replacements: Array.isArray(input.replacements) ? input.replacements : [],
      assets: Array.isArray(input.assets) ? input.assets : [],
      userRequirement: String(input.userRequirement || ''),
      generationConfig: {
        modelId: String(generationConfig.modelId || 'seedance-2.0'),
        aspectRatio: String(generationConfig.aspectRatio || 'adaptive'),
        resolution: String(generationConfig.resolution || '720p'),
      },
      context: normalizeContext(input.context || context),
      assetBindings: Array.isArray(input.assetBindings) ? input.assetBindings : [],
    };
    const model = process.env.DIRECTOR_AGENT_MODEL || process.env.VIDEO_UNDERSTANDING_MODEL || DEFAULT_DIRECTOR_MODEL;
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await llmClient.complete({
          model, systemPrompt: DIRECTOR_AGENT_SYSTEM_PROMPT, input: normalizedInput,
          timeoutMs: Number(process.env.DIRECTOR_AGENT_TIMEOUT_MS) || 120000,
        });
        const validated = validateCreativePlanResult(response.content, {
          sourceDuration,
          expectedBindings: normalizedInput.assetBindings,
        });
        logger?.info?.({ ...context, action: 'director_agent.generate', status: 'success', modelName: response.model || model, metadata: { attempt } });
        return { ...validated, model: response.model || model, attempts: attempt };
      } catch (error) {
        lastError = error;
        logger?.warn?.({ ...context, action: 'director_agent.generate', status: attempt < 2 ? 'retrying' : 'failed', modelName: model, errorCode: error.code || 'MODEL_RESULT_INVALID', errorMessage: error.message, metadata: { attempt } });
      }
    }
    lastError.attempts = 2;
    throw lastError;
  }

  return { generate, normalizeContext };
}

module.exports = { createDirectorAgentService, normalizeContext, DEFAULT_DIRECTOR_MODEL };
