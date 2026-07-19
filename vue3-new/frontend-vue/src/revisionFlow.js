export function nextVersionId(versions = []) {
  const maxNumber = versions.reduce((max, version) => {
    const match = String(version?.id || '').match(/^V(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `V${maxNumber + 1}`
}

export function resetItemsForRevision(items = [], fallbackPreviewUrl = '') {
  return items.map((item) => {
    const originalPreview = item.subjectPreviewUrl
      || item.scenePreviewUrl
      || item.elementPreviewUrl
      || item.textPreviewUrl
      || fallbackPreviewUrl
    return {
      ...item,
      current: item.original,
      changed: false,
      replacement: '',
      replacementFilename: '',
      replacementName: '',
      displayName: '',
      file: null,
      replacementFile: null,
      assetFile: null,
      assetId: '',
      assetUrl: '',
      imageUrl: '',
      replacementPreviewUrl: '',
      storagePath: '',
      previewUrl: originalPreview,
    }
  })
}

export function hasRevisionChanges(items = [], additionalRequirement = '') {
  const changedReplacement = items.some((item) =>
    ['主体', '场景', '元素'].includes(item?.group) && item?.changed === true
  )
  return changedReplacement || Boolean(String(additionalRequirement || '').trim())
}
