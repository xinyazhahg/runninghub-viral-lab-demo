const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  physicalAssetType, assetPurpose, isReplacementAsset, isReferenceAsset,
  isSourceVideoAsset, isGeneratedVideoAsset, replacementPurpose, normalizePhysicalMimeType,
} = require('../lib/assetTypes');

test('assets.asset_type 只使用物理类型，业务用途由 purpose 和 replacement_type 表达', () => {
  const replacement = { asset_type: 'image', purpose: 'character_reference', replacement_type: 'subject' };
  const imageReference = { asset_type: 'image', purpose: 'general_reference', replacement_type: null };
  const videoReference = { asset_type: 'video', purpose: 'action_reference', replacement_type: null };
  const audioReference = { asset_type: 'audio', purpose: 'general_reference', replacement_type: null };
  assert.equal(isReplacementAsset(replacement), true);
  assert.equal(isReferenceAsset(replacement), false);
  assert.equal(isReferenceAsset(imageReference), true);
  assert.equal(isReferenceAsset(videoReference), true);
  assert.equal(isReferenceAsset(audioReference), true);
  assert.equal(replacementPurpose('scene'), 'scene_reference');
});

test('原视频、生成结果和旧数据可被兼容识别', () => {
  assert.equal(isSourceVideoAsset({ asset_type: 'video', purpose: 'source_video' }), true);
  assert.equal(isGeneratedVideoAsset({ asset_type: 'video', purpose: 'generated_video' }), true);
  assert.equal(physicalAssetType({ asset_type: 'reference_audio' }), 'audio');
  assert.equal(assetPurpose({ asset_type: 'original_video' }), 'source_video');
});

test('参考素材接受 image/*、video/*、audio/* 并安全归一化通用 MIME', () => {
  assert.equal(normalizePhysicalMimeType('image', 'image/png', 'cover.png'), 'image/png');
  assert.equal(normalizePhysicalMimeType('image', '', 'cover.jpg'), 'image/jpeg');
  assert.equal(normalizePhysicalMimeType('image', 'application/octet-stream', 'cover.webp'), 'image/webp');
  assert.equal(normalizePhysicalMimeType('video', 'application/octet-stream', 'clip.mp4'), 'video/mp4');
  assert.equal(normalizePhysicalMimeType('video', '', 'clip.mov'), 'video/quicktime');
  assert.equal(normalizePhysicalMimeType('video', 'binary/octet-stream', 'clip.webm'), 'video/webm');
  assert.equal(normalizePhysicalMimeType('audio', 'application/octet-stream', 'voice.mp3'), 'audio/mpeg');
  assert.equal(normalizePhysicalMimeType('audio', '', 'voice.wav'), 'audio/wav');
  assert.equal(normalizePhysicalMimeType('audio', '', 'voice.m4a'), 'audio/mp4');
  assert.throws(() => normalizePhysicalMimeType('video', 'image/png', 'fake.mp4'), /参考素材类型与上传文件不匹配/);
});

test('015 migration 收敛约束并迁移旧枚举', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/015_physical_asset_types.sql'), 'utf8');
  assert.match(sql, /asset_type in \('image', 'video', 'audio'\)/);
  assert.match(sql, /add column if not exists purpose text/);
  assert.match(sql, /when asset_type = 'reference_audio' then 'audio'/);
  assert.match(sql, /where purpose = 'generated_video'/);
});

test('016 migration 幂等修复实际上传库的旧约束与 MIME 策略', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/016_reference_upload_contract.sql'), 'utf8');
  assert.match(sql, /asset_type in \('image', 'video', 'audio'\)/);
  assert.match(sql, /when asset_type in \('original_video', 'result_video', 'reference_video'\) then 'video'/);
  assert.match(sql, /set allowed_mime_types = null/);
});
