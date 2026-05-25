<template>
  <div class="chapters-view">
    <div class="ch-header">
      <h2>📜 章节</h2>
      <span class="ch-count" v-if="chapters.length">{{ chapters.length }} 章 · {{ unanalyzedCount }} 未分析</span>
    </div>

    <div v-if="!chapters.length" class="empty-state">
      <div class="icon">📝</div>
      <div class="title">还没有章节</div>
      <div class="desc">在「上传章节」页面上传 .txt / .md 文件。</div>
    </div>

    <div v-else class="ch-layout" @click="closeContextMenu">
      <div class="ch-list">
        <div v-for="(ch, idx) in chapters" :key="ch.number + '_' + idx"
          class="ch-list-item"
          :class="{ active: isActive(ch), analyzing: analyzingId === ch.number + '|' + ch.title }"
          @click="activeChapter = ch"
          @contextmenu.prevent.stop="openContextMenu($event, ch, idx)">
          <span class="ch-num">{{ ch.number }}</span>
          <span class="ch-title">{{ ch.title }}</span>
          <span class="ch-badge" :class="ch.analyzed ? 'done' : ''">
            <template v-if="analyzingId === ch.number + '|' + ch.title">⏳</template>
            <template v-else>{{ ch.analyzed ? '✓' : '未分析' }}</template>
          </span>
          <span class="ch-date">{{ formatDate(ch.uploadedAt) }}</span>
        </div>
      </div>

      <div class="ch-reader" v-if="activeChapter">
        <div class="reader-header">
          <h3>{{ activeChapter.title }}</h3>
          <span class="reader-meta">
            第{{ activeChapter.number }}章 · {{ wordCount(activeChapter) }}字 ·
            <span :class="activeChapter.analyzed ? 'ok' : 'warn'">
              {{ activeChapter.analyzed ? '✓ 已分析' : '⚠ 未分析' }}
            </span>
            <button class="btn-copy" @click="copyChapter" title="复制全文">📋 复制</button>
          </span>
        </div>
        <div class="reader-body" v-html="renderContent(activeChapter.content || '(无内容)')"></div>
      </div>
      <div v-else class="ch-reader ch-reader-empty">
        <div class="empty-state"><div class="icon">👈</div><div class="title">选择章节阅读</div></div>
      </div>
    </div>

    <!-- 右键菜单（组件） -->
    <ContextMenu
      :show="contextMenu.show"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :title="contextMenu.chapter?.title"
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
        <h3>✏️ 重命名章节</h3>
        <input v-model="renameDialog.title" placeholder="章节标题" @keyup.enter="doRename" autofocus />
        <div class="dialog-actions">
          <button class="btn-secondary" @click="renameDialog.show = false">取消</button>
          <button class="btn-primary" @click="doRename">确定</button>
        </div>
      </div>
    </div>

    <!-- 编辑内容对话框 -->
    <div v-if="editDialog.show" class="dialog-overlay" @click.self="editDialog.show = false">
      <div class="dialog dialog-large">
        <h3>✏️ 编辑「{{ editDialog.chapter?.title }}」</h3>
        <p class="dialog-desc">{{ wordCount({ content: editDialog.content }) }}字 · 修改后将自动重新分析</p>
        <textarea v-model="editDialog.content" rows="18" class="content-editor"></textarea>
        <div class="dialog-actions">
          <button class="btn-secondary" @click="editDialog.show = false">取消</button>
          <button class="btn-secondary" @click="doSaveOnly" :disabled="!editDialog.content.trim()">仅保存</button>
          <button class="btn-primary" @click="doEditContent" :disabled="!editDialog.content.trim()">保存并重新分析</button>
        </div>
      </div>
    </div>

    <!-- 分析结果提示 -->
    <div v-if="analysisToast" class="analysis-toast" :class="analysisToast.type">
      {{ analysisToast.msg }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, nextTick, onMounted, onUnmounted } from 'vue'
