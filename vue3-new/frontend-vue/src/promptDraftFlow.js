export const EMPTY_PROMPT_DRAFT = Object.freeze({
  status: 'idle',
  automaticPrompt: '',
  finalPrompt: '',
  promptSource: 'system_generated',
  editedAt: null,
  fingerprint: '',
  mappings: [],
  creativePlan: null,
  warnings: [],
  source: null,
})

export function createEmptyPromptDraft() {
  return { ...EMPTY_PROMPT_DRAFT, mappings: [], warnings: [] }
}

export function promptInputFingerprint({ replacements = [], extraPrompt = '', ratio = '' } = {}) {
  const assets = replacements.map((item) => ({
    assetId: item.assetId || item.asset_id || '',
    url: item.url || item.assetUrl || '',
    group: item.group || '',
    name: item.name || item.replacement || '',
  }))
  return JSON.stringify({ assets, extraPrompt: String(extraPrompt).trim(), ratio })
}

export function stripPromptGenerationConfig(value) {
  const lines = String(value || '').split(/\r?\n/)
  const kept = []
  let insideConfig = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '【生成配置】') {
      insideConfig = true
      continue
    }
    if (insideConfig && /^(比例|清晰度|生成模型|生成时长)：/.test(trimmed)) continue
    if (insideConfig && !trimmed) continue
    insideConfig = false
    kept.push(line)
  }
  return kept.join('\n').trim()
}

export function applyGeneratedPrompt(state, payload, fingerprint) {
  const automaticPrompt = stripPromptGenerationConfig(payload?.automaticPrompt || payload?.finalPrompt || payload?.prompt)
  const finalPrompt = stripPromptGenerationConfig(payload?.finalPrompt || payload?.prompt)
  return {
    ...state,
    status: 'draft',
    automaticPrompt,
    finalPrompt,
    promptSource: 'system_generated',
    editedAt: null,
    fingerprint,
    mappings: Array.isArray(payload?.mappings) ? payload.mappings : [],
    creativePlan: payload?.creativePlan && typeof payload.creativePlan === 'object' ? payload.creativePlan : null,
    warnings: Array.isArray(payload?.warnings) ? payload.warnings : [],
    source: payload?.source && typeof payload.source === 'object' ? payload.source : null,
  }
}

export function editPromptDraft(state, value, now = new Date().toISOString()) {
  const finalPrompt = stripPromptGenerationConfig(value)
  if (state.status === 'stale') return { ...state, finalPrompt, promptSource: 'user_edited', editedAt: now }
  return { ...state, status: 'edited', finalPrompt, promptSource: 'user_edited', editedAt: now }
}

export function markPromptDraftStale(state) {
  if (!['draft', 'edited', 'confirmed'].includes(state.status)) return state
  return { ...state, status: 'stale' }
}

export function confirmPromptDraft(state) {
  return { ...state, status: 'confirmed' }
}

export function validatePromptDraft({ state, currentFingerprint, replacementCount }) {
  if (!String(state?.finalPrompt || '').trim()) return '请先生成并确认创作方案。'
  if (state.status === 'stale' || state.fingerprint !== currentFingerprint) return '素材或生成配置已变化，请重新生成创作方案。'
  const references = [...new Set(String(state.finalPrompt).match(/@图片\d+/g) || [])]
  const expected = Array.from({ length: Number(replacementCount) || 0 }, (_, index) => `@图片${index + 1}`)
  if (JSON.stringify(references.sort()) !== JSON.stringify(expected.sort())) {
    return '创作方案中的素材映射与当前替换图片不一致，请重新生成。'
  }
  return ''
}
