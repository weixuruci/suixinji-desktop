<template>
  <div class="upload-view">
    <div class="uv-header">
      <h2>📤 上传章节</h2>
      <p class="uv-desc">导入章节文本，AI 自动提取角色、设定、关系等实体</p>
    </div>

    <!-- 分析模式选择 -->
    <div class="uv-section">
      <h3>分析范围</h3>
      <div class="mode-cards">
        <div v-for="mode in analysisModes" :key="mode.id" class="mode-card"
          :class="{ active: selectedMode === mode.id }" @click="selectedMode = mode.id">
          <div class="mode-icon">{{ mode.icon }}</div>
          <div class="mode-name">{{ mode.label }}</div>
          <div class="mode-desc">{{ mode.desc }}</div>
        </div>
      </div>
    </div>

    <!-- 文件上传区 -->
    <div class="uv-section">
      <h3>选择文件</h3>
      <div class="drop-zone" :class="{ dragging: isDragging, 'has-files': chapters.length }"
        @dragover.prevent="isDragging = true" @dragleave="isDragging = false"
        @drop.prevent="onDrop" @click="pickFile">
        <template v-if="!chapters.length">
          <div class="drop-icon">📄</div>
          <div class="drop-title">点击选择文件，或拖入文件</div>
          <div class="drop-formats">支持 .txt · .md · 整本小说自动分章</div>
        </template>
        <template v-else>
          <div class="drop-icon">✅</div>
          <div class="drop-title">已加载 {{ chapters.length }} 章</div>
          <div class="drop-formats">点击追加更多文件</div>
        </template>
      </div>

      <!-- 拆分提示 -->
      <div v-if="splitInfo" class="split-hint">
        📖 {{ splitInfo }}
      </div>

      <!-- 章节列表 -->
      <div v-if="chapters.length" class="ch-list">
        <div v-for="(ch, i) in chapters" :key="i" class="ch-item">
          <span class="ch-icon">📝</span>
          <div class="ch-info">
            <div class="ch-name">{{ ch.name }}</div>
            <div class="ch-size">{{ formatSize(ch.content?.length || 0) }} · {{ ch.wordCount }}字</div>
          </div>
          <button class="btn-icon danger" @click="chapters.splice(i, 1)">✕</button>
        </div>
      </div>
    </div>

    <!-- 高级选项 -->
    <div class="uv-section">
      <h3>高级选项</h3>
      <div class="toggle-group">
        <label class="toggle-item">
          <div class="toggle-switch">
            <input type="checkbox" v-model="autoSplit" />
            <span class="toggle-slider"></span>
          </div>
          <div class="toggle-text">
            <span class="toggle-label">🔪 自动拆分章节</span>
            <span class="toggle-desc">按「第X章」等标记自动拆分整本小说</span>
          </div>
        </label>
        <label class="toggle-item">
          <div class="toggle-switch">
            <input type="checkbox" v-model="spellCheck" />
            <span class="toggle-slider"></span>
          </div>
          <div class="toggle-text">
            <span class="toggle-label">🔍 错别字检查</span>
            <span class="toggle-desc">额外让 AI 检查明显错别字</span>
          </div>
        </label>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="uv-section uv-actions">
      <div v-if="!hasApiKey" class="uv-warning">
        ⚠️ 请先在<a href="#" @click.prevent="$router.push('/settings')">设置</a>中配置 API Key
      </div>
      <div class="btn-row">
        <button class="btn-primary btn-analyze" :disabled="!canAnalyze || isExtracting" @click="startAnalysis">
          <template v-if="isExtracting">
            <span class="spinner"></span> 正在分析 {{ currentChIndex + 1 }}/{{ chapters.length }} 章...
          </template>
          <template v-else>
            🚀 分析并导入
          </template>
        </button>
        <button class="btn-secondary btn-analyze" :disabled="!chapters.length || isExtracting" @click="uploadOnly">
          📥 仅上传不分析
        </button>
      </div>
      <div v-if="isExtracting" class="progress-bar">
        <div class="progress-fill" :style="{ width: overallProgress + '%' }"></div>
        <span class="progress-text">{{ overallProgress }}%</span>
      </div>
    </div>

    <!-- 提取预览 -->
    <ExtractionPreview v-if="preview" :preview="preview" @confirm="confirmExtraction" @cancel="preview = null" />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useProjectStore } from '../stores/project'
