<template>
  <div v-if="visible" class="dialog-overlay" @click.self="cancel">
    <div class="dialog">
      <h3>{{ title }}</h3>
      <p class="dialog-desc" v-if="message">{{ message }}</p>
      <div class="dialog-actions">
        <button class="btn-secondary" @click="cancel">{{ cancelText }}</button>
        <button class="btn-primary" :class="{ 'btn-danger': danger }" @click="ok">
          {{ okText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '确认操作' },
  message: { type: String, default: '' },
  danger: { type: Boolean, default: false },
  okText: { type: String, default: '确定' },
  cancelText: { type: String, default: '取消' }
})

const emit = defineEmits(['ok', 'cancel', 'update:show'])

const visible = ref(false)

watch(() => props.show, v => { visible.value = v })

function ok() {
  visible.value = false
  emit('update:show', false)
  emit('ok')
}

function cancel() {
  visible.value = false
  emit('update:show', false)
  emit('cancel')
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
  animation: fadeIn 0.15s ease;
}
.dialog {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px;
  width: 90%;
  max-width: 420px;
  box-shadow: var(--shadow-lg);
  animation: slideUp 0.2s ease;
}
h3 {
  color: var(--text-primary);
  margin: 0 0 8px;
  font-size: var(--font-size-lg);
}
.dialog-desc {
  color: var(--text-muted);
  font-size: var(--font-size-sm);
  margin: 0 0 20px;
  line-height: 1.6;
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.btn-danger {
  background: var(--error) !important;
  border-color: var(--error) !important;
  color: #fff !important;
}
</style>
