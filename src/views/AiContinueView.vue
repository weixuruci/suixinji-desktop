<template>
  <div class="continue-view">
    <div class="cv-header">
      <h2>✍️ AI 续写</h2>
      <span class="cv-info">{{ chapters.length }}章 · {{ totalChars }}角色 · {{ foreshadowCount }}伏笔</span>
    </div>

    <div class="cv-layout">
      <!-- 左侧：配置区 -->
      <div class="cv-sidebar">
        <div class="cv-section">
          <h3>📊 当前进度</h3>
          <div class="cv-stats">
            <div class="cv-stat"><span class="cv-stat-num">{{ chapters.length }}</span>已写章节</div>
            <div class="cv-stat"><span class="cv-stat-num">{{ totalChars }}</span>角色</div>
            <div class="cv-stat"><span class="cv-stat-num">{{ unresolvedCount }}</span>未收伏笔</div>
            <div class="cv-stat"><span class="cv-stat-num">{{ totalWords }}</span>总字数</div>
          </div>
        </div>

        <div class="cv-section">
          <h3>🎯 续写方向（可选）</h3>
          <textarea v-model="direction" rows="3" placeholder="如：主角前往龙族秘境寻找突破契机..."
            class="cv-input" :disabled="isGenerating"></textarea>
          <div class="cv-presets">
            <span v-for="p in presets" :key="p" class="cv-preset" @click="direction = p">{{ p }}</span>
          </div>
        </div>

        <div class="cv-section">
          <h3>📝 生成设置</h3>
          <div class="cv-settings-row">
            <label class="cv-label">生成章节数</label>
            <input type="number" v-model.number="chaptersToGenerate" min="1" max="50"
              class="cv-num-input" :disabled="isGenerating" />
          </div>
          <div class="cv-settings-row">
            <label class="cv-label">字数限制</label>
            <select v-model.number="maxWords" class="cv-select" :disabled="isGenerating">
              <option :value="1000">1000字</option>
              <option :value="2000">2000字</option>
              <option :value="3000">3000字</option>
              <option :value="4000">4000字</option>
              <option :value="6000">6000字</option>
              <option :value="8000">8000字</option>
            </select>
          </div>
          <label class="cv-toggle">
            <input type="checkbox" v-model="autoContinue" :disabled="isGenerating" />
            <span class="cv-toggle-label">🔄 自动续写到完结</span>
          </label>
          <p class="cv-hint" v-if="autoContinue">忽略章节数，连续生成直到自然完结或手动停止。</p>
          <p class="cv-hint" v-else>生成 {{ chaptersToGenerate }} 章后自动停止。</p>
        </div>

        <div class="cv-section">
          <button class="btn-primary btn-gen" :disabled="!canGenerate" @click="startGenerate">
            <template v-if="isGenerating">
              <span class="spinner"></span> {{ autoContinue ? '续写中...' : '生成中...' }}
            </template>
            <template v-else>
              ✍️ {{ autoContinue ? '开始自动续写' : chaptersToGenerate > 1 ? `续写 ${chaptersToGenerate} 章` : '生成下一章' }}
            </template>
          </button>
          <button v-if="isGenerating" class="btn-danger btn-gen" style="margin-top:8px" @click="stopAuto">
            ⏹ 停止
          </button>
        </div>

        <!-- 最近生成的章节日志 -->
        <div v-if="generatedChapters.length" class="cv-section">
          <h3>📝 已生成</h3>
          <div class="cv-log">
            <div v-for="g in generatedChapters" :key="g.number" class="cv-log-item" @click="viewChapter(g)">
              <span class="cv-log-title">第{{ g.number }}章 {{ g.title }}</span>
              <span class="cv-log-words">{{ g.wordCount }}字</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：内容区 -->
      <div class="cv-main">
        <!-- 空状态 -->
        <div v-if="!currentChapter && !isGenerating && !error" class="empty-state">
          <div class="icon">✍️</div>
          <div class="title">AI 续写章节</div>
          <div class="desc">AI 将读取全部已有章节和知识库，续写下一章。<br/>生成后自动入库并提取实体。</div>
        </div>

        <!-- 生成中 loading -->
        <div v-if="isGenerating" class="cv-loading">
          <div class="spinner large"></div>
          <p>AI 正在续写第{{ nextChapterNum }}章...</p>
          <p class="cv-loading-desc">读取 {{ chapters.length }} 章上下文 · 基于 {{ totalChars }} 个角色 · {{ unresolvedCount }} 个未收伏笔</p>
        </div>

        <!-- 错误 -->
        <div v-if="error" class="cv-error">
          <div class="cv-error-icon">⚠️</div>
          <div class="cv-error-msg">{{ error }}</div>
          <button class="btn-secondary" @click="error = null">关闭</button>
        </div>

        <!-- 生成的章节内容 -->
        <div v-if="currentChapter" class="cv-reader">
          <div class="reader-header">
            <template v-if="isEditing">
              <input v-model="editableTitle" class="reader-edit-title" placeholder="章节标题" />
            </template>
            <template v-else>
              <h3>第{{ currentChapter.number }}章 {{ currentChapter.title }}</h3>
            </template>
            <span class="reader-meta">{{ currentChapter.wordCount }}字 · 已自动入库</span>
          </div>

          <!-- 正文 -->
          <template v-if="isEditing">
            <textarea v-model="editableContent" class="reader-edit-body"></textarea>
          </template>
          <template v-else>
            <div class="reader-body" v-html="renderContent(currentChapter.content)"></div>
          </template>

          <div class="reader-actions">
            <template v-if="isEditing">
              <button class="btn-primary" @click="saveEdit" :disabled="isGenerating">💾 保存修改</button>
              <button class="btn-secondary" @click="cancelEdit">✕ 取消</button>
            </template>
            <template v-else>
              <button class="btn-secondary" @click="startEdit">✏️ 编辑</button>
              <button class="btn-secondary" @click="retryChapter" :disabled="isGenerating">🔄 重试</button>
              <button class="btn-primary" @click="keepAndContinue" :disabled="isGenerating">
                ✅ 保留{{ autoContinue ? '' : '并继续' }}
              </button>
              <button class="btn-secondary" @click="currentChapter = null">👌 保留即可</button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useProjectStore } from '../stores/project'