import { useSettingsStore } from '../stores/settings'
import { useKnowledgeStore } from '../stores/knowledge'
import ExtractionPreview from '../components/ExtractionPreview.vue'
import { createEmptyEntities } from '../constants/entities'
import { parseExtractionResult } from '../utils/parseAIJson'
import { detectConflicts } from '../utils/conflictDetector'

const projectStore = useProjectStore()
const settingsStore = useSettingsStore()
const knowledgeStore = useKnowledgeStore()

const isDragging = ref(false)
const rawFiles = ref([])       // 原始文件对象
const chapters = ref([])       // 拆分后的章节 { name, content, wordCount }
const selectedMode = ref('single')
const autoSplit = ref(true)
const splitInfo = ref('')
const overallProgress = ref(0)
const currentChIndex = ref(0)

const isExtracting = computed(() => knowledgeStore.isExtracting)
const preview = computed(() => knowledgeStore.extractionPreview)
const hasApiKey = computed(() => settingsStore.hasApiKey)
const spellCheck = computed({
  get: () => settingsStore.spellCheck,
  set: v => { settingsStore.spellCheck = v }
})

const analysisModes = [
  { id: 'single', icon: '📄', label: '单章分析', desc: '仅分析新上传的章节' },
  { id: 'range',  icon: '📚', label: '区间分析', desc: `新章节 + 最近 ${settingsStore.rangeSize} 章` },
  { id: 'full',   icon: '🌐', label: '全量分析', desc: '整部作品，适合首次导入' }
]

const canAnalyze = computed(() => chapters.value.length && hasApiKey.value && !isExtracting.value)

// 监听 autoSplit 变化，重新拆分
watch(autoSplit, () => { rebuildChapters() })

function rebuildChapters() {
  if (!rawFiles.value.length) return
  const list = []
  let splitCount = 0

  for (const f of rawFiles.value) {
    if (autoSplit.value) {
      const parts = splitIntoChapters(f.name, f.content)
      if (parts.length > 1) splitCount += parts.length
      list.push(...parts)
    } else {
      list.push({
        name: f.name,
        content: f.content,
        wordCount: (f.content || '').length
      })
    }
  }

  chapters.value = list
  if (splitCount > 1) {
    splitInfo.value = `已自动拆分 ${rawFiles.value.length} 个文件 → ${list.length} 章`
  } else {
    splitInfo.value = ''
  }
}

/** 按「第X章」「Chapter X」等标记拆分文本 */
function splitIntoChapters(filename, text) {
  if (!text) return [{ name: filename, content: '', wordCount: 0 }]

  // 匹配中文章节标题：第1章、第一章、第001章 等
  const chapterPattern = /(?:^|\n)\s*(第[\d零一二三四五六七八九十百千万]+[章节卷部回])\s*[^\n]*/g
  const matches = [...text.matchAll(chapterPattern)]

  if (matches.length <= 1) {
    // 没有足够章节标记，不拆分
    return [{ name: filename, content: text, wordCount: text.length }]
  }

  const parts = []
  const baseName = filename.replace(/\.(txt|md)$/i, '')

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const title = match[1] + (match[0].trim().length > match[1].length
      ? ' ' + match[0].trim().slice(match[1].length).trim()
      : '')

    const startIdx = match.index + (match[0].startsWith('\n') ? 1 : 0)
    const nextMatch = matches[i + 1]
    const endIdx = nextMatch ? nextMatch.index : text.length

    const content = text.slice(startIdx, endIdx).trim()
    if (content.length < 10) continue  // 跳过太短的

    parts.push({
      name: `${baseName} - ${title}`,
      content,
      wordCount: content.length
    })
  }

  return parts.length > 1 ? parts
    : [{ name: filename, content: text, wordCount: text.length }]
}

async function pickFile() {
  const result = await window.electronAPI?.fileDialogOpen()
  if (!result?.filePaths?.length) return
  for (const fp of result.filePaths) {
    const content = await window.electronAPI?.fileRead(fp)
    rawFiles.value.push({ name: fp.split(/[/\\]/).pop(), path: fp, content })
  }
  rebuildChapters()
}

