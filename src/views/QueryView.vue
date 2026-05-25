<template>
  <div class="query-view">
    <div class="qv-header">
      <div class="qv-title-row">
        <div>
          <h2>🤖 智能 Agent</h2>
          <p class="qv-desc">基于知识库回答，可查人物、设定、关系、伏笔等</p>
        </div>
        <div class="qv-actions">
          <button v-if="unanalyzedCount && !isAnalyzing" class="btn-secondary btn-sm" @click="analyzeAll">
            🔍 分析 {{ unanalyzedCount }} 章
          </button>
          <button v-if="isAnalyzing" class="btn-secondary btn-sm"><span class="spinner"></span> {{ analyzeProgress }}</button>
          <button v-if="isAnalyzing" class="btn-danger btn-sm" @click="stopAnalyze">⏹ 停止</button>
          <button v-if="messages.length" class="btn-ghost" @click="clearAll">🗑️</button>
        </div>
      </div>
    </div>

    <div v-if="analyzeResult" class="analyze-toast" :class="analyzeResult.added ? 'ok' : 'err'">
      {{ analyzeResult.error || `✅ 分析完成：新增 ${analyzeResult.added} 个实体` }}
    </div>
    <div v-if="unanalyzedCount && !isAnalyzing" class="unanalyzed-banner">
      <span>⚠️ 有 {{ unanalyzedCount }} 章未分析，知识库可能不完整</span>
      <button class="btn-primary btn-sm" @click="analyzeAll">🔍 立即分析</button>
    </div>

    <div class="chat-area" ref="chatArea">
      <div v-if="!messages.length" class="chat-welcome">
        <div class="welcome-icon">🤖</div>
        <div class="welcome-title">随心记 Agent</div>
        <div class="welcome-hint">我可以查知识库、搜章节、答问题</div>
        <div class="welcome-examples">
          <button v-for="q in exampleQuestions" :key="q" class="example-chip" @click="askExample(q)">{{ q }}</button>
        </div>
      </div>

      <div v-for="(msg, i) in messages" :key="i" class="chat-message" :class="msg.role"
        @contextmenu.prevent.stop="openMsgMenu($event, i)">
        <div class="msg-avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
        <div class="msg-body">
          <div class="msg-content" v-html="renderContent(msg.content)"></div>
          <div v-if="msg.sources?.length" class="msg-sources">📖 {{ msg.sources.join(' · ') }}</div>
        </div>
      </div>

      <div v-if="isQuerying" class="chat-message assistant">
        <div class="msg-avatar">🤖</div>
        <div class="msg-body">
          <div class="msg-streaming">{{ streamingText || '思考中...' }}</div>
          <span class="typing-dot"></span>
        </div>
      </div>
      <div ref="chatEnd"></div>
    </div>

    <div class="chat-input-area">
      <div class="input-row">
        <input v-model="query" placeholder="问：主角什么修为？有哪些法宝？"
          @keyup.enter="ask" :disabled="isQuerying" ref="queryInput" />
        <button class="btn-primary" @click="ask" :disabled="isQuerying || !query.trim()">发送</button>
      </div>
    </div>

    <!-- 消息右键菜单 -->
    <ContextMenu
      :show="msgMenu.show"
      :x="msgMenu.x"
      :y="msgMenu.y"
      :items="[{ label: '删除', icon: '❌', action: 'delete', danger: true }]"
      @action="deleteMsg"
      @close="msgMenu.show = false"
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
  </div>
</template>

<script setup>
import { ref, computed, reactive, nextTick, onMounted, onUnmounted } from 'vue'
import { useProjectStore } from '../stores/project'
import { useSettingsStore } from '../stores/settings'
import { ENTITY_TYPE_NAMES, createEmptyEntities } from '../constants/entities'
import { parseJSON } from '../utils/parseAIJson'
import { AGENT_SYSTEM_PROMPT, CHAPTER_ANALYSIS_PROMPT } from '../constants/aiPrompts'
import ContextMenu from '../components/ContextMenu.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { marked } from 'marked'

const projectStore = useProjectStore()
const settingsStore = useSettingsStore()

