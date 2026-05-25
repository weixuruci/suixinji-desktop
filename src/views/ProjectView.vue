<template>
  <div class="project-view">
    <!-- Tab 导航 -->
    <nav class="tab-bar">
      <router-link :to="`/project/${projectId}/upload`" class="tab">
        <span class="tab-icon">📤</span>
        <span class="tab-label">上传章节</span>
      </router-link>
      <router-link :to="`/project/${projectId}`" class="tab" exact>
        <span class="tab-icon">📖</span>
        <span class="tab-label">知识库</span>
      </router-link>
      <router-link :to="`/project/${projectId}/chapters`" class="tab">
        <span class="tab-icon">📜</span>
        <span class="tab-label">章节</span>
      </router-link>
      <router-link :to="`/project/${projectId}/query`" class="tab">
        <span class="tab-icon">💬</span>
        <span class="tab-label">智能提问</span>
      </router-link>
      <router-link :to="`/project/${projectId}/graph`" class="tab">
        <span class="tab-icon">🕸️</span>
        <span class="tab-label">图谱</span>
      </router-link>
      <router-link :to="`/project/${projectId}/continue`" class="tab">
        <span class="tab-icon">✍️</span>
        <span class="tab-label">AI续写</span>
      </router-link>
      <router-link :to="`/project/${projectId}/tools`" class="tab">
        <span class="tab-icon">🛠️</span>
        <span class="tab-label">写作辅助</span>
      </router-link>

      <div class="tab-bar-right">
        <span class="project-badge">{{ currentProject?.chapters?.length || 0 }}章</span>
      </div>
    </nav>

    <!-- 内容区 -->
    <div class="tab-content">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useProjectStore } from '../stores/project'

const route = useRoute()
const projectStore = useProjectStore()
const projectId = computed(() => route.params.id)
const currentProject = computed(() => projectStore.currentProject)

onMounted(() => {
  if (projectId.value) projectStore.setCurrentProject(projectId.value)
})
</script>

<style scoped>
.project-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Tab bar */
.tab-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  padding: 6px 14px;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  color: var(--text-muted);
  text-decoration: none;
  font-size: var(--font-size-sm);
  font-weight: 500;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  position: relative;
}
.tab:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
  transform: translateY(-1px);
}
.tab.router-link-active {
  color: var(--accent);
  background: var(--accent-subtle);
  box-shadow: 0 1px 8px var(--accent-subtle);
}
.tab-icon { font-size: 15px; }

.tab-bar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
}
.project-badge {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
  background: var(--bg-card);
  padding: 4px 10px;
  border-radius: 99px;
  border: 1px solid var(--border);
}

.tab-content {
  flex: 1;
  overflow: hidden;
}
</style>