import { useProjectStore } from '../stores/project'
import { useSettingsStore } from '../stores/settings'
import { ENTITY_TYPE_NAMES, createEmptyEntities } from '../constants/entities'
import { parseExtractionResult } from '../utils/parseAIJson'
import { CHAPTER_ANALYSIS_PROMPT } from '../constants/aiPrompts'
import ContextMenu from '../components/ContextMenu.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const projectStore = useProjectStore()
const settingsStore = useSettingsStore()

const chapters = computed(() =>
  [...(projectStore.currentProject?.chapters || [])].sort((a, b) => a.number - b.number)
)
const activeChapter = ref(chapters.value[0] || null)
const analyzingId = ref(null)  // 'number|title' of chapter being analyzed

const unanalyzedCount = computed(() => chapters.value.filter(c => !c.analyzed).length)

function isActive(ch) {
  return activeChapter.value?.number === ch.number && activeChapter.value?.title === ch.title
}

const contextMenu = reactive({ show: false, x: 0, y: 0, chapter: null, index: -1, style: {} })

const ctxItems = computed(() => {
  const ch = contextMenu.chapter
  return [
    { label: (ch && ch.analyzed) ? '重新分析' : 'AI 分析此章', icon: '🔍', action: 'analyze', disabled: !!analyzingId.value },
    { label: '编辑内容', icon: '📝', action: 'edit' },
    { label: '重命名', icon: '✏️', action: 'rename' },
    { label: '删除章节', icon: '❌', action: 'delete', danger: true }
  ]
})

const openContextMenu = (e, ch, idx) => {
  contextMenu.x = e.clientX; contextMenu.y = e.clientY
  contextMenu.chapter = ch; contextMenu.index = idx
  contextMenu.style = { left: `${e.clientX}px`, top: `${e.clientY}px` }
  contextMenu.show = true
}
function closeContextMenu() { contextMenu.show = false }

// ---- 确认对话框 ----
const confirmDialog = reactive({ show: false, title: '', message: '', danger: false, okText: '确定', onOk: () => {} })

function showConfirm(title, message, onOk, { danger = false, okText = '确定' } = {}) {
  Object.assign(confirmDialog, { show: true, title, message, danger, okText, onOk })
}

function ctxAction(action) {
  const ch = contextMenu.chapter
  if (!ch) return
  contextMenu.show = false
  if (action === 'analyze') analyzeSingle(ch)
  else if (action === 'edit') startEdit(ch)
  else if (action === 'rename') startRename(ch)
  else if (action === 'delete') {
    showConfirm('删除章节', `确定删除「${ch.title}」吗？`, () => {
      projectStore.removeChapter(projectStore.currentProjectId, ch)
      if (activeChapter.value === ch) activeChapter.value = chapters.value[0] || null
    }, { danger: true, okText: '删除' })
  }
}

const renameDialog = reactive({ show: false, chapter: null, title: '' })
const editDialog = reactive({ show: false, chapter: null, content: '' })
const analysisToast = ref(null)

function startEdit(ch) {
  editDialog.chapter = ch; editDialog.content = ch.content || ''; editDialog.show = true
}

function doSaveOnly() {
  const ch = editDialog.chapter
  if (!ch || !editDialog.content.trim()) return
  ch.content = editDialog.content.trim()
  ch.analyzed = false  // 标记为未分析
  editDialog.show = false
  const proj = projectStore.currentProject
  if (proj) projectStore.updateProject(proj.id, { chapters: [...proj.chapters] })
  analysisToast.value = { type: 'ok', msg: '✅ 已保存，可稍后手动分析' }
  setTimeout(() => { analysisToast.value = null }, 3000)
}

async function doEditContent() {
  const ch = editDialog.chapter
  if (!ch || !editDialog.content.trim()) return
  const oldContent = ch.content
  ch.content = editDialog.content.trim()
  editDialog.show = false

  // 更新章节数据
  const proj = projectStore.currentProject
  if (proj) await projectStore.updateProject(proj.id, { chapters: [...proj.chapters] })

  // 自动重新分析
  const beforeCount = countExisting(proj)
  await analyzeSingle(ch)
  const afterCount = countExisting(proj)
  const diff = afterCount - beforeCount

  if (diff > 0) {
    analysisToast.value = { type: 'ok', msg: `✅ 重新分析完成，新增 ${diff} 个实体` }
  } else if (diff === 0) {
    analysisToast.value = { type: 'ok', msg: '✅ 重新分析完成，实体已更新' }
  }
  setTimeout(() => { analysisToast.value = null }, 4000)
}

