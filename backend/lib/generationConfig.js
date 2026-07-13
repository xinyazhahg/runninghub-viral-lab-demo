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

module.exports = { buildPersistedGenerationConfig };