const query = ref(''); const isQuerying = ref(false); const streamingText = ref('')
const chatArea = ref(null); const chatEnd = ref(null); const queryInput = ref(null)

const messages = computed({
  get: () => projectStore.currentProject?.chatMessages || [],
  set: (val) => { if (projectStore.currentProjectId) projectStore.updateProject(projectStore.currentProjectId, { chatMessages: val }) }
})

const exampleQuestions = ['主角什么修为？有哪些法宝？', '列出所有未收的伏笔', '最近三章发生了什么？', '作品中有哪些重要人物？']
function askExample(q) { query.value = q; ask() }

const msgMenu = reactive({ show: false, x: 0, y: 0, index: -1 })
function openMsgMenu(e, i) { msgMenu.x = e.clientX; msgMenu.y = e.clientY; msgMenu.index = i; msgMenu.show = true }
function closeMsgMenu() { msgMenu.show = false }
function deleteMsg() { if (msgMenu.index < 0) return; const l = [...messages.value]; l.splice(msgMenu.index, 1); messages.value = l; msgMenu.show = false }

const confirmDialog = reactive({ show: false, title: '', message: '', danger: false, okText: '确定', onOk: () => {} })
function clearAll() {
  Object.assign(confirmDialog, { show: true, title: '清空对话', message: '确定清空所有对话记录？', danger: true, okText: '清空', onOk: () => { messages.value = [] } })
}

// ========== AI 问答（简单模式：数据全给，直接答） ==========

const cachedContext = ref('')

function buildFullContext() {
  const proj = projectStore.currentProject
  if (!proj) return ''

  const lines = []
  const e = proj.entities || {}

  if (e.characters?.length) lines.push('## 人物\n' + e.characters.map(c => `- ${c.name}：${c.description||''} ${c.status ? '['+c.status+']' : ''} ${c.firstAppear ? '(首出场:'+c.firstAppear+')' : ''}`).join('\n'))
  if (e.settings?.length) lines.push('## 设定\n' + e.settings.map(s => `- ${s.name} [${s.category||'未分类'}]：${s.description||''}`).join('\n'))
  if (e.relationships?.length) lines.push('## 关系\n' + e.relationships.map(r => `- ${r.personA} → ${r.personB}：${r.relation||'未知关系'} ${r.since ? '(自'+r.since+')' : ''}`).join('\n'))
  if (e.foreshadows?.length) lines.push('## 伏笔\n' + e.foreshadows.map(f => `- [${f.status||'未收'}] ${f.content} ${f.plantedAt ? '(埋于'+f.plantedAt+')' : ''}`).join('\n'))
  if (e.events?.length) lines.push('## 事件\n' + e.events.slice(-10).map(ev => `- ${ev.name}：${ev.result||''} ${ev.chapter ? '(第'+ev.chapter+'章)' : ''}`).join('\n'))
  if (e.items?.length) lines.push('## 物品\n' + e.items.map(it => `- ${it.name} [${it.type||'物品'}] ${it.owner ? '持有者:'+it.owner : ''}：${it.description||''}`).join('\n'))
  if (e.powerRankings?.length) lines.push('## 战力\n' + e.powerRankings.map(p => `- ${p.name}：${p.level||'?'} ${p.power||''} ${p.source ? '(第'+p.source+'章)' : ''}`).join('\n'))
  if (e.powerSystem?.length) {
    const psLines = ['## 修炼体系']
    for (const ps of e.powerSystem) {
      psLines.push(`### ${ps.name || '未命名体系'}`)
      if (ps.description) psLines.push(ps.description)
      const stages = (ps.stages || []).sort((a, b) => (a.order || 0) - (b.order || 0))
      if (stages.length) psLines.push('境界：' + stages.map(s => `${s.name}${s.description ? '（' + s.description + '）' : ''}${s.requirements ? ' → 需' + s.requirements : ''}`).join(' → '))
    }
    lines.push(psLines.join('\n'))
  }
  if (e.chapterSummaries?.length) lines.push('## 章节摘要\n' + e.chapterSummaries.slice(-15).map(s => `- 第${s.chapter||'?'}章 ${s.title||''}：${s.summary||''}`).join('\n'))

  const chs = proj.chapters || []
  if (chs.length) lines.push('## 章节列表\n' + chs.map(c => `- 第${c.number}章 ${c.title} (${(c.content||'').length}字) ${c.analyzed?'✓':'⚠'}`).join('\n'))

  if (!lines.length) return '知识库为空，章节也不存在。'
  const result = lines.join('\n\n')
  cachedContext.value = result
  return result
}

