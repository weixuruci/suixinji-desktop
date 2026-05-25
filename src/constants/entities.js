/**
 * 实体类型统一定义 — 单一数据源
 * 所有组件和 store 都从这里引用，新增实体类型只需改这里
 */

export const ENTITY_TYPES = [
  { type: 'characters',      label: '人物', icon: '👤',  summaryField: 'description',  tagFields: ['status', 'firstAppear'] },
  { type: 'settings',        label: '设定', icon: '⚔️',  summaryField: 'description',  tagFields: ['category'] },
  { type: 'powerSystem',     label: '修炼体系', icon: '⬆️', summaryField: 'description', tagFields: [] },
  { type: 'relationships',   label: '关系', icon: '🔗',  summaryField: 'relation',     tagFields: ['relation'] },
  { type: 'foreshadows',     label: '伏笔', icon: '🎯',  summaryField: 'content',      tagFields: ['status'] },
  { type: 'events',          label: '事件', icon: '📍',  summaryField: 'result',       tagFields: [] },
  { type: 'items',           label: '物品', icon: '🗡️',  summaryField: 'description',  tagFields: ['type', 'owner'] },
  { type: 'powerRankings',   label: '战力', icon: '💪',  summaryField: 'level',        tagFields: ['level'] },
  { type: 'chapterSummaries',label: '摘要', icon: '📋',  summaryField: 'summary',      tagFields: ['chapter', 'chapterNumber'] },
  { type: 'writingNotes',    label: '写作笔记', icon: '📝', summaryField: 'content',    tagFields: ['category'] }
]

/** 纯类型名数组，方便迭代 */
export const ENTITY_TYPE_NAMES = ENTITY_TYPES.map(t => t.type)

/** 类型名 → 标签（含图标） */
export const ENTITY_TYPE_LABEL_MAP = Object.fromEntries(
  ENTITY_TYPES.map(t => [t.type, `${t.icon} ${t.label}`])
)

/** 类型名 → 纯中文标签 */
export const ENTITY_TYPE_PLAIN_MAP = Object.fromEntries(
  ENTITY_TYPES.map(t => [t.type, t.label])
)

/** 实体类型名 → 可搜索字段列表（用于搜索优化，替代 JSON.stringify） */
export const ENTITY_SEARCH_FIELDS = {
  characters:      ['name', 'description', 'status', 'aliases', 'firstAppear'],
  settings:        ['name', 'description', 'category'],
  relationships:   ['personA', 'personB', 'relation'],
  foreshadows:     ['content', 'status', 'plantedAt'],
  events:          ['name', 'time', 'location', 'result'],
  items:           ['name', 'type', 'owner', 'description'],
  powerRankings:   ['name', 'level', 'power', 'source'],
  powerSystem:     ['name', 'description'],
  chapterSummaries:['title', 'summary'],
  writingNotes:    ['title', 'content', 'category']
}

/** 创建空的 entities 对象 */
export function createEmptyEntities() {
  const obj = {}
  for (const t of ENTITY_TYPES) obj[t.type] = []
  return obj
}

/** 计算总实体数 */
export function countEntities(entities) {
  if (!entities) return 0
  let n = 0
  for (const t of ENTITY_TYPES) n += (entities[t.type]?.length || 0)
  return n
}

/** 类型名 → 图标+标签 */
export function typeLabel(type) {
  return ENTITY_TYPE_LABEL_MAP[type] || type
}

/** 类型名 → 纯标签 */
export function typePlain(type) {
  return ENTITY_TYPE_PLAIN_MAP[type] || type
}

/** 对实体生成可搜索文本（替代 JSON.stringify） */
export function buildSearchText(entity, type) {
  const fields = ENTITY_SEARCH_FIELDS[type]
  if (!fields) return ''
  return fields.map(f => entity[f]).filter(Boolean).join(' ').toLowerCase()
}

/** 获取实体摘要文本 */
export function getEntitySummary(entity, type) {
  if (!entity) return ''
  switch (type) {
    case 'characters': return entity.description || entity.status || ''
    case 'settings': return entity.description || entity.category || ''
    case 'relationships': return `${entity.personA || '?'} → ${entity.personB || '?'} ${entity.relation || ''}`
    case 'foreshadows': return entity.content || ''
    case 'events': return entity.result || entity.location || ''
    case 'items': return `${entity.type ? '[' + entity.type + '] ' : ''}${entity.owner ? '持有者: ' + entity.owner : ''}`
    case 'powerRankings': return entity.level || entity.power || ''
    case 'powerSystem': return entity.description || entity.name || ''
    case 'chapterSummaries': return entity.summary || ''
    case 'writingNotes': return entity.content?.slice(0, 100) || entity.title || ''
    default: return ''
  }
}

/** 获取实体标签 */
export function getEntityTags(entity) {
  if (!entity) return []
  const tags = []
  if (entity.status) tags.push(entity.status)
  if (entity.category) tags.push(entity.category)
  if (entity.type) tags.push(entity.type)
  if (entity.relation) tags.push(entity.relation)
  if (entity.level) tags.push(entity.level)
  if (entity.chapter || entity.chapterNumber) tags.push(`第${entity.chapter || entity.chapterNumber}章`)
  if (entity.firstAppear) tags.push(`出场: ${entity.firstAppear}`)
  return tags
}
