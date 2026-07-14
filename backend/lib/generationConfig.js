function buildPersistedGenerationConfig(config, input = {}) {
  const duration = Number(config.duration);
  const clipStart = Math.max(0, Number(input.clipStart) || 0);
  const requestedClipEnd = Number(input.clipEnd);
  const clipEnd = Number.isFinite(requestedClipEnd) && requestedClipEnd > clipStart
    ? requestedClipEnd
    : clipStart + duration;
  return {
    duration,
    aspect_ratio: config.ratio,
    resolution: config.resolution,
    model_name: config.model.label,
    model_id: config.model.id,
    model_provider: config.model.provider || '',
    model_endpoint: config.model.endpoint || '',
    generate_audio: false,
    real_person_mode: true,
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
    aspect_ratio: generationConfig.aspect_ratio,
    resolution: generationConfig.resolution,
    model_name: generationConfig.model_name,
    model_params: generationConfig,
    clipStart,
    clipEnd,
  };
}

module.exports = { buildPersistedGenerationConfig, buildGenerationTaskInput };
