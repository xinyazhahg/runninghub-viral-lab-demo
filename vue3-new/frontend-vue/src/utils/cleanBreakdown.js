const splitList = (value) => {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean)
  if (typeof value === 'string' && value.trim()) {
    return value.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean)
  }
  return []
}

const unique = (items) => Array.from(new Set(items.filter(Boolean)))
const includesAny = (value, words) => words.some((word) => value.includes(word))
const normalizeForCompare = (value) => String(value || '')
  .toLowerCase()
  .replace(/狗绳|宠物绳|牵狗绳/g, '牵引绳')
  .replace(/[\s的、小只个一]/g, '')

const WEAK_HUMAN_WORDS = [
  '拍摄者', '摄影者', '脚部', '人脚', '脚', '手部', '人手', '手', '手持视角',
  '第一视角', '人影', '影子', '路人', '背景人物', '局部身体', '腿部', '双腿',
]
const GENERIC_HUMAN_WORDS = ['人', '人物', '男性', '女性', '男人', '女人', '主人']
const RELATION_WORDS = [
  '情侣', '伴侣', '夫妻', '夫妇', '新人', '男女', '二人', '两人', '一对', '组合',
  '搭档', '同伴', '伙伴', '朋友', '恋人', '人群', '观众', '群众', '围观者',
]
const NON_HUMAN_CORE_WORDS = [
  '狗', '犬', '猫', '宠物', '商品', '产品', '食物', '食品', '饮料', '杯子', '手机',
  '玩具', '背包', '汽车', '车辆',
]
const PET_WORDS = ['狗', '犬', '猫', '宠物']
const PET_CONTEXT_WORDS = ['牵引绳', '狗绳', '户外小路', '石砖小路', '草地', '遛狗']
const FULL_HUMAN_EVIDENCE = [
  '完整人物', '人物完整', '完整出镜', '全身', '人物为主体', '人物主体', '人物居中',
  '人物在镜头中心', '人是镜头中心', '主角', '人物承担主要动作',
]
const SCENE_WORDS = [
  '路面', '铺设路面', '石砖地', '石板地', '石板路', '石砖路', '地砖', '砖面',
  '草地', '道路', '马路', '地面', '小路', '小径', '步道', '天空', '墙面', '墙',
  '背景', '场地', '室外', '户外',
  '室内', '房间', '街道', '公园', '广场', '庭院',
]
const LOW_VALUE_ELEMENT_WORDS = [
  ...SCENE_WORDS, '树叶', '树木', '花草', '光影', '光线', '阴影', '影子', '人脚',
  '脚部', '脚', '人手', '手部', '手', '腿部', '拍摄者', '摄影者', '人影', '路人',
  '背景人物', '局部身体', '镜头', '画面', '场景', '主体', '动作', '节奏',
]
const HIGH_VALUE_ELEMENT_WORDS = [
  '狗绳', '牵引绳', '项圈', '玩具', '背包', '饮料', '杯子', '手机', '商品', '产品',
  '食物', '食品', '道具', '球', '雨伞', '帽子', '眼镜', '包', '瓶', '餐具',
  '胸带', '胸背带', '狗背带', '胸背',
]
const PET_GEAR_WORDS = [
  '牵引绳', '狗绳', '宠物绳', '牵狗绳', '背带', '狗背带', '胸带', '胸背带',
  '胸背', '项圈',
]
const PATH_SCENE_WORDS = [
  '小路', '小径', '道路', '马路', '路面', '石板路', '石砖路', '铺设路面', '石砖地',
  '石板地', '地面', '步道', '地砖', '砖面',
]

function subjectFamily(value) {
  const text = String(value || '')
  if (includesAny(text, PET_GEAR_WORDS)) return ''
  if (/(狗|犬|泰迪|柯基|柴犬|金毛|拉布拉多|贵宾|比熊|博美|哈士奇)/.test(text)) {
    return 'canine-pet'
  }
  if (/(猫|猫咪|小猫)/.test(text)) return 'feline-pet'
  if (text.includes('宠物')) return 'pet'
  return ''
}

function duplicatesSubject(item, subjects) {
  if (includesAny(item, PET_GEAR_WORDS)) return false
  const itemFamily = subjectFamily(item)
  return subjects.some((subject) => {
    if (isSameConcept(item, subject)) return true
    const family = subjectFamily(subject)
    return Boolean(itemFamily && family
      && (itemFamily === family || itemFamily === 'pet' || family === 'pet'))
  })
}

