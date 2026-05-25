<template>
  <div class="home">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <!-- 品牌区 -->
      <div class="brand">
        <div class="brand-icon">📖</div>
        <div class="brand-text">
          <h1>随心记</h1>
          <span class="brand-sub">网文写手第二大脑</span>
        </div>
      </div>

      <!-- 新建按钮 -->
      <button class="btn-new-project" @click="showCreateDialog = true">
        <span class="plus">+</span> 新建作品
      </button>

      <!-- 作品列表 -->
      <div class="project-section">
        <div class="section-label">我的作品 <span class="count">{{ projects.length }}</span></div>
        <div class="project-list" @click="closeContextMenu">
          <div v-for="proj in projects" :key="proj.id"
            class="project-card" :class="{ active: proj.id === currentProjectId }"
            @click="openProject(proj.id)"
            @contextmenu.prevent.stop="openContextMenu($event, proj)"
          >
            <div class="project-icon">{{ proj.name?.charAt(0) || '📄' }}</div>
            <div class="project-info">
              <div class="project-name">{{ proj.name }}</div>
              <div class="project-desc" v-if="proj.description">{{ proj.description }}</div>
              <div class="project-meta">
                <span class="meta-item">{{ proj.chapters?.length || 0 }}章</span>
                <span class="meta-item">{{ entityCount(proj) }}个实体</span>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="!projects.length" class="empty-projects">
            <div class="empty-icon">✨</div>
            <p>还没有作品</p>
            <p class="empty-hint">点击上方按钮创建第一部作品</p>
          </div>
        </div>
      </div>

      <!-- 底部 -->
      <div class="sidebar-footer">
        <button class="btn-footer" @click="$router.push('/settings')">
          ⚙️ 设置
        </button>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content" @click="closeContextMenu">
      <router-view />
    </main>

    <!-- 右键菜单（组件） -->
    <ContextMenu
      :show="contextMenu.show"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :title="contextMenu.project?.name"
      :items="ctxItems"
      @action="ctxAction"
      @close="contextMenu.show = false"
    />

    <!-- 确认对话框 -->
    <ConfirmDialog
      v-model:show="confirmDialog.show"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :danger="confirmDialog.danger"
      :ok-text="confirmDialog.okText || '确定'"
      @ok="confirmDialog.onOk"
    />

    <!-- 重命名对话框 -->
    <div v-if="renameDialog.show" class="dialog-overlay" @click.self="renameDialog.show = false">
      <div class="dialog">
        <h3>✏️ 重命名</h3>
        <input v-model="renameDialog.name" placeholder="新名称" @keyup.enter="doRename" autofocus />
        <div class="dialog-actions">
          <button class="btn-secondary" @click="renameDialog.show = false">取消</button>
          <button class="btn-primary" @click="doRename">确定</button>
        </div>
      </div>
    </div>

    <!-- 新建作品对话框 -->
    <div v-if="showCreateDialog" class="dialog-overlay" @click.self="showCreateDialog = false">
      <div class="dialog">
        <h3>✏️ 新建作品</h3>
        <p class="dialog-desc">开始记录你的故事世界</p>
        <input
          ref="nameInput"
          v-model="newProjectName"
          placeholder="作品名称（必填）"
          @keyup.enter="createProject"
          autofocus
        />
        <textarea
          v-model="newProjectDesc"
          placeholder="简介（可选，一两句话描述故事）"
          rows="2"
        ></textarea>
        <div class="dialog-actions">
          <button class="btn-secondary" @click="showCreateDialog = false">取消</button>
          <button class="btn-primary" @click="createProject" :disabled="!newProjectName.trim()">创建作品</button>
        </div>
      </div>
    </div>

    <!-- 确认弹窗组件 -->
    <ConfirmDialog
      :show="confirmDialog.show"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :danger="confirmDialog.danger"
      @ok="confirmDialog.onOk"
      @cancel="confirmDialog.show = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, reactive, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '../stores/project'
