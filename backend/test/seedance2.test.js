const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  SEEDANCE_2_ENDPOINT, quoteSeedanceProviderCost, sanitizeSeedancePayload,
  buildSeedancePayload, seedanceSubmissionError, selectSeedanceVideoResult,
} = require('../lib/seedance2');
const { buildPersistedGenerationConfig } = require('../lib/generationConfig');
const { calculateCreditCost } = require('../lib/billingRules');

test('Seedance 2.0 sends replacement images and explicitly uploaded reference media', () => {
  const payload = buildSeedancePayload({
    prompt: 'completed prompt', resolution: '720p', duration: 4, ratio: 'adaptive',
    imageUrls: ['https://asset/replacement.png'], videoUrls: ['https://asset/reference.mp4'],
    audioUrls: ['https://asset/reference.mp3'],
  });
  assert.equal(SEEDANCE_2_ENDPOINT, 'rhart-video/sparkvideo-2.0/multimodal-video');
  assert.equal(payload.duration, '4');
  assert.deepEqual(payload.imageUrls, ['https://asset/replacement.png']);
  assert.deepEqual(payload.videoUrls, ['https://asset/reference.mp4']);
  assert.deepEqual(payload.audioUrls, ['https://asset/reference.mp3']);
  assert.equal(payload.generateAudio, true);
  assert.equal(Object.hasOwn(payload, 'realPersonMode'), false);
  assert.deepEqual(payload.conversionSlots, ['all']);
  assert.equal(payload.seed, -1);
});

test('Seedance request uses the selected 10s final duration without any stale 4s value', () => {
  const payload = buildSeedancePayload({
    prompt: '10s prompt', resolution: '720p', duration: 10, ratio: '16:9',
    imageUrls: ['https://asset/replacement.png'],
  });
  assert.equal(payload.duration, '10');
  assert.notEqual(payload.duration, '4');
});

test('Seedance initial and rebuilt retry payloads remove realPersonMode completely', () => {
  const contaminated = {
    ...buildSeedancePayload({
      prompt: 'prompt', resolution: '480p', duration: 4, ratio: '1:1',
      imageUrls: ['https://asset/replacement.png'],
    }),
    realPersonMode: true,
    real_person_mode: true,
  };
  const initialPayload = sanitizeSeedancePayload(contaminated);
  const retryPayload = sanitizeSeedancePayload({ ...contaminated });
  assert.equal(Object.hasOwn(initialPayload, 'realPersonMode'), false);
  assert.equal(Object.hasOwn(initialPayload, 'real_person_mode'), false);
  assert.equal(Object.hasOwn(retryPayload, 'realPersonMode'), false);
  assert.equal(Object.hasOwn(retryPayload, 'real_person_mode'), false);
});

test('RunningHub errorCode 1007 is a non-retryable Chinese parameter error', () => {
  const error = seedanceSubmissionError({ errorCode: 1007, errorMessage: 'invalid boolean' });
  assert.equal(error.message, 'Seedance 请求参数无效，请检查模型配置后重试。');
  assert.equal(error.nonRetryable, true);
  assert.equal(error.providerErrorCode, '1007');
});

test('Seedance 2.0 reference-video quote uses input plus output duration', () => {
  const quote = quoteSeedanceProviderCost({ inputVideoDuration: 6, duration: 4, resolution: '720p' });
  assert.equal(quote.estimatedBillingSeconds, 10);
  assert.equal(quote.providerCost, 1.2);
  assert.equal(calculateCreditCost({
    costRule: { enabled: true, provider_to_credit_rate: 10 }, providerCost: quote.providerCost,
    duration: 4, resolution: '720p', aspectRatio: 'adaptive',
  }), 12);
});

test('Seedance 2.0 refuses submission when reference duration is missing', () => {
  assert.throws(
    () => quoteSeedanceProviderCost({ inputVideoDuration: 0, duration: 4, resolution: '480p' }),
    /未能读取参考视频时长/
  );
});

test('Seedance 2.0 selects an mp4 result before a fallback result', () => {
  assert.equal(selectSeedanceVideoResult([
    { outputType: 'jpg', url: 'https://asset/frame.jpg' },
    { outputType: 'mp4', url: 'https://asset/result.mp4' },
  ]), 'https://asset/result.mp4');
});

test('Seedance Task model_params keep multimodal billing inputs', () => {
  const persisted = buildPersistedGenerationConfig({
    duration: '4', ratio: 'adaptive', resolution: '720p', inputVideoDuration: 6,
    estimatedBillingSeconds: 10, generateAudio: true,
    model: { id: 'seedance-2.0', label: 'Seedance 2.0', provider: 'RunningHub', endpoint: SEEDANCE_2_ENDPOINT },
  });
  assert.equal(persisted.model_id, 'seedance-2.0');
  assert.equal(persisted.model_name, 'Seedance 2.0');
  assert.equal(persisted.generate_audio, true);
  assert.equal(persisted.inputVideoDuration, 6);
  assert.equal(persisted.estimatedBillingSeconds, 10);
});

test('Seedance migration adds the active model without deleting historical models', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/011_seedance_2_model.sql'), 'utf8');
  assert.match(sql, /'seedance-2\.0'/);
  assert.match(sql, /sparkvideo-2\.0\/multimodal-video/);
  assert.match(sql, /'\["480p","720p"\]'/);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.model_configs/i);
});

test('Seedance-only migration deactivates Kling without deleting historical data', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/012_seedance_only_generation.sql'), 'utf8');
  assert.match(sql, /where model_id like 'kling%'/i);
  assert.match(sql, /set status = 'inactive'/i);
  assert.match(sql, /where model_id = 'seedance-2\.0'/i);
  assert.doesNotMatch(sql, /delete\s+from/i);
  assert.doesNotMatch(sql, /truncate/i);
});
