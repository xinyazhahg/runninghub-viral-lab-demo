const REFERENCE_ACCEPT = {
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*',
}

const EXTENSION_TYPES = {
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image', gif: 'image', avif: 'image', heic: 'image', heif: 'image', bmp: 'image',
  mp4: 'video', mov: 'video', webm: 'video', m4v: 'video', avi: 'video', mkv: 'video',
  mp3: 'audio', wav: 'audio', m4a: 'audio', aac: 'audio', ogg: 'audio', flac: 'audio',
}

const GENERIC_MIME_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream', 'application/mp4'])

export function referenceAcceptFor(type) {
  return REFERENCE_ACCEPT[type] || ''
}

export function detectReferenceFileType(file = {}) {
  const mimeType = String(file.type || '').split(';')[0].trim().toLowerCase()
  for (const type of Object.keys(REFERENCE_ACCEPT)) {
    if (mimeType.startsWith(`${type}/`)) return type
  }
  if (!GENERIC_MIME_TYPES.has(mimeType)) return ''
  const extension = String(file.name || '').toLowerCase().match(/\.([^.]+)$/)?.[1] || ''
  return EXTENSION_TYPES[extension] || ''
}

export function validateReferenceFileType(expectedType, file) {
  const actualType = detectReferenceFileType(file)
  return {
    ok: Boolean(expectedType && actualType === expectedType),
    expectedType,
    actualType,
    mimeType: String(file?.type || '').split(';')[0].trim().toLowerCase(),
  }
}