function countExisting(proj) {
  if (!proj?.entities) return 0
  let n = 0
  for (const t of ['characters','settings','relationships','foreshadows','events','items','powerRankings','chapterSummaries']) {
    n += (proj.entities[t]?.length || 0)
  }
  return n
}
function startRename(ch) {
  renameDialog.chapter = ch; renameDialog.title = ch.title; renameDialog.show = true
  nextTick(() => { const el = document.querySelector('.dialog-overlay input'); el?.focus(); el?.select() })
}
function doRename() {
  if (!renameDialog.title.trim() || !renameDialog.chapter) return
  projectStore.renameChapter(projectStore.currentProjectId, renameDialog.chapter, renameDialog.title.trim())
  if (activeChapter.value === renameDialog.chapter)
    activeChapter.value = { ...renameDialog.chapter, title: renameDialog.title.trim() }
  renameDialog.show = false
}

// ---- 单章 AI 分析 ----
async function analyzeSingle(ch) {
  if (analyzingId.value) return
  const text = (ch.content || '').trim()
  if (!text || text.length < 20) return

  const id = ch.number + '|' + ch.title
  analyzingId.value = id

  try {
    const config = settingsStore.getAIConfig()
    if (!config.apiKey) throw new Error('请先配置 API Key')

    const proj = projectStore.currentProject
    if (!proj) throw new Error('未找到项目')

    const result = await window.electronAPI?.aiRequest({
      ...config,
      messages: [
      { role: 'system', content: CHAPTER_ANALYSIS_PROMPT },
      { role: 'user', content: `【${ch.title}】\n${text.slice(0, 30000)}` }
    ],
    maxTokens: 8192,
    temperature: 0.2
    })

    if (!result?.content) { console.warn('AI 返回空内容:', ch.title); return {} }

    const entities = parseExtractionResult(result.content)
    let added = 0

    for (const type of ENTITY_TYPE_NAMES) {
      const list = entities[type]
      if (!list?.length) continue
      for (const entity of list) {
        projectStore.updateEntity(proj.id, type, entity)
        added++
      }
    }

    // 标记已分析并立即持久化 — 失败回滚
    ch.analyzed = true
    try {
      await projectStore.updateProject(proj.id, { chapters: [...proj.chapters] })
    } catch (err) {
      ch.analyzed = false
      throw err
    }

    // 如果阅读器正在显示这一章，刷新 activeChapter
    if (activeChapter.value === ch) {
      activeChapter.value = { ...ch }
    }

    // 瞬间绿闪
    const badge = document.querySelector(`.ch-list-item:nth-child(${chapters.value.indexOf(ch) + 1}) .ch-badge`)
    if (badge) { badge.classList.add('flash'); setTimeout(() => badge.classList.remove('flash'), 1500) }

    console.log(`[分析完成] ${ch.title}: ${added} 个实体已写入知识库`, proj.entities)
  } catch (err) {
    console.error('[analyzeSingle]', err)
  } finally {
    analyzingId.value = null
  }
}

function compactEntities(entities) {
  if (!entities) return {}
  const c = {}
  for (const [type, list] of Object.entries(entities)) {
    if (list?.length) c[type] = list.slice(0, 10).map(e => { const { id, createdAt, updatedAt, ...r } = e; return r })
  }
  return c
}

function formatDate(iso) {
  if (!iso) return ''
  return `${new Date(iso).getMonth()+1}/${new Date(iso).getDate()}`
}
function wordCount(ch) { return (ch.content||'').length }
function renderContent(text) {
  return text.split('\n').map(l => { const t=l.trim(); return t ? `<p>${t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>` : '<br>' }).join('\n')
}

