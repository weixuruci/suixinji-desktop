<template>
  <div class="app-frame" :class="theme">
    <!-- 自定义标题栏 -->
    <header class="title-bar">
      <div class="title-bar-drag">
        <span class="app-title">📖 随心记</span>
        <span v-if="currentProject" class="project-path">
          <span class="path-sep">/</span>
          {{ currentProject.name }}
        </span>
      </div>
      <div class="title-bar-controls">
        <button class="tb-btn" @click="minimize" title="最小化">─</button>
        <button class="tb-btn" @click="maximize" title="最大化">□</button>
        <button class="tb-btn tb-close" @click="close" title="关闭">✕</button>
      </div>
    </header>

    <!-- 主体 -->
    <div class="app-body">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useProjectStore } from './stores/project'
import { useSettingsStore } from './stores/settings'

const projectStore = useProjectStore()
const settingsStore = useSettingsStore()

const currentProject = computed(() => projectStore.currentProject)
const theme = computed(() => `theme-${settingsStore.theme}`)

onMounted(async () => {
  settingsStore.loadSettings()
  await projectStore.loadProjects()
})

function minimize() { window.electronAPI?.windowMinimize() }
function maximize() { window.electronAPI?.windowMaximize() }
function close()    { window.electronAPI?.windowClose() }
</script>

<style scoped>
.app-frame {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-deep);
}

/* ---- Title Bar ---- */
.title-bar {
  display: flex;
  align-items: center;
  height: 38px;
  min-height: 38px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  -webkit-app-region: drag;
  user-select: none;
}
.title-bar-drag {
  flex: 1;
  display: flex;
  align-items: center;
  padding-left: 14px;
  gap: 6px;
}
.app-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}
.project-path {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
}
.path-sep {
  color: var(--border);
  margin: 0 2px;
}

.title-bar-controls {
  display: flex;
  -webkit-app-region: no-drag;
}
.tb-btn {
  width: 44px;
  height: 38px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}
.tb-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.tb-close:hover {
  background: var(--error);
  color: #fff;
}

/* ---- Body ---- */
.app-body {
  flex: 1;
  overflow: hidden;
}

/* ---- Page Transitions ---- */
.page-enter-active {
  animation: slideIn 0.2s ease;
}
.page-leave-active {
  animation: fadeIn 0.15s ease reverse;
}
</style>