async function onDrop(e) {
  isDragging.value = false
  for (const f of e.dataTransfer.files) {
    if (/\.(txt|md)$/i.test(f.name)) {
      const content = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('读取失败'))
        reader.readAsText(f, 'utf-8')
      })
      rawFiles.value.push({ name: f.name, size: f.size, file: f, content })
    }
  }
  rebuildChapters()
}

function formatSize(bytes) {
  if (!bytes) return '0B'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

// ---- 逐章分析 ----
async function startAnalysis() {
  if (!chapters.value.length) return
  knowledgeStore.isExtracting = true
  overallProgress.value = 0
  currentChIndex.value = 0

  try {
    let allEntities = createEmptyEntities()

    for (let i = 0; i < chapters.value.length; i++) {
      currentChIndex.value = i
      const ch = chapters.value[i]
      overallProgress.value = Math.round((i / chapters.value.length) * 100)

      const entities = await analyzeChapter(ch)

      // 合并实体
      for (const type of Object.keys(allEntities)) {
        if (entities[type]?.length) {
          allEntities[type].push(...entities[type])
        }
      }
    }

    overallProgress.value = 100

    const conflicts = detectConflicts(projectStore.currentProject?.entities || {}, allEntities)

    knowledgeStore.extractionPreview = {
      entities: allEntities,
      stats: calcStats(allEntities),
      sourceFiles: chapters.value.map(c => c.name),
      conflicts
    }
  } catch (err) {
    console.error('Analysis error:', err)
    alert(`分析第 ${currentChIndex.value + 1} 章时出错：${err.message}`)
  } finally {
    knowledgeStore.isExtracting = false
    currentChIndex.value = 0
  }
}

async function analyzeChapter(chapter) {
  const config = settingsStore.getAIConfig()
  const prompt = buildPromptForChapter(chapter)

  const result = await window.electronAPI?.aiRequest({
    ...config,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: `【${chapter.name}】\n${chapter.content.slice(0, 30000)}` }
    ],
    maxTokens: 8192,
    temperature: 0.2
  })

  if (!result?.content) {
    console.warn('AI 返回空内容:', chapter.name)
    return createEmptyEntities()
  }
  return parseExtractionResult(result.content)
}

function buildPromptForChapter(chapter) {
  const proj = projectStore.currentProject
  const existingEntities = proj?.entities || {}
  const existingSummary = Object.entries(existingEntities)
    .filter(([, list]) => list.length > 0)
    .map(([type, list]) => `${type}: ${JSON.stringify(list.slice(0, 10))}`)
    .join('\n')

  return `你是网文知识库提取专家。分析以下一个章节，提取出8类实体信息。只提取这一章明确出现的内容。\n
## 输出格式
必须严格输出 JSON：{"characters":[{...}],"settings":[{...}],"relationships":[{...}],"foreshadows":[{...}],"events":[{...}],"items":[{...}],"powerRankings":[{...}],"chapterSummaries":[{...}]}\n
## 当前章节：${chapter.name}\n
## 已有实体（更新而非重复）\n${existingSummary || '(首次提取)'}`
}

function calcStats(entities) {
  const stats = {}
  for (const [type, list] of Object.entries(entities)) stats[type] = list.length
  stats.total = Object.values(stats).reduce((a, b) => a + b, 0)
  return stats
}

function confirmExtraction(confirmedEntities) {
  const proj = projectStore.currentProject
  if (!proj) return

  for (const [type, list] of Object.entries(confirmedEntities)) {
    for (const entity of (list || [])) {
      projectStore.updateEntity(proj.id, type, entity)
    }
  }

  saveChaptersToProject(true)
  knowledgeStore.extractionPreview = null
  resetUpload()
}

/** 仅上传，不分析 */
function uploadOnly() {
  saveChaptersToProject(false)
  resetUpload()
}

function saveChaptersToProject(analyzed) {
  const proj = projectStore.currentProject
  if (!proj) return
  for (const ch of chapters.value) {
    if (ch.content) {
      const nextNum = (proj.chapters?.length || 0) + 1
      projectStore.addChapter(proj.id, {
        number: nextNum,
        title: ch.name.replace(/\.(txt|md)$/i, ''),
        content: ch.content,
        analyzed
      })
    }
  }
}

