const SEEDANCE_2_MODEL_ID = 'seedance-2.0';
const SEEDANCE_2_ENDPOINT = 'rhart-video/sparkvideo-2.0/multimodal-video';

function seedanceBillingSeconds(inputVideoDuration, outputDuration) {
  const inputSeconds = Number(inputVideoDuration);
  const outputSeconds = Number(outputDuration);
  if (!Number.isFinite(inputSeconds) || inputSeconds <= 0) {
    throw new Error('未能读取参考视频时长，请重新上传视频。');
  }
  if (!Number.isFinite(outputSeconds) || outputSeconds < 4 || outputSeconds > 15) {
    throw new Error('Seedance 2.0 视频时长必须为4-15秒');
  }
  return inputSeconds + outputSeconds;
}

function quoteSeedanceProviderCost({ inputVideoDuration, duration, resolution }) {
  const billingSeconds = seedanceBillingSeconds(inputVideoDuration, duration);
  const rate = { '480p': 0.06, '720p': 0.12 }[String(resolution).toLowerCase()];
  if (!rate) throw new Error('Seedance 2.0 第一版仅支持480p或720p');
  return { providerCost: billingSeconds * rate, estimatedBillingSeconds: billingSeconds, currency: 'USD' };
}

function sanitizeSeedancePayload(payload = {}) {
  const clean = { ...payload };
  delete clean.realPersonMode;
  delete clean.real_person_mode;
  return clean;
}

function buildSeedancePayload({ prompt, resolution, duration, imageUrls, videoUrls = [], audioUrls = [], ratio }) {
  const images = [...new Set((imageUrls || []).filter(Boolean))];
  if (!images.length) throw new Error('Seedance 2.0 需要至少一张替换素材图片');
  return sanitizeSeedancePayload({
    prompt,
    resolution: String(resolution).toLowerCase(),
    duration: String(duration),
    imageUrls: images,
    videoUrls: [...new Set(videoUrls.filter(Boolean))],
    audioUrls: [...new Set(audioUrls.filter(Boolean))],
    generateAudio: true,
    ratio,
    conversionSlots: ['all'],
    returnLastFrame: false,
    seed: -1,
  });
}

function seedanceSubmissionError(response = {}) {
  const providerErrorCode = String(response.errorCode ?? response.code ?? '');
  if (providerErrorCode === '1007') {
    const error = new Error('Seedance 请求参数无效，请检查模型配置后重试。');
    error.code = 'TASK_STATE_INVALID';
    error.providerErrorCode = '1007';
    error.nonRetryable = true;
    return error;
  }
  const error = new Error('Seedance 2.0 提交失败，请稍后重试。');
  error.code = 'MODEL_REQUEST_FAILED';
  error.providerErrorCode = providerErrorCode || null;
  return error;
}

function selectSeedanceVideoResult(results = []) {
  const list = Array.isArray(results) ? results : [];
  const mp4 = list.find((item) => String(item?.outputType || '').toLowerCase() === 'mp4' && item?.url);
  const selected = mp4 || (list.length === 1 ? list[0] : null);
  if (!selected?.url) throw new Error('Seedance 2.0 生成成功但未返回mp4视频地址');
  return selected.url;
}

module.exports = {
  SEEDANCE_2_MODEL_ID,
  SEEDANCE_2_ENDPOINT,
  seedanceBillingSeconds,
  quoteSeedanceProviderCost,
  sanitizeSeedancePayload,
  buildSeedancePayload,
  seedanceSubmissionError,
  selectSeedanceVideoResult,
};
