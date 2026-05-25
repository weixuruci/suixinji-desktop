<template>
  <div v-if="show" class="context-menu" :style="menuStyle" @click.stop>
    <div v-if="title" class="ctx-header">{{ title }}</div>
    <div v-if="title" class="ctx-divider"></div>
    <button
      v-for="item in items"
      :key="item.label"
      class="ctx-item"
      :class="{ 'ctx-danger': item.danger }"
      :disabled="item.disabled"
      @click="onClick(item)"
    >
      <span v-if="item.icon" class="ctx-icon">{{ item.icon }}</span>
      {{ item.label }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  show: { type: Boolean, required: true },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  title: { type: String, default: '' },
  items: { type: Array, default: () => [] }
  // items: [{ label, icon?, danger?, action }]
})

const emit = defineEmits(['action', 'close'])

const menuStyle = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`
}))

function onClick(item) {
  emit('action', item.action)
}
</script>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 200;
  min-width: 160px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 6px;
  animation: fadeIn 0.12s ease;
}
.ctx-header {
  padding: 6px 12px 4px;
  font-size: var(--font-size-xs);
  color: var(--text-muted);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ctx-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}
.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
}
.ctx-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.ctx-item:disabled {
  opacity: 0.4;
  cursor: default;
}
.ctx-danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error);
}
.ctx-icon {
  font-size: 14px;
  width: 18px;
  text-align: center;
}
</style>