import { countEntities, createEmptyEntities } from '../constants/entities'
import ContextMenu from '../components/ContextMenu.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const router = useRouter()
const projectStore = useProjectStore()

const projects = computed(() => projectStore.projects)
const currentProjectId = computed(() => projectStore.currentProjectId)

const showCreateDialog = ref(false)
const newProjectName = ref('')
const newProjectDesc = ref('')
const nameInput = ref(null)

// ---- 右键菜单 ----
const contextMenu = reactive({ show: false, x: 0, y: 0, project: null })

const ctxItems = [
  { label: '重命名', icon: '✏️', action: 'rename' },
  { label: '复制作品', icon: '📋', action: 'duplicate' },
  { label: '清空知识库', icon: '🧹', action: 'clearEntities' },
  { label: '清空章节', icon: '🗑️', action: 'clearChapters' },
  { label: '删除作品', icon: '❌', action: 'delete', danger: true }
]

function openContextMenu(e, proj) {
  contextMenu.x = e.clientX
  contextMenu.y = e.clientY
  contextMenu.project = proj
  contextMenu.show = true
}

function closeContextMenu() { contextMenu.show = false }

// ---- 确认对话框 ----
const confirmDialog = reactive({ show: false, title: '', message: '', danger: false, okText: '确定', onOk: () => {} })

function showConfirm(title, message, onOk, { danger = false, okText = '确定' } = {}) {
  confirmDialog.title = title
  confirmDialog.message = message
  confirmDialog.danger = danger
  confirmDialog.okText = okText
  confirmDialog.onOk = onOk
  confirmDialog.show = true
}

function ctxAction(action) {
  const proj = contextMenu.project
  if (!proj) return
  contextMenu.show = false

  switch (action) {
    case 'rename':
      renameDialog.project = proj
      renameDialog.name = proj.name
      renameDialog.show = true
      nextTick(() => {
        const input = document.querySelector('.dialog-overlay input')
        input?.focus()
        input?.select()
      })
      break
    case 'duplicate':
      duplicateProject(proj)
      break
    case 'clearEntities':
      showConfirm('清空知识库', `确定清空「${proj.name}」的知识库吗？所有人物、设定、伏笔等实体将被删除。`,
        () => clearEntities(proj), { danger: true })
      break
    case 'clearChapters':
      showConfirm('清空章节', `确定清空「${proj.name}」的所有章节吗？`,
        () => clearChapters(proj), { danger: true })
      break
    case 'delete':
      showConfirm('删除作品', `确定删除作品「${proj.name}」吗？此操作不可恢复。`,
        () => projectStore.deleteProject(proj.id), { danger: true, okText: '删除' })
      break
  }
}

// ---- 重命名 ----
const renameDialog = reactive({ show: false, project: null, name: '' })

async function doRename() {
  if (!renameDialog.name.trim() || !renameDialog.project) return
  await projectStore.updateProject(renameDialog.project.id, { name: renameDialog.name.trim() })
  renameDialog.show = false
}

// ---- 复制 ----
async function duplicateProject(proj) {
  const copy = await projectStore.createProject({
    name: `${proj.name} (副本)`,
    description: proj.description
  })
  // 浅拷贝章节和实体
  if (proj.chapters?.length || Object.values(proj.entities || {}).some(a => a.length)) {
    await projectStore.updateProject(copy.id, {
      chapters: JSON.parse(JSON.stringify(proj.chapters || [])),
      entities: JSON.parse(JSON.stringify(proj.entities || {}))
    })
  }
}

// ---- 清空 ----
async function clearEntities(proj) {
  await projectStore.updateProject(proj.id, { entities: createEmptyEntities() })
}

async function clearChapters(proj) {
  await projectStore.updateProject(proj.id, { chapters: [] })
}

// ---- 其他 ----
function entityCount(proj) {
  return countEntities(proj.entities)
}

function openProject(id) {
  projectStore.setCurrentProject(id)
  router.push(`/project/${id}`)
}

