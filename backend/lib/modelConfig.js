function validateModelSelection(modelRecord, input = {}) {
  if (!modelRecord || modelRecord.status !== 'active') throw new Error('所选生成模型暂不支持，请重新选择');
  const ratio = String(input.aspectRatio || '9:16');
  const resolution = String(input.resolution || '720p').toLowerCase();
  const duration = String(input.duration || '10');
  const durations = Array.isArray(modelRecord.supported_durations) ? modelRecord.supported_durations.map(String) : [];
  const ratios = Array.isArray(modelRecord.supported_ratios) ? modelRecord.supported_ratios.map(String) : [];
  const resolutions = Array.isArray(modelRecord.supported_resolutions)
    ? modelRecord.supported_resolutions.map((item) => String(item).toLowerCase()) : [];
  if (!ratios.includes(ratio)) throw new Error('所选视频比例不受当前模型支持，请重新选择');
  if (!resolutions.includes(resolution)) throw new Error('所选清晰度不受当前模型支持，请重新选择');
  if (!durations.includes(duration)) throw new Error('所选视频时长不受当前模型支持，请重新选择');
  return {
    model: {
      id: modelRecord.model_id, label: modelRecord.model_name,
      provider: modelRecord.provider, endpoint: modelRecord.endpoint, costRule: modelRecord.cost_rule || {},
    },
    ratio, resolution, duration,
  };
}

function validatePromptModelSelection(modelRecord, input = {}) {
  if (!modelRecord || modelRecord.status !== 'active') throw new Error('所选生成模型暂不支持，请重新选择');
  const ratio = String(input.aspectRatio || '9:16');
  const resolution = String(input.resolution || '720p').toLowerCase();
  const ratios = Array.isArray(modelRecord.supported_ratios) ? modelRecord.supported_ratios.map(String) : [];
  const resolutions = Array.isArray(modelRecord.supported_resolutions)
    ? modelRecord.supported_resolutions.map((item) => String(item).toLowerCase()) : [];
  if (!ratios.includes(ratio)) throw new Error('所选视频比例不受当前模型支持，请重新选择');
  if (!resolutions.includes(resolution)) throw new Error('所选清晰度不受当前模型支持，请重新选择');
  return {
    model: {
      id: modelRecord.model_id, label: modelRecord.model_name,
      provider: modelRecord.provider, endpoint: modelRecord.endpoint, costRule: modelRecord.cost_rule || {},
    },
    ratio,
    resolution,
  };
}

module.exports = { validateModelSelection, validatePromptModelSelection };