import { useSettingsStore } from '../stores/settings'
import { CONTINUE_WRITING_PROMPT, CHAPTER_ANALYSIS_PROMPT } from '../constants/aiPrompts'
import { createEmptyEntities, ENTITY_TYPE_NAMES } from '../constants/entities'
import { parseExtractionResult } from '../utils/parseAIJson'

const projectStore = useProjectStore()
const settingsStore = useSettingsStore()

const direction = ref('')
const autoContinue = ref(false)
const chaptersToGenerate = ref(1)
const maxWords = ref(3000)
const isGenerating = ref(false)
const stopRequested = ref(false)
const currentChapter = ref(null)
const generatedChapters = ref([])
const error = ref('')

// 编辑模式
const isEditing = ref(false)
const editableTitle = ref('')
const editableContent = ref('')

const presets = ['战斗突破', '感情推进', '秘境探险', '阴谋揭露', '收束伏笔', '日常过渡']

const proj = computed(() => projectStore.currentProject)
const chapters = computed(() => [...(proj.value?.chapters || [])].sort((a, b) => a.number - b.number))
const entities = computed(() => proj.value?.entities || {})

const totalChars = computed(() => (entities.value.characters?.length || 0))
const foreshadows = computed(() => entities.value.foreshadows || [])
const foreshadowCount = computed(() => foreshadows.value.length)
const unresolvedCount = computed(() => foreshadows.value.filter(f => f.status !== '已收' && f.status !== 'resolved').length)
const totalWords = computed(() => chapters.value.reduce((s, c) => s + (c.content?.length || 0), 0))
const nextChapterNum = computed(() => chapters.value.length + 1)

const canGenerate = computed(() => {
  if (isGenerating.value) return false
  if (!settingsStore.hasApiKey) return false
  if (!proj.value) return false
  return true
})

async function startGenerate() {
  error.value = null
  stopRequested.value = false
  isGenerating.value = true
  currentChapter.value = null
  generatedChapters.value = []

  try {
    const maxChapters = autoContinue.value ? 999 : chaptersToGenerate.value
    let count = 0
    while (count < maxChapters && !stopRequested.value && isGenerating.value) {
      await generateOne()
      count++
    }
  } catch (err) {
    error.value = err.message || '生成失败'
  } finally {
    isGenerating.value = false
  }
}

function stopAuto() {
  stopRequested.value = true
}