async function ask() {
  const q = query.value.trim(); if (!q || isQuerying.value) return
  const list = messages.value ? [...messages.value] : []
  list.push({ role: 'user', content: q }); messages.value = list
  query.value = ''; isQuerying.value = true; streamingText.value = ''
  await nextTick(); scrollToBottom()

  try {
    const config = settingsStore.getAIConfig()
    const context = buildFullContext()
    let fullResponse = ''

    if (!window.electronAPI?.aiStream) {
      messages.value = [...list, { role: 'assistant', content: '❌ AI 服务不可用（electronAPI 未加载）' }]
      return
    }

    window.electronAPI?.onAIStreamChunk(chunk => {
      fullResponse += chunk; streamingText.value = fullResponse
      nextTick(scrollToBottom)
    })

    await window.electronAPI?.aiStream({
      ...config,
      messages: [
        { role: 'system', content: `${AGENT_SYSTEM_PROMPT}\n\n当前知识库：\n${context}` },
        ...list.slice(-10).map(m => ({ role: m.role, content: m.content }))
      ],
      maxTokens: 2048, temperature: 0.3
    })

    window.electronAPI?.removeAIStreamListener()
    messages.value = [...list, { role: 'assistant', content: fullResponse || '（无响应）', sources: extractSources(fullResponse) }]
  } catch (err) {
    window.electronAPI?.removeAIStreamListener()
    messages.value = [...list, { role: 'assistant', content: `❌ ${err.message}` }]
  } finally {
    isQuerying.value = false; streamingText.value = ''
    await nextTick(scrollToBottom)
  }
}

function extractSources(t) { return [...new Set((t?.match(/第\d+章/g)||[]))] }
function renderContent(t) { return t ? marked.parse(t) : '' }
function scrollToBottom() { chatEnd.value?.scrollIntoView({behavior:'smooth'}) }

function stopAnalyze() {
  stopRequested.value = true
}

// ========== 分析章节 ==========
const unanalyzedCount = computed(() => (projectStore.currentProject?.chapters||[]).filter(c=>!c.analyzed).length)
const isAnalyzing = ref(false); const analyzeProgress = ref(''); const analyzeResult = ref(null)
const stopRequested = ref(false)

async function analyzeAll() {
  const proj = projectStore.currentProject; if (!proj) return
  const chs = (proj.chapters||[]).filter(c=>!c.analyzed); if (!chs.length) return
  isAnalyzing.value = true; stopRequested.value = false; analyzeResult.value = null; let added = 0
  try {
    const config = settingsStore.getAIConfig()
    for (let i = 0; i < chs.length; i++) {
      if (stopRequested.value) break
      const ch = chs[i]; analyzeProgress.value = `${i+1}/${chs.length}`
      const text = (ch.content||'').trim(); if (!text||text.length<20) { ch.analyzed=true; continue }
      const result = await window.electronAPI?.aiRequest({...config, messages:[
        {role:'system',content: CHAPTER_ANALYSIS_PROMPT},
        {role:'user',content:`【${ch.title}】\n${text.slice(0,30000)}`}],maxTokens:8192,temperature:0.2})
      if (!result?.content) { console.warn('AI 返回空内容:', ch.title); continue }
      const entities = parseJSON(result.content, createEmptyEntities())
      for (const type of ENTITY_TYPE_NAMES) {
        if (!entities[type]?.length) continue
        for (const e of entities[type]) { projectStore.updateEntity(proj.id, type, e); added++ }
      }
      ch.analyzed = true
      await projectStore.updateProject(proj.id, { chapters: [...proj.chapters] })
    }
    analyzeResult.value = { added, stopped: stopRequested.value }
    setTimeout(()=>{analyzeResult.value=null},5000)
  } catch(err) { analyzeResult.value = { error: err.message }; setTimeout(()=>{analyzeResult.value=null},8000) }
  finally { isAnalyzing.value = false; analyzeProgress.value = '' }
}

