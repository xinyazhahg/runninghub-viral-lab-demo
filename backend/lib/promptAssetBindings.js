const { physicalAssetType, assetPurpose, replacementPurpose } = require('./assetTypes');

const PURPOSE_LABELS = {
  character_reference: '主体外观参考',
  scene_reference: '场景环境参考',
  prop_reference: '元素或道具参考',
  style_reference: '视觉风格参考',
  action_reference: '动作、节奏与运镜参考',
  audio_reference: '对白节奏与音色参考',
  general_reference: '通用参考',
};

function withBindingMetadata(binding, source = {}) {
  return {
    ...binding,
    assetRef: binding.reference,
    purposeLabel: PURPOSE_LABELS[binding.purpose] || '通用参考',
    targetPlaceholderId: source.targetPlaceholderId || source.target_placeholder_id || '',
    confidence: Number.isFinite(Number(source.confidence)) ? Number(source.confidence) : 1,
  };
}

function buildPromptAssetBindings(replacements = [], assets = []) {
  let imageIndex = 0;
  let videoIndex = 0;
  let audioIndex = 0;
  const replacementBindings = replacements.map((item) => withBindingMetadata({
    reference: `@图片${++imageIndex}`,
    assetId: item.asset_id || item.assetId,
    type: 'image',
    purpose: replacementPurpose({ 主体: 'subject', 场景: 'scene', 元素: 'element' }[item.group]),
    group: item.group || '替换图片',
    original: item.original || item.group || '',
    required: true,
  }, { ...item, confidence: 1 }));
  const referenceBindings = assets.map((asset) => {
    const type = physicalAssetType(asset);
    const purpose = assetPurpose(asset);
    if (type === 'image') return withBindingMetadata({ reference: `@图片${++imageIndex}`, assetId: asset.assetId || asset.id, type, purpose, group: '额外图片', required: true }, asset);
    if (type === 'video') return withBindingMetadata({ reference: `@视频${++videoIndex}`, assetId: asset.assetId || asset.id, type, purpose, group: '额外视频', required: true }, asset);
    return withBindingMetadata({ reference: `@音频${++audioIndex}`, assetId: asset.assetId || asset.id, type: 'audio', purpose, group: '额外音频', required: true }, asset);
  });
  return [...replacementBindings, ...referenceBindings];
}

function orderAssetsForSeedance(bindings = [], assets = []) {
  const byId = new Map(assets.map((asset) => [asset.id || asset.assetId, asset]));
  const urls = { imageUrls: [], videoUrls: [], audioUrls: [] };
  for (const binding of bindings) {
    const asset = byId.get(binding.assetId);
    const url = asset?.public_url || asset?.signed_url || asset?.url || asset?.asset_url || '';
    if (!url) continue;
    if (binding.type === 'video') urls.videoUrls.push(url);
    else if (binding.type === 'audio') urls.audioUrls.push(url);
    else urls.imageUrls.push(url);
  }
  return urls;
}

module.exports = { PURPOSE_LABELS, buildPromptAssetBindings, orderAssetsForSeedance };