async function generateOne() {
  const config = settingsStore.getAIConfig()
  if (!config.apiKey) throw new Error('请先配置 API Key')

  const context = buildContext()
  const num = nextChapterNum.value
  let dirText = direction.value ? `\n续写方向：${direction.value}` : ''
  dirText += `\n字数要求：约${maxWords.value}字`

  const messages = [
    { role: 'system', content: CONTINUE_WRITING_PROMPT },
    { role: 'user', content: context + dirText }
  ]

  const result = await window.electronAPI?.aiRequest({
    ...config,
    messages,
    maxTokens: 4096,
    temperature: 0.7
  })

  if (!result?.content) throw new Error('AI 返回空内容')

  // 解析生成的章节
  const { title, content } = parseGeneratedChapter(result.content, num)

  if (!content || content.length < 100) throw new Error('生成内容过短，请重试')

  // 保存章节到项目
  const ch = {
    number: num,
    title: title || `第${num}章`,
    content,
    analyzed: false,
    uploadedAt: new Date().toISOString()
  }
  await projectStore.addChapter(proj.value.id, ch)

  // 自动提取实体
  try { await autoExtract(ch) } catch (e) { console.warn('实体提取失败:', e) }

  // 更新本地引用（从 store 重新获取以拿到最新 analyzed 状态）
  const savedCh = (projectStore.currentProject?.chapters || []).find(c => c.number === num)
  const displayCh = {
    number: num,
    title: savedCh?.title || ch.title,
    content: ch.content,
    wordCount: ch.content.length,
    analyzed: savedCh?.analyzed || false
  }

  currentChapter.value = displayCh
  generatedChapters.value.push(displayCh)
}

