const DEFAULT_MODEL_CONFIG = Object.freeze({
  model_id: 'kling-v3-pro',
  model_name: '可灵 v3.0 Pro',
  provider: 'RunningHub',
  endpoint: 'bytedance/seedance-2.0-global-fast/multimodal-video',
  capability: { type: 'image_to_video', generate_audio: false, real_person_mode: true },
  supported_durations: ['4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
  supported_ratios: ['9:16', '16:9', '4:3', '1:1', '3:4', '21:9'],
  supported_resolutions: ['480p', '720p', '1080p', '2k', '4k'],
  cost_rule: {},
  status: 'active',
  priority: 10,
  _source: 'compatibility_fallback',
});

function isMissingModelConfigTable(error) {
  return error?.code === 'PGRST205' || /model_configs.*schema cache/i.test(error?.message || '');
}

module.exports = { DEFAULT_MODEL_CONFIG, isMissingModelConfigTable };