async function createProject() {
  if (!newProjectName.value.trim()) return
  const proj = await projectStore.createProject({
    name: newProjectName.value.trim(),
    description: newProjectDesc.value.trim()
  })
  showCreateDialog.value = false
  newProjectName.value = ''
  newProjectDesc.value = ''
  router.push(`/project/${proj.id}`)
}

// 全局点击关闭右键菜单
function onGlobalClick() { closeContextMenu() }
onMounted(() => document.addEventListener('click', onGlobalClick))
onUnmounted(() => document.removeEventListener('click', onGlobalClick))
</script>

<style scoped>
.home { display: flex; height: 100%; }

/* ---- Sidebar ---- */
.sidebar {
  width: 280px; min-width: 280px;
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
  user-select: none;
}
.brand { display: flex; align-items: center; gap: 12px; padding: 20px 18px 12px; }
.brand-icon {
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--accent), #a78bfa);
  border-radius: 12px; font-size: 20px;
  box-shadow: 0 2px 8px var(--accent-glow);
}
.brand-text h1 { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0; line-height: 1.2; }
.brand-sub { font-size: var(--font-size-xs); color: var(--text-muted); }

.btn-new-project {
  margin: 0 14px 8px; padding: 10px 16px;
  background: var(--accent-subtle); color: var(--accent);
  border: 1px dashed var(--accent); border-radius: var(--radius-md);
  font-size: var(--font-size-base); font-weight: 500; cursor: pointer;
  transition: all var(--transition-fast);
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
.btn-new-project:hover { background: var(--accent); color: var(--text-inverse); border-style: solid; }
.btn-new-project .plus { font-size: 18px; font-weight: 300; }

.project-section { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.section-label {
  padding: 8px 18px 6px; font-size: var(--font-size-xs); font-weight: 600;
  color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;
  display: flex; justify-content: space-between;
}
.section-label .count { color: var(--text-secondary); }
.project-list { flex: 1; overflow-y: auto; padding: 4px 10px; }

.project-card {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px; border-radius: var(--radius-md);
  cursor: pointer; transition: all var(--transition-fast);
  margin-bottom: 2px; position: relative;
}
.project-card:hover { background: var(--bg-hover); }
.project-card.active { background: var(--bg-active); }
.project-card.active::before {
  content: ''; position: absolute; left: -8px; top: 50%;
  transform: translateY(-50%); width: 3px; height: 24px;
  background: var(--accent); border-radius: 0 2px 2px 0;
}
.project-icon {
  width: 36px; height: 36px; min-width: 36px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-card); border-radius: 10px;
  font-size: 16px; font-weight: 600; color: var(--accent);
}
.project-card.active .project-icon { background: var(--accent-subtle); }
.project-info { flex: 1; min-width: 0; }
.project-name {
  font-size: var(--font-size-base); font-weight: 600;
  color: var(--text-primary); overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
.project-desc {
  font-size: var(--font-size-sm); color: var(--text-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px;
}
.project-meta { display: flex; gap: 10px; margin-top: 6px; }
.meta-item { font-size: var(--font-size-xs); color: var(--text-muted); }

.empty-projects { text-align: center; padding: 40px 16px; }
.empty-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.6; }
.empty-projects p { font-size: var(--font-size-base); color: var(--text-secondary); margin-bottom: 4px; }
.empty-hint { font-size: var(--font-size-sm) !important; color: var(--text-muted) !important; }

.sidebar-footer { padding: 10px 14px; border-top: 1px solid var(--border); }
.btn-footer {
  width: 100%; padding: 8px; background: transparent; color: var(--text-secondary);
  border: none; border-radius: var(--radius-md); font-size: var(--font-size-base);
  cursor: pointer; transition: all var(--transition-fast);
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
.btn-footer:hover { background: var(--bg-hover); color: var(--text-primary); }

.main-content { flex: 1; overflow: hidden; background: var(--bg-deep); }
</style>