async function copyChapter() {
  if (!activeChapter.value?.content) return
  try {
    await navigator.clipboard.writeText(activeChapter.value.content)
  } catch {
    // fallback for older environments
    const ta = document.createElement('textarea')
    ta.value = activeChapter.value.content
    ta.style.position = 'fixed'; ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select(); document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

function onGlobalClick() { closeContextMenu() }
onMounted(() => document.addEventListener('click', onGlobalClick))
onUnmounted(() => document.removeEventListener('click', onGlobalClick))
</script>

<style scoped>
.chapters-view { height:100%; display:flex; flex-direction:column; padding:24px; }
.ch-header { display:flex; align-items:baseline; gap:10px; margin-bottom:16px; flex-shrink:0; }
.ch-header h2 { margin:0; font-size:var(--font-size-xl); }
.ch-count { font-size:var(--font-size-sm); color:var(--text-muted); }
.ch-layout { flex:1; display:flex; gap:0; overflow:hidden; border:1px solid var(--border); border-radius:var(--radius-lg); background:var(--bg-surface); }
.ch-list { width:220px; min-width:220px; border-right:1px solid var(--border); overflow-y:auto; padding:4px; }
.ch-list-item { display:flex; align-items:center; gap:6px; padding:7px 8px; border-radius:var(--radius-sm); cursor:pointer; transition:all var(--transition-fast); font-size:var(--font-size-sm); }
.ch-list-item:hover { background:var(--bg-hover); }
.ch-list-item.active { background:var(--accent-subtle); color:var(--accent); }
.ch-list-item.analyzing { opacity:0.6; pointer-events:none; }
.ch-num { font-size:var(--font-size-xs); color:var(--text-muted); background:var(--bg-card); padding:1px 6px; border-radius:4px; min-width:26px; text-align:center; }
.ch-list-item.active .ch-num { background:var(--accent); color:#fff; }
.ch-title { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-primary); }
.ch-badge { font-size:9px; padding:1px 5px; border-radius:99px; color:var(--warning); background:rgba(245,158,11,0.12); white-space:nowrap; flex-shrink:0; transition:all .3s; }
.ch-badge.done { color:var(--success); background:rgba(74,222,128,0.12); }
.ch-badge.flash { color:#fff !important; background:var(--success) !important; }
.ch-date { font-size:var(--font-size-xs); color:var(--text-muted); flex-shrink:0; }
.ch-reader { flex:1; overflow-y:auto; display:flex; flex-direction:column; }
.ch-reader-empty { display:flex; align-items:center; justify-content:center; }
.reader-header { padding:20px 28px 16px; border-bottom:1px solid var(--border); flex-shrink:0; }
.reader-header h3 { font-size:var(--font-size-lg); margin:0 0 4px; }
.reader-meta { font-size:var(--font-size-xs); color:var(--text-muted); }
.reader-meta .ok { color:var(--success); }
.reader-meta .warn { color:var(--warning); }
.btn-copy {
  margin-left: 8px; padding: 3px 10px; font-size: var(--font-size-xs);
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-sm); color: var(--text-secondary); cursor: pointer;
}
.btn-copy:hover { border-color: var(--accent); color: var(--accent); }
.reader-body { flex:1; padding:24px 28px; line-height:2; font-size:15px; color:var(--text-primary); overflow-y:auto; }
.reader-body :deep(p) { margin:0 0 12px; text-indent:2em; }

/* Content editor */
.content-editor {
  width: 100%; resize: vertical; min-height: 200px;
  font-family: var(--font-mono); font-size: var(--font-size-sm);
  line-height: 1.8; padding: 14px;
}

/* Analysis toast */
.analysis-toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  padding: 10px 20px; border-radius: var(--radius-md);
  font-size: var(--font-size-sm); z-index: 200;
  animation: slideUp 0.2s ease;
}
.analysis-toast.ok { background: rgba(74,222,128,.15); border: 1px solid rgba(74,222,128,.3); color: var(--success); }
</style>