function resetUpload() {
  chapters.value = []
  rawFiles.value = []
  overallProgress.value = 0
}
</script>

<style scoped>
.upload-view { padding: 32px; max-width: 720px; margin: 0 auto; height: 100%; overflow-y: auto; }
.uv-header { margin-bottom: 28px; }
.uv-header h2 { margin: 0 0 4px; font-size: var(--font-size-xl); }
.uv-desc { color: var(--text-muted); font-size: var(--font-size-sm); margin: 0; }
.uv-section { margin-bottom: 28px; }
.uv-section h3 { font-size: var(--font-size-sm); color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px; font-weight: 600; }

.mode-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.mode-card { padding: 16px; border: 1px solid var(--border); border-radius: var(--radius-lg); cursor: pointer; transition: all var(--transition-fast); background: var(--bg-card); text-align: center; }
.mode-card:hover { border-color: var(--accent); }
.mode-card.active { border-color: var(--accent); background: var(--accent-subtle); }
.mode-icon { font-size: 28px; margin-bottom: 8px; }
.mode-name { font-weight: 600; color: var(--text-primary); margin-bottom: 4px; font-size: var(--font-size-base); }
.mode-desc { font-size: var(--font-size-xs); color: var(--text-muted); }

.drop-zone { border: 2px dashed var(--border); border-radius: var(--radius-lg); padding: 36px; text-align: center; cursor: pointer; transition: all var(--transition-fast); background: var(--bg-card); }
.drop-zone:hover, .drop-zone.dragging { border-color: var(--accent); background: var(--bg-hover); }
.drop-zone.has-files { border-style: solid; border-color: var(--success); }
.drop-icon { font-size: 36px; margin-bottom: 10px; }
.drop-title { font-size: var(--font-size-md); color: var(--text-secondary); margin-bottom: 4px; }
.drop-formats { font-size: var(--font-size-xs); color: var(--text-muted); }

.split-hint { margin-top: 10px; padding: 10px 14px; background: var(--accent-subtle); border: 1px solid var(--accent); border-radius: var(--radius-md); color: var(--accent); font-size: var(--font-size-sm); }

.ch-list { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; max-height: 300px; overflow-y: auto; }
.ch-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); }
.ch-icon { font-size: 16px; }
.ch-info { flex: 1; min-width: 0; }
.ch-name { font-size: var(--font-size-sm); color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ch-size { font-size: var(--font-size-xs); color: var(--text-muted); }

.toggle-group { display: flex; flex-direction: column; gap: 8px; }
.toggle-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); cursor: pointer; transition: all var(--transition-fast); }
.toggle-item:hover { border-color: var(--border-light); }
.toggle-switch { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.toggle-slider { position: absolute; inset: 0; background: var(--border); border-radius: 22px; transition: all var(--transition-fast); }
.toggle-slider::before { content: ''; position: absolute; width: 16px; height: 16px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: all var(--transition-fast); }
.toggle-switch input:checked + .toggle-slider { background: var(--accent); }
.toggle-switch input:checked + .toggle-slider::before { transform: translateX(18px); }
.toggle-text { display: flex; flex-direction: column; }
.toggle-label { font-size: var(--font-size-base); color: var(--text-primary); }
.toggle-desc { font-size: var(--font-size-xs); color: var(--text-muted); margin-top: 2px; }

.uv-actions { padding-top: 8px; }
.uv-warning { padding: 12px 16px; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: var(--radius-md); color: var(--warning); font-size: var(--font-size-sm); margin-bottom: 12px; }
.uv-warning a { color: var(--accent); text-decoration: underline; }
.btn-analyze { width: 100%; padding: 14px; font-size: var(--font-size-md); justify-content: center; }
.btn-row { display: flex; gap: 10px; }
.btn-row .btn-analyze { flex: 1; }
.progress-bar { height: 6px; background: var(--bg-card); border-radius: 3px; margin-top: 12px; position: relative; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, var(--accent), #a78bfa); border-radius: 3px; transition: width 0.4s ease; }
.progress-text { position: absolute; right: 0; top: -20px; font-size: var(--font-size-xs); color: var(--text-muted); }
.spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; }
</style>
