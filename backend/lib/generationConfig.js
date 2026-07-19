function buildFinalGenerationConfig(config = {}) {
  const duration = Number(config.duration);
  const ratio = String(config.ratio || '').trim();
  const resolution = String(config.resolution || '').trim().toLowerCase();
  if (!Number.isFinite(duration) || duration <= 0 || !ratio || !resolution || !config.model?.id) {
    throw new Error('生成配置同步失败，请重新选择时长后重试。');
  }
  return Object.freeze({ duration, ratio, resolution, model: config.model });
}

function buildPersistedGenerationConfig(config, input = {}) {
  const duration = Number(config.duration);
  const clipStart = Math.max(0, Number(input.clipStart) || 0);
  const requestedClipEnd = Number(input.clipEnd);
  const clipEnd = Number.isFinite(requestedClipEnd) && requestedClipEnd > clipStart
    ? requestedClipEnd
    : clipStart + duration;
  return {
    duration,
    targetDuration: duration,
    aspect_ratio: config.ratio,
    resolution: config.resolution,
    model_name: config.model.label,
    model_id: config.model.id,
    model_provider: config.model.provider || '',
    model_endpoint: config.model.endpoint || '',
    generate_audio: Boolean(input.generateAudio ?? config.generateAudio),
    inputVideoDuration: Number(input.inputVideoDuration ?? config.inputVideoDuration) || null,
    estimatedBillingSeconds: Number(input.estimatedBillingSeconds ?? config.estimatedBillingSeconds) || null,
    clip_start: clipStart,
    clip_end: clipEnd,
    // Compatibility keys used by the existing generation and recovery paths.
    ratio: config.ratio,
    model: config.model.id,
    modelLabel: config.model.label,
  };
}

function buildGenerationTaskInput({
  prompt = '', breakdown = null, replacements = [], extraPrompt = '', sourceVideoTaskId = '',
  sourceVideoUrl = '', sourceVideoStoragePath = '', generationConfig = {}, clipStart = 0, clipEnd = null,
  promptSnapshot = null,
  billingQuote = null,
  promptDuration = null,
} = {}) {
  const replacementAssets = Array.isArray(replacements) ? replacements : [];
  return {
    prompt,
    prompt_snapshot: promptSnapshot,
    billing_quote: billingQuote,
    breakdown,
    replacements: replacementAssets,
    replacement_assets: replacementAssets,
    extra_prompt: extraPrompt,
    extraPrompt,
    sourceVideoTaskId,
    sourceVideoUrl,
    sourceVideoStoragePath,
    generation_config: generationConfig,
    config: generationConfig,
    duration: generationConfig.duration,
    targetDuration: Number(generationConfig.targetDuration ?? generationConfig.duration) || null,
    promptDuration: Number(promptDuration) || null,
    aspect_ratio: generationConfig.aspect_ratio,
    resolution: generationConfig.resolution,
    model: generationConfig.model_id,
    model_id: generationConfig.model_id,
    model_name: generationConfig.model_name,
    model_params: generationConfig,
    clipStart,
    clipEnd,
  };
}

module.exports = { buildFinalGenerationConfig, buildPersistedGenerationConfig, buildGenerationTaskInput };