function parseGeneratedChapter(text, defaultNum) {
  // 尝试匹配 "## 第N章 标题" 或 "第N章 标题"
  const titleMatch = text.match(/^#*\s*第(\d+)章\s*(.+?)(?:\n|$)/)
  let title = ''
  let content = text

  if (titleMatch) {
    title = titleMatch[2].trim()
    content = text.slice(titleMatch[0].length).trim()
  }

  // 清理
  content = content
    .replace(/^```[\s\S]*?\n/, '')  // 去掉开头的代码块标记
    .replace(/```$/, '')             // 去掉结尾的代码块标记
    .trim()

  return { title, content }
}

async function autoExtract(chapter) {
  const config = settingsStore.getAIConfig()
  if (!config.apiKey) return

  const text = (chapter.content || '').trim()
  if (text.length < 50) return

  const result = await window.electronAPI?.aiRequest({
    ...config,
    messages: [
      { role: 'system', content: CHAPTER_ANALYSIS_PROMPT },
      { role: 'user', content: `【${chapter.title}】\n${text.slice(0, 30000)}` }
    ],
    maxTokens: 8192,
    temperature: 0.2
  })

  if (!result?.content) return

  const entities = parseExtractionResult(result.content)
  for (const type of ENTITY_TYPE_NAMES) {
    const list = entities[type]
    if (!list?.length) continue
    for (const entity of list) {
      projectStore.updateEntity(proj.value.id, type, entity)
    }
  }

  // 标记已分析
  const ch = (proj.value?.chapters || []).find(c => c.number === chapter.number)
  if (ch) {
    ch.analyzed = true
    await projectStore.updateProject(proj.value.id, { chapters: [...proj.value.chapters] })
  }
}

function buildContext() {
  const p = proj.value
  if (!p) return ''

  let ctx = `作品：《${p.name}》\n`
  ctx += `已写 ${chapters.value.length} 章\n\n`

  // 角色列表
  if (totalChars.value > 0) {
    ctx += '## 角色\n'
    for (const c of (entities.value.characters || []).slice(0, 15)) {
      ctx += `- ${c.name}：${c.status || '存活'} · ${c.description || ''}`.slice(0, 120) + '\n'
    }
    ctx += '\n'
  }

  // 关系
  const rels = entities.value.relationships || []
  if (rels.length > 0) {
    ctx += '## 关键关系\n'
    for (const r of rels.slice(0, 10)) {
      ctx += `- ${r.personA || '?'} → ${r.personB || '?'}：${r.relation || '?'}\n`
    }
    ctx += '\n'
  }

  // 未收伏笔
  const unresolved = foreshadows.value.filter(f => f.status !== '已收' && f.status !== 'resolved')
  if (unresolved.length > 0) {
    ctx += '## 待回收伏笔\n'
    for (const f of unresolved.slice(0, 8)) {
      ctx += `- ${f.content}（第${f.plantedAt || '?'}章）\n`
    }
    ctx += '\n'
  }

  // 修炼体系
  const powerSystems = entities.value.powerSystem || []
  if (powerSystems.length > 0) {
    ctx += '## 修炼体系\n'
    for (const ps of powerSystems) {
      ctx += `### ${ps.name || '修炼体系'}\n`
      if (ps.description) ctx += `${ps.description}\n`
      const stages = (ps.stages || []).sort((a, b) => (a.order || 0) - (b.order || 0))
      if (stages.length > 0) {
        ctx += '境界划分：\n'
        for (const s of stages) {
          ctx += `- ${s.name}：${s.description || ''}${s.requirements ? ' [条件：' + s.requirements + ']' : ''}\n`
        }
      }
      ctx += '\n'
    }
  }

  // 战力排行
  const powers = entities.value.powerRankings || []
  if (powers.length > 0) {
    ctx += '## 战力体系\n'
    for (const pw of powers.slice(0, 10)) {
      ctx += `- ${pw.name}：${pw.level || '?'}\n`
    }
    ctx += '\n'
  }

  // 最近 N 章摘要
  const summaries = entities.value.chapterSummaries || []
  if (summaries.length > 0) {
    ctx += '## 剧情回顾\n'
    for (const s of summaries.slice(-5)) {
      ctx += `- 第${s.chapter || '?'}章：${(s.summary || '').slice(0, 150)}\n`
    }
    ctx += '\n'
  }

  // 最近 3 章全文（风格参考）
  const recentChapters = chapters.value.slice(-3)
  if (recentChapters.length > 0) {
    ctx += '## 最近章节原文（风格参考）\n'
    for (const ch of recentChapters) {
      const text = (ch.content || '').slice(0, 4000)
      ctx += `--- 第${ch.number}章 ${ch.title || ''} ---\n${text}\n\n`
    }
  }

  ctx += `\n请续写第${chapters.value.length + 1}章。`
  return ctx
}

function keepAndContinue() {
  currentChapter.value = null
  if (autoContinue.value) return  // auto mode handles itself
  // manual mode: generate next
  isGenerating.value = true
  generateOne().catch(err => { error.value = err.message || '生成失败' }).finally(() => { isGenerating.value = false })
}

function retryChapter() {
  // remove last generated chapter from project
  if (currentChapter.value) {
    const ch = chapters.value.find(c => c.number === currentChapter.value.number)
    if (ch) projectStore.removeChapter(proj.value.id, ch)
  }
  generatedChapters.value.pop()
  currentChapter.value = null
  isGenerating.value = true
  generateOne().catch(err => { error.value = err.message || '生成失败' }).finally(() => { isGenerating.value = false })
}

function viewChapter(g) {
  currentChapter.value = g
}

function startEdit() {
  if (!currentChapter.value) return
  editableTitle.value = currentChapter.value.title || ''
  editableContent.value = currentChapter.value.content || ''
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
}

async function saveEdit() {
  if (!currentChapter.value || !proj.value) return
  const num = currentChapter.value.number
  await projectStore.updateChapter(proj.value.id, num, {
    title: editableTitle.value || `第${num}章`,
    content: editableContent.value
  })
  // 更新本地显示
  currentChapter.value.title = editableTitle.value || `第${num}章`
  currentChapter.value.content = editableContent.value
  currentChapter.value.wordCount = editableContent.value.length
  // 同步更新日志列表
  const logItem = generatedChapters.value.find(g => g.number === num)
  if (logItem) {
    logItem.title = currentChapter.value.title
    logItem.content = currentChapter.value.content
    logItem.wordCount = currentChapter.value.wordCount
  }
  isEditing.value = false
}

function renderContent(text) {
  return text.split('\n').map(l => {
    const t = l.trim()
    return t ? `<p>${t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>` : '<br>'
  }).join('\n')
}
</script>

<style scoped>
.continue-view { height:100%; display:flex; flex-direction:column; padding:20px 24px; overflow:hidden; }
.cv-header { display:flex; align-items:baseline; gap:10px; margin-bottom:16px; flex-shrink:0; }
.cv-header h2 { margin:0; font-size:var(--font-size-xl); }
.cv-info { font-size:var(--font-size-sm); color:var(--text-muted); }

.cv-layout { flex:1; display:flex; gap:20px; overflow:hidden; }
.cv-sidebar { width:260px; min-width:260px; overflow-y:auto; display:flex; flex-direction:column; gap:16px; }
.cv-main { flex:1; overflow-y:auto; }

.cv-section h3 { font-size:var(--font-size-sm); color:var(--text-secondary); margin:0 0 10px; font-weight:600; }

.cv-stats { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
.cv-stat {
  background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md);
  padding:8px 10px; font-size:var(--font-size-xs); color:var(--text-muted); text-align:center;
}
.cv-stat-num { display:block; font-size:var(--font-size-md); font-weight:700; color:var(--accent); }

.cv-input {
  width:100%; padding:10px; font-size:var(--font-size-sm); resize:vertical;
  background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md);
  color:var(--text-primary); font-family:inherit;
}
.cv-input:focus { border-color:var(--accent); outline:none; }

