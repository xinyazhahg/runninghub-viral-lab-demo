export function formatGenerationSpecs(version = {}) {
  return [
    version.ratio || '9:16',
    (version.quality || '720P').toUpperCase(),
    version.duration || '10s',
    version.model || '历史模型',
    version.creditCost !== null && version.creditCost !== undefined
      ? `${version.creditCost}积分`
      : (version.cost || ''),
  ].filter(Boolean).join(' / ')
}
