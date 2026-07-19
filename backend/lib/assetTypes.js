const PHYSICAL_ASSET_TYPES = new Set(['image', 'video', 'audio']);
const GENERIC_BINARY_MIME_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream', 'application/mp4']);
const EXTENSION_MIME_TYPES = {
  '.jpg': ['image', 'image/jpeg'], '.jpeg': ['image', 'image/jpeg'], '.png': ['image', 'image/png'],
  '.webp': ['image', 'image/webp'], '.gif': ['image', 'image/gif'], '.avif': ['image', 'image/avif'],
  '.heic': ['image', 'image/heic'], '.heif': ['image', 'image/heif'], '.bmp': ['image', 'image/bmp'],
  '.mp4': ['video', 'video/mp4'], '.mov': ['video', 'video/quicktime'], '.webm': ['video', 'video/webm'],
  '.m4v': ['video', 'video/x-m4v'], '.avi': ['video', 'video/x-msvideo'], '.mkv': ['video', 'video/x-matroska'],
  '.mp3': ['audio', 'audio/mpeg'], '.wav': ['audio', 'audio/wav'], '.m4a': ['audio', 'audio/mp4'],
  '.aac': ['audio', 'audio/aac'], '.ogg': ['audio', 'audio/ogg'], '.flac': ['audio', 'audio/flac'],
};
const REFERENCE_PURPOSES = new Set([
  'character_reference',
  'scene_reference',
  'prop_reference',
  'style_reference',
  'action_reference',
  'audio_reference',
  'general_reference',
]);

const LEGACY_TYPE_MAP = {
  original_video: { type: 'video', purpose: 'source_video' },
  replacement_image: { type: 'image', purpose: 'general_reference' },
  result_video: { type: 'video', purpose: 'generated_video' },
  reference_image: { type: 'image', purpose: 'general_reference' },
  reference_video: { type: 'video', purpose: 'general_reference' },
  reference_audio: { type: 'audio', purpose: 'general_reference' },
};

function replacementPurpose(replacementType) {
  return {
    subject: 'character_reference',
    scene: 'scene_reference',
    element: 'prop_reference',
  }[replacementType] || 'general_reference';
}

function physicalAssetType(asset = {}) {
  const value = String(asset.asset_type || asset.type || '').trim();
  if (PHYSICAL_ASSET_TYPES.has(value)) return value;
  return LEGACY_TYPE_MAP[value]?.type || '';
}

function assetPurpose(asset = {}) {
  const explicit = String(asset.purpose || '').trim();
  if (explicit) return explicit;
  if (asset.replacement_type) return replacementPurpose(asset.replacement_type);
  return LEGACY_TYPE_MAP[String(asset.asset_type || '').trim()]?.purpose || '';
}

function isReplacementAsset(asset) {
  return physicalAssetType(asset) === 'image'
    && ['subject', 'scene', 'element'].includes(String(asset?.replacement_type || ''));
}

function isReferenceAsset(asset) {
  return !asset?.replacement_type
    && PHYSICAL_ASSET_TYPES.has(physicalAssetType(asset))
    && REFERENCE_PURPOSES.has(assetPurpose(asset));
}

function isSourceVideoAsset(asset) {
  return physicalAssetType(asset) === 'video' && assetPurpose(asset) === 'source_video';
}

function isGeneratedVideoAsset(asset) {
  return physicalAssetType(asset) === 'video' && assetPurpose(asset) === 'generated_video';
}

function assertPhysicalAssetType(value) {
  if (!PHYSICAL_ASSET_TYPES.has(value)) {
    const error = new Error('assetType 必须是 image、video 或 audio');
    error.statusCode = 400;
    throw error;
  }
}

function normalizePhysicalMimeType(assetType, mimeType, fileName = '') {
  assertPhysicalAssetType(assetType);
  const normalizedMimeType = String(mimeType || '').split(';')[0].trim().toLowerCase();
  const expectedPrefix = `${assetType}/`;
  if (normalizedMimeType.startsWith(expectedPrefix)) return normalizedMimeType;

  if (GENERIC_BINARY_MIME_TYPES.has(normalizedMimeType)) {
    const extension = /\.[^.]+$/.exec(String(fileName || '').toLowerCase())?.[0] || '';
    const detected = EXTENSION_MIME_TYPES[extension];
    if (detected?.[0] === assetType) return detected[1];
  }

  const error = new Error('参考素材类型与上传文件不匹配');
  error.statusCode = 415;
  throw error;
}

function assertAssetMimeType(assetType, mimeType, fileName = '') {
  normalizePhysicalMimeType(assetType, mimeType, fileName);
}

function normalizeReferencePurpose(value, assetType = '') {
  const defaultPurpose = assetType === 'audio' ? 'audio_reference'
    : assetType === 'video' ? 'action_reference'
      : 'general_reference';
  const purpose = String(value || defaultPurpose).trim();
  return REFERENCE_PURPOSES.has(purpose) ? purpose : defaultPurpose;
}

module.exports = {
  PHYSICAL_ASSET_TYPES,
  REFERENCE_PURPOSES,
  replacementPurpose,
  physicalAssetType,
  assetPurpose,
  isReplacementAsset,
  isReferenceAsset,
  isSourceVideoAsset,
  isGeneratedVideoAsset,
  assertPhysicalAssetType,
  assertAssetMimeType,
  normalizePhysicalMimeType,
  normalizeReferencePurpose,
};
