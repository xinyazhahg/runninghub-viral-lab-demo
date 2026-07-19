export const REFERENCE_PURPOSE_OPTIONS = [
  { value: 'character_reference', label: '主体参考' },
  { value: 'scene_reference', label: '场景参考' },
  { value: 'prop_reference', label: '元素/道具' },
  { value: 'style_reference', label: '风格参考' },
  { value: 'action_reference', label: '动作参考' },
  { value: 'audio_reference', label: '音频参考' },
  { value: 'general_reference', label: '通用参考' },
]

const GROUP_PURPOSE = {
  主体: 'character_reference',
  场景: 'scene_reference',
  元素: 'prop_reference',
}

const KEYWORDS = {
  character_reference: /人物|角色|主体|肖像|人像|模特|男人|女人|男孩|女孩|动物|宠物|猫|狗|person|portrait|character|face|model|man|woman|boy|girl|animal|pet|cat|dog/i,
  scene_reference: /场景|背景|环境|房间|街道|室内|室外|风景|厨房|scene|background|environment|room|street|indoor|outdoor|landscape|kitchen/i,
  prop_reference: /商品|产品|物品|元素|道具|包|鞋|杯|手机|蛋糕|桌子|product|object|item|prop|bag|shoe|cup|phone|cake|table/i,
  style_reference: /风格|画风|色调|光影|氛围|style|mood|palette|lighting|look/i,
}

function searchablePlaceholderText(item = {}) {
  return [item.original, item.current, item.replacement, item.title]
    .filter(Boolean).join(' ').toLowerCase()
}

function firstPlaceholder(placeholders, group) {
  return placeholders.find((item) => item.group === group) || null
}

export function inferReferenceBinding({ type, fileName = '', placeholders = [] } = {}) {
  if (type === 'audio') return { purpose: 'audio_reference', targetPlaceholderId: '', confidence: 0.99 }
  if (type === 'video') {
    const subject = firstPlaceholder(placeholders, '主体')
    return { purpose: 'action_reference', targetPlaceholderId: subject?.id || '', confidence: subject ? 0.82 : 0.76 }
  }

  const normalizedName = String(fileName || '').toLowerCase()
  const directMatch = placeholders.find((item) => {
    const values = searchablePlaceholderText(item).split(/\s+/).filter((value) => value.length >= 2)
    return values.some((value) => normalizedName.includes(value))
  })
  if (directMatch && GROUP_PURPOSE[directMatch.group]) {
    return { purpose: GROUP_PURPOSE[directMatch.group], targetPlaceholderId: directMatch.id || '', confidence: 0.94 }
  }

  for (const [purpose, pattern] of Object.entries(KEYWORDS)) {
    if (!pattern.test(normalizedName)) continue
    const group = { character_reference: '主体', scene_reference: '场景', prop_reference: '元素' }[purpose]
    const placeholder = group ? firstPlaceholder(placeholders, group) : null
    return { purpose, targetPlaceholderId: placeholder?.id || '', confidence: placeholder ? 0.84 : 0.72 }
  }

  const changedPlaceholders = placeholders.filter((item) => item.changed && GROUP_PURPOSE[item.group])
  if (changedPlaceholders.length === 1) {
    const placeholder = changedPlaceholders[0]
    return { purpose: GROUP_PURPOSE[placeholder.group], targetPlaceholderId: placeholder.id || '', confidence: 0.64 }
  }
  return { purpose: 'general_reference', targetPlaceholderId: '', confidence: 0.35 }
}

export function purposeLabel(purpose) {
  return REFERENCE_PURPOSE_OPTIONS.find((item) => item.value === purpose)?.label || '通用参考'
}
