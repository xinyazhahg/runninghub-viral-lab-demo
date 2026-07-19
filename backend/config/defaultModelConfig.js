const DEFAULT_MODEL_CONFIG = Object.freeze({
  model_id: 'seedance-2.0',
  model_name: 'Seedance 2.0',
  provider: 'RunningHub',
  endpoint: 'rhart-video/sparkvideo-2.0/multimodal-video',
  capability: { type: 'multimodal_video', requires_replacement_images: true, generate_audio: true },
  supported_durations: ['4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
  supported_ratios: ['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9'],
  supported_resolutions: ['480p', '720p'],
  cost_rule: {},
  status: 'active',
  priority: 1,
  _source: 'compatibility_fallback',
});

function isMissingModelConfigTable(error) {
  return error?.code === 'PGRST205' || /model_configs.*schema cache/i.test(error?.message || '');
}

module.exports = { DEFAULT_MODEL_CONFIG, isMissingModelConfigTable };
