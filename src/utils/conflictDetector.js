/**
 * 冲突检测 — 比较 AI 提取结果与已有知识库，标出矛盾
 */

/**
 * @param {Object} existingEntities - 知识库中已有的实体 { characters: [...], relationships: [...], ... }
 * @param {Object} extractedEntities - AI 刚提取的实体
 * @returns {Array} 冲突列表 [{ type, level, message, existing, incoming }]
 */
export function detectConflicts(existingEntities, extractedEntities) {
  const conflicts = []

  // 人物冲突：已死亡角色在新章节出场
  if (existingEntities.characters?.length && extractedEntities.characters?.length) {
    for (const existing of existingEntities.characters) {
      if (!existing.status) continue
      const isDead = existing.status.includes('死亡') || existing.status.includes('去世') ||
                     existing.status === 'dead' || existing.status === 'killed'
      if (!isDead) continue

      // 检查新提取结果中是否又出现了这个角色
      const reappeared = extractedEntities.characters.find(
        ch => ch.name === existing.name || (ch.name && existing.name && ch.name === existing.name)
      )
      if (reappeared && reappeared.status && !reappeared.status.includes('死亡') && reappeared.status !== 'dead') {
        conflicts.push({
          type: 'character',
          level: 'error',
          message: `「${existing.name}」此前已标记为「${existing.status}」，但新章节中似乎再次出场`,
          existing: { name: existing.name, status: existing.status },
          incoming: { name: reappeared.name, status: reappeared.status }
        })
      }
    }
  }

  // 关系冲突：关系类型大反转
  if (existingEntities.relationships?.length && extractedEntities.relationships?.length) {
    for (const existing of existingEntities.relationships) {
      const a = existing.personA || existing.from
      const b = existing.personB || existing.to
      const newRel = extractedEntities.relationships.find(r => {
        const na = r.personA || r.from, nb = r.personB || r.to
        return (na === a && nb === b) || (na === b && nb === a)
      })
      if (!newRel) continue

      const oldType = existing.relation || existing.type
      const newType = newRel.relation || newRel.type
      if (isRelationshipReversal(oldType, newType)) {
        conflicts.push({
          type: 'relationship',
          level: 'warn',
          message: `「${a}」与「${b}」的关系从「${oldType}」变为「${newType}」，请确认`,
          existing: { a, b, relation: oldType },
          incoming: { a, b, relation: newType }
        })
      }
    }
  }

  // 战力冲突：境界下降
  if (existingEntities.powerRankings?.length && extractedEntities.powerRankings?.length) {
    for (const existing of existingEntities.powerRankings) {
      const newPower = extractedEntities.powerRankings.find(p => p.name === existing.name)
      if (!newPower || !newPower.level) continue
      if (isPowerDrop(existing.level, newPower.level)) {
        conflicts.push({
          type: 'power',
          level: 'warn',
          message: `「${existing.name}」的境界从「${existing.level}」变为「${newPower.level}」，是否境界回落？`,
          existing: { name: existing.name, level: existing.level },
          incoming: { name: newPower.name, level: newPower.level }
        })
      }
    }
  }

  // 伏笔冲突：已收伏笔重新出现
  if (existingEntities.foreshadows?.length && extractedEntities.foreshadows?.length) {
    for (const existing of existingEntities.foreshadows) {
      if (existing.status !== '已收' && existing.status !== 'resolved') continue
      const reappeared = extractedEntities.foreshadows.find(f =>
        f.content && existing.content && f.content === existing.content
      )
      if (reappeared) {
        conflicts.push({
          type: 'foreshadow',
          level: 'warn',
          message: `伏笔「${existing.content?.slice(0, 30)}...」此前已标记为已收，但新章节再次提及`,
          existing: { content: existing.content, status: existing.status },
          incoming: { content: reappeared.content }
        })
      }
    }
  }

  return conflicts
}

/** 判断关系是否发生大反转（如恋人→敌对、师徒→敌人） */
function isRelationshipReversal(oldType, newType) {
  const reversals = [
    ['恋人', '敌对'], ['师徒', '敌对'], ['朋友', '敌对'],
    ['同门', '敌对'], ['亲人', '敌对'], ['恋人', '朋友'],
    ['师徒', '朋友']
  ]
  return reversals.some(([a, b]) =>
    (oldType.includes(a) && newType.includes(b)) ||
    (oldType.includes(b) && newType.includes(a))
  )
}

/** 判断境界是否下降 */
function isPowerDrop(oldLevel, newLevel) {
  const order = ['凡人','练气','筑基','金丹','元婴','化神','渡劫','大乘']
  const oi = order.findIndex(l => oldLevel.includes(l))
  const ni = order.findIndex(l => newLevel.includes(l))
  return oi >= 0 && ni >= 0 && ni < oi
}