.cv-presets { display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; }
.cv-preset {
  font-size:var(--font-size-xs); padding:3px 8px; border-radius:99px;
  background:var(--bg-card); border:1px solid var(--border); color:var(--text-muted);
  cursor:pointer; transition:all var(--transition-fast);
}
.cv-preset:hover { border-color:var(--accent); color:var(--accent); }

.cv-toggle { display:flex; align-items:center; gap:8px; cursor:pointer; font-size:var(--font-size-sm); }
.cv-toggle-label { color:var(--text-primary); }
.cv-hint { font-size:var(--font-size-xs); color:var(--text-muted); margin:6px 0 0; }

.btn-gen { width:100%; padding:12px; font-size:var(--font-size-md); justify-content:center; }

.cv-log { display:flex; flex-direction:column; gap:4px; }
.cv-log-item {
  display:flex; align-items:center; gap:6px; padding:6px 8px;
  background:var(--bg-card); border:1px solid var(--border);
  border-radius:var(--radius-sm); cursor:pointer; font-size:var(--font-size-xs);
  transition:all var(--transition-fast);
}
.cv-log-item:hover { border-color:var(--accent); }
.cv-log-title { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-primary); }
.cv-log-words { color:var(--text-muted); flex-shrink:0; }

.cv-loading { text-align:center; padding:60px 20px; }
.cv-loading p { margin:16px 0 0; font-size:var(--font-size-md); color:var(--text-secondary); }
.cv-loading-desc { font-size:var(--font-size-xs) !important; color:var(--text-muted) !important; }
.spinner.large { width:40px; height:40px; border-width:3px; margin:0 auto; }

.cv-error { text-align:center; padding:40px 20px; }
.cv-error-icon { font-size:40px; margin-bottom:12px; }
.cv-error-msg { font-size:var(--font-size-base); color:var(--error); margin-bottom:16px; white-space:pre-wrap; }

.cv-reader { display:flex; flex-direction:column; height:100%; }
.reader-header { padding:16px 0; border-bottom:1px solid var(--border); flex-shrink:0; }
.reader-header h3 { font-size:var(--font-size-lg); margin:0 0 4px; }
.reader-meta { font-size:var(--font-size-xs); color:var(--text-muted); }
.reader-body { flex:1; padding:20px 0; line-height:2.2; font-size:15px; color:var(--text-primary); overflow-y:auto; }
.reader-body :deep(p) { margin:0 0 14px; text-indent:2em; }
.reader-edit-title {
  width:100%; padding:8px 12px; font-size:var(--font-size-lg); font-weight:700;
  background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md);
  color:var(--text-primary); font-family:inherit;
}
.reader-edit-body {
  flex:1; width:100%; padding:16px; font-size:15px; line-height:2.2; resize:none;
  background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md);
  color:var(--text-primary); font-family:inherit; min-height:400px;
}
.cv-settings-row { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
.cv-label { font-size:var(--font-size-sm); color:var(--text-secondary); white-space:nowrap; }
.cv-num-input {
  width:60px; padding:4px 8px; font-size:var(--font-size-sm); text-align:center;
  background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md);
  color:var(--text-primary); font-family:inherit;
}
.cv-select {
  padding:4px 8px; font-size:var(--font-size-sm);
  background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md);
  color:var(--text-primary); font-family:inherit;
}
.reader-actions {
  display:flex; gap:8px; padding:16px 0; border-top:1px solid var(--border); flex-shrink:0;
}
.reader-actions .btn-primary { flex:1; }

.spinner { display:inline-block; width:16px; height:16px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin .6s linear infinite; }
</style>
