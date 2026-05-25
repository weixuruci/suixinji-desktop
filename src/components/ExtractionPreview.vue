<template>
  <div class="extraction-preview">
    <div class="preview-overlay" @click.self="$emit('cancel')">
      <div class="preview-dialog">
        <h3>🔍 AI 提取预览</h3>
        <p class="hint">请检查以下提取结果，确认后写入知识库</p>

        <!-- 统计 -->
        <div class="preview-stats">
          <span v-for="(count, type) in preview.stats" :key="type" class="stat">
            {{ typeLabel(type) }}: {{ count }}
          </span>
        </div>

        <!-- 冲突警告 -->
        <div v-if="preview.conflicts?.length" class="conflicts-section">
          <div class="conflicts-header">⚠️ 检测到 {{ preview.conflicts.length }} 处潜在冲突</div>
          <div v-for="(c, i) in preview.conflicts" :key="i"
            class="conflict-item" :class="c.level">
            <span class="conflict-icon">{{ c.level === 'error' ? '🔴' : '🟡' }}</span>
            <span class="conflict-msg">{{ c.message }}</span>
          </div>
        </div>

        <!-- 按类型分组展示 -->
        <div v-for="(list, type) in preview.entities" :key="type" class="entity-group" v-show="list && list.length">
          <div class="group-header">{{ typeLabel(type) }} ({{ list.length }})</div>
          <div v-for="(entity, i) in list" :key="i" class="preview-item">
            <label class="preview-check">
              <input type="checkbox" v-model="entity._confirmed" />
            </label>
            <div class="preview-content">
              <div class="preview-name">{{ entity.name || entity.content || '(未命名)' }}</div>
              <div class="preview-detail">{{ formatDetail(entity) }}</div>
            </div>
            <button class="btn-remove" @click="list.splice(i, 1)">✕</button>
          </div>
        </div>

        <div v-if="!hasAnyEntities" class="empty-hint">
          未提取到任何实体
        </div>

        <div class="dialog-actions">
          <div class="actions-left">
            <button class="btn-ghost" @click="toggleAll(true)">✅ 全选</button>
            <button class="btn-ghost" @click="toggleAll(false)">⬜ 取消全选</button>
          </div>
          <div class="actions-right">
            <button class="btn-secondary" @click="$emit('cancel')">取消</button>
            <button class="btn-primary" @click="confirm">
              ✅ 确认写入 ({{ confirmedCount }})
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ENTITY_TYPE_NAMES, typeLabel } from '../constants/entities'

const props = defineProps({
  preview: { type: Object, required: true }
})
const emit = defineEmits(['confirm', 'cancel'])

const hasAnyEntities = computed(() => {
  if (!props.preview.entities) return false
  return ENTITY_TYPE_NAMES.some(t => props.preview.entities[t]?.length > 0)
})

const confirmedCount = computed(() => {
  let count = 0
  for (const t of ENTITY_TYPE_NAMES) {
    const list = props.preview.entities?.[t]
    if (list) count += list.filter(e => e._confirmed !== false).length
  }
  return count
})

function formatDetail(entity) {
  const parts = []
  if (entity.description) parts.push(entity.description)
  if (entity.category) parts.push(`[${entity.category}]`)
  if (entity.status) parts.push(`状态: ${entity.status}`)
  if (entity.level) parts.push(`境界: ${entity.level}`)
  if (entity.relation) parts.push(entity.relation)
  if (entity.result) parts.push(entity.result)
  return parts.join(' | ') || '-'
}

function confirm() {
  const confirmed = {}
  for (const t of ENTITY_TYPE_NAMES) {
    const list = props.preview.entities?.[t]
    if (list) {
      const filtered = list.filter(e => e._confirmed !== false).map(({ _confirmed, ...rest }) => rest)
      if (filtered.length > 0) confirmed[t] = filtered
    }
  }
  emit('confirm', confirmed)
}

function toggleAll(value) {
  for (const t of ENTITY_TYPE_NAMES) {
    const list = props.preview.entities?.[t]
    if (list) {
      for (const e of list) {
        e._confirmed = value
      }
    }
  }
}
</script>

<style scoped>
.preview-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100;
}
.preview-dialog {
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: var(--radius-xl); padding: 24px;
  width: 90%; max-width: 640px; max-height: 80vh; overflow-y: auto;
  box-shadow: var(--shadow-lg);
}
h3 { color: var(--text-primary); margin: 0 0 4px; font-size: var(--font-size-lg); }
.hint { color: var(--text-muted); font-size: var(--font-size-sm); margin: 0 0 16px; }
.preview-stats { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
.stat { font-size: var(--font-size-xs); color: var(--accent); background: var(--accent-subtle); padding: 4px 10px; border-radius: 99px; }
.preview-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px; background: var(--bg-card); border-radius: var(--radius-md); margin-bottom: 6px;
  border: 1px solid var(--border);
}
.preview-check { margin-top: 2px; }
.preview-content { flex: 1; }
.preview-type { font-size: var(--font-size-xs); color: var(--accent); }
.preview-name { font-weight: 600; color: var(--text-primary); font-size: var(--font-size-base); }
.preview-detail { font-size: var(--font-size-sm); color: var(--text-muted); margin-top: 2px; }
.btn-remove { background: none; border: none; color: var(--error); cursor: pointer; font-size: 14px; }
.entity-group { margin-bottom: 16px; }
.group-header { font-size: var(--font-size-base); font-weight: 600; color: var(--accent); margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid var(--border); }
.dialog-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }
.actions-left { display: flex; gap: 6px; }
.actions-right { display: flex; gap: 8px; }
.empty-hint { text-align: center; color: var(--text-muted); padding: 24px; font-size: var(--font-size-sm); }

/* 冲突 */
.conflicts-section { margin-bottom: 16px; }
.conflicts-header {
  font-size: var(--font-size-sm); font-weight: 600; color: var(--warning);
  padding: 8px 12px; background: rgba(245,158,11,.08);
  border: 1px solid rgba(245,158,11,.2); border-radius: var(--radius-md);
  margin-bottom: 6px;
}
.conflict-item {
  display: flex; align-items: flex-start; gap: 6px;
  padding: 6px 12px; font-size: var(--font-size-sm); border-radius: var(--radius-sm);
  margin-bottom: 3px;
}
.conflict-item.error { background: rgba(239,68,68,.06); color: var(--error); }
.conflict-item.warn { background: rgba(245,158,11,.06); color: var(--warning); }
.conflict-msg { flex: 1; line-height: 1.4; }
</style>
