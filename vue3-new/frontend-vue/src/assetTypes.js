const REFERENCE_PURPOSES = new Set([
  'character_reference',
  'scene_reference',
  'prop_reference',
  'style_reference',
  'action_reference',
  'audio_reference',
  'general_reference',
])

export function persistedAssetType(asset = {}) {
  const type = String(asset.asset_type || asset.type || '')
  if (['image', 'video', 'audio'].includes(type)) return type
  return {
    original_video: 'video', replacement_image: 'image', result_video: 'video',
    reference_image: 'image', reference_video: 'video', reference_audio: 'audio',
  }[type] || ''
}

export function isReplacementAsset(asset = {}) {
  return persistedAssetType(asset) === 'image'
    && ['subject', 'scene', 'element'].includes(String(asset.replacement_type || ''))
}

export function isReferenceAsset(asset = {}) {
  const legacyReference = /^reference_(image|video|audio)$/.test(String(asset.asset_type || ''))
  return !asset.replacement_type
    && (legacyReference || REFERENCE_PURPOSES.has(String(asset.purpose || '')))
    && ['image', 'video', 'audio'].includes(persistedAssetType(asset))
}

export function isSourceVideoAsset(asset = {}) {
  return asset.asset_type === 'original_video'
    || (persistedAssetType(asset) === 'video' && asset.purpose === 'source_video')
}