function valuesFrom(data, keys) {
  const overview = data?.overview || {}
  for (const key of keys) {
    const values = splitList(overview[key])
    if (values.length) return values
  }
  for (const key of keys) {
    const values = splitList(data?.[key])
    if (values.length) return values
  }
  return []
}

function isSameConcept(left, right) {
  const a = normalizeForCompare(left)
  const b = normalizeForCompare(right)
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)))
}

function cleanSubjects(data, context) {
  const candidates = valuesFrom(data, ['replaceableSubjects', 'subjects'])
  const hasNonHumanCore = candidates.some((item) => includesAny(item, NON_HUMAN_CORE_WORDS))
    || includesAny(context, NON_HUMAN_CORE_WORDS)
  const isPetVideo = includesAny(context, PET_WORDS)
    && includesAny(context, PET_CONTEXT_WORDS)
  const hasFullHumanEvidence = includesAny(context, FULL_HUMAN_EVIDENCE)

  let cleaned = candidates.filter((item) => {
    if (includesAny(item, WEAK_HUMAN_WORDS) || includesAny(item, RELATION_WORDS)) return false
    const isHuman = GENERIC_HUMAN_WORDS.includes(item)
      || /^(一名|一位)?(男子|女子|男士|女士|人类)$/.test(item)
    if (isHuman && (hasNonHumanCore || isPetVideo) && !hasFullHumanEvidence) return false
    return true
  })

  if (isPetVideo) {
    const pet = cleaned.find((item) => includesAny(item, PET_WORDS))
      || candidates.find((item) => includesAny(item, PET_WORDS))
      || (context.includes('狗') ? '狗' : context.includes('猫') ? '猫' : '宠物')
    cleaned = [pet, ...cleaned.filter((item) => !includesAny(item, PET_WORDS))]
  }

  return unique(cleaned).slice(0, 2)
}

function cleanScenes(data) {
  const overviewScenes = valuesFrom(data, ['replaceableScenes', 'scenes'])
  const shotScenes = (Array.isArray(data?.shots) ? data.shots : [])
    .map((shot) => String(shot?.scene || '').trim())
    .filter((item) => item && !/^(未识别|暂无)$/.test(item))
  const normalized = [...overviewScenes, ...shotScenes].map((scene) => {
    if (includesAny(scene, PATH_SCENE_WORDS)) return '户外小路'
    return scene
  })
  const scenes = unique(normalized)
  if (scenes.includes('户外小路')) {
    const redundantPathContext = ['草地', '户外', '室外', '公园', '背景', '场地']
    return ['户外小路', ...scenes.filter((scene) =>
      scene !== '户外小路' && !redundantPathContext.includes(scene)
    )]
      .slice(0, 2)
  }
  return scenes.slice(0, 2)
}

function cleanElements(data, subjects, scenes) {
  const shots = Array.isArray(data?.shots) ? data.shots : []
  const candidates = unique([
    ...valuesFrom(data, ['replaceableElements', 'elements']),
    ...shots.flatMap((shot) => splitList(shot?.elements)),
    ...shots.flatMap((shot) => splitList(shot?.replaceable)),
  ])

  const cleaned = candidates.filter((item) => {
    if (includesAny(item, LOW_VALUE_ELEMENT_WORDS)) return false
    if (includesAny(item, WEAK_HUMAN_WORDS) || includesAny(item, GENERIC_HUMAN_WORDS)) return false
    if (duplicatesSubject(item, subjects)) return false
    if (scenes.some((scene) => isSameConcept(item, scene))) return false
    return true
  })

  const prioritized = cleaned
    .sort((a, b) => Number(includesAny(b, HIGH_VALUE_ELEMENT_WORDS)) - Number(includesAny(a, HIGH_VALUE_ELEMENT_WORDS)))
  return prioritized
    .filter((item, index) => prioritized.findIndex((other) => isSameConcept(item, other)) === index)
    .slice(0, 5)
}

export function cleanBreakdownResult(data) {
  if (!data || typeof data !== 'object') return data
  const overview = data.overview || {}
  const context = JSON.stringify(data)
  const subjects = cleanSubjects(data, context)
  const scenes = cleanScenes(data)
  const elements = cleanElements(data, subjects, scenes)

  return {
    ...data,
    overview: {
      ...overview,
      replaceableSubjects: subjects,
      replaceableScenes: scenes,
      replaceableElements: elements,
    },
  }
}