onMounted(()=>{queryInput.value?.focus();document.addEventListener('click',()=>closeMsgMenu())})
onUnmounted(()=>document.removeEventListener('click',()=>closeMsgMenu()))
</script>

<style scoped>
.query-view{display:flex;flex-direction:column;height:100%}
.qv-header{padding:20px 24px 0;flex-shrink:0}
.qv-title-row{display:flex;justify-content:space-between;align-items:flex-start}
.qv-actions{display:flex;gap:8px;align-items:center}
.qv-header h2{margin:0 0 2px;font-size:var(--font-size-xl)}
.qv-desc{color:var(--text-muted);font-size:var(--font-size-sm);margin:0}
.btn-sm{padding:6px 14px;font-size:var(--font-size-sm)}
.spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:var(--accent);border-radius:50%;animation:spin .6s linear infinite}
.analyze-toast{margin:0 24px;padding:10px 16px;border-radius:var(--radius-md);font-size:var(--font-size-sm);animation:slideUp .2s ease}
.analyze-toast.ok{background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.2);color:var(--success)}
.analyze-toast.err{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:var(--error)}
.unanalyzed-banner{margin:0 24px 12px;padding:12px 16px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:var(--radius-md);color:var(--warning);font-size:var(--font-size-sm);display:flex;align-items:center;justify-content:space-between;gap:12px}
.chat-area{flex:1;overflow-y:auto;padding:20px 24px}
.chat-welcome{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;text-align:center}
.welcome-icon{font-size:48px;margin-bottom:12px}
.welcome-title{font-size:var(--font-size-lg);color:var(--text-primary);font-weight:600;margin-bottom:4px}
.welcome-hint{font-size:var(--font-size-sm);color:var(--text-muted);margin-bottom:20px}
.welcome-examples{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.example-chip{padding:6px 14px;background:var(--bg-card);border:1px solid var(--border);border-radius:99px;color:var(--text-secondary);font-size:var(--font-size-sm);cursor:pointer;transition:all var(--transition-fast)}
.example-chip:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-subtle)}
.chat-message{display:flex;gap:10px;margin-bottom:20px;animation:slideUp .2s ease}
.chat-message.user{flex-direction:row-reverse}
.msg-avatar{width:32px;height:32px;min-width:32px;display:flex;align-items:center;justify-content:center;background:var(--bg-card);border-radius:50%;font-size:16px}
.chat-message.user .msg-avatar{background:var(--accent-subtle)}
.msg-body{max-width:80%}
.msg-content{padding:10px 16px;border-radius:var(--radius-lg);font-size:var(--font-size-base);line-height:1.65;word-break:break-word}
.msg-content :deep(p){margin:0 0 8px}.msg-content :deep(p:last-child){margin:0}
.chat-message.user .msg-content{background:linear-gradient(135deg,var(--accent),#5a52d6);color:#fff;border-bottom-right-radius:4px}
.chat-message.assistant .msg-content{background:var(--bg-card);border:1px solid var(--border);color:var(--text-primary);border-bottom-left-radius:4px}
.msg-sources{font-size:var(--font-size-xs);color:var(--text-muted);margin-top:4px;padding-left:4px}
.msg-streaming{padding:10px 16px;background:var(--bg-card);border:1px solid var(--accent);border-radius:var(--radius-lg);border-bottom-left-radius:4px;color:var(--text-primary);font-size:var(--font-size-base);line-height:1.65;white-space:pre-wrap;animation:fadeIn .15s ease}
.typing-dot{display:inline-block;width:6px;height:6px;background:var(--accent);border-radius:50%;margin-left:4px;animation:pulse 1s infinite;vertical-align:middle}
.chat-input-area{padding:14px 24px;border-top:1px solid var(--border);background:var(--bg-surface);flex-shrink:0}
.input-row{display:flex;gap:8px;align-items:center}
.input-row input{flex:1;padding:10px 16px;font-size:var(--font-size-base)}
</style>
