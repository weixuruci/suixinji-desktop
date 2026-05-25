<template>
  <div class="writing-asst" :class="{ embedded: props.embedded, standalone: !props.embedded }">
    <div class="wa-header">
      <h3>✍️ 写作辅助</h3>
      <button v-if="props.embedded" class="btn-ghost" @click="$emit('close')">✕</button>
    </div>

    <div class="wa-tabs">
      <button class="wa-tab" :class="{ active: tab === 'naming' }" @click="tab = 'naming'">🏷️ 起名</button>
      <button class="wa-tab" :class="{ active: tab === 'continue' }" @click="tab = 'continue'">📝 续写</button>
      <button class="wa-tab" :class="{ active: tab === 'outline' }" @click="tab = 'outline'">📋 大纲</button>
      <button class="wa-tab" :class="{ active: tab === 'saved' }" @click="tab = 'saved'">💾 已保存</button>
    </div>

    <!-- 起名工具 -->
    <div v-if="tab === 'naming'" class="wa-body">
      <div class="wa-form">
        <div class="form-row">
          <label>世界观 / 风格</label>
          <input v-model="naming.worldStyle" placeholder="仙侠、都市、玄幻、西幻..." />
        </div>
        <div class="form-row">
          <label>性别倾向</label>
          <select v-model="naming.gender">
            <option value="">不限</option><option value="男">男</option><option value="女">女</option>
          </select>
        </div>
        <div class="form-row">
          <label>生成数量</label>
          <select v-model="naming.count">
            <option :value="3">3个</option><option :value="5">5个</option><option :value="10">10个</option>
          </select>
        </div>
        <div class="form-row">
          <label>附加要求（可选）</label>
          <input v-model="naming.extra" placeholder="如：带云字、道家风格..." />
        </div>
        <button class="btn-primary" @click="doNaming" :disabled="namingLoading">
          {{ namingLoading ? '生成中...' : '🎲 生成名字' }}
        </button>
      </div>

      <div v-if="namingResults.length" class="name-list">
        <div v-for="(name, i) in namingResults" :key="i" class="name-card" :class="{ dup: name.duplicate }">
          <span class="name-text">{{ name.name }}</span>
          <span v-if="name.duplicate" class="dup-badge">⚠ 重名</span>
          <span v-else class="ok-badge">✓</span>
          <span class="name-desc">{{ name.meaning || '' }}</span>
          <button class="btn-sm-save" @click="saveName(name)" :disabled="name.saved">{{ name.saved ? '✓' : '💾' }}</button>
        </div>
      </div>
    </div>

    <!-- 续写建议 -->
    <div v-if="tab === 'continue'" class="wa-body">
      <div class="wa-form">
        <div class="form-row">
          <label>续写起点（可选）</label>
          <input v-model="continueInput.from" placeholder="如：第89章结尾，主角刚突破..." />
        </div>
        <div class="form-row">
          <label>续写方向（可选）</label>
          <select v-model="continueInput.direction">
            <option value="">不限</option>
            <option value="战斗">战斗场面</option>
            <option value="感情">感情发展</option>
            <option value="探险">探险奇遇</option>
            <option value="阴谋">阴谋揭露</option>
            <option value="突破">突破升级</option>
          </select>
        </div>
        <button class="btn-primary" @click="doContinue" :disabled="continueLoading">
          {{ continueLoading ? '生成中...' : '💡 获取续写建议' }}
        </button>
      </div>
      <div v-if="continueResult" class="result-card" v-html="renderMd(continueResult)"></div>
      <button v-if="continueResult" class="btn-primary" style="margin-top:10px;width:100%" @click="saveAsset('续写建议', continueResult, 'continue')">💾 保存</button>
    </div>

    <!-- 大纲辅助 -->
    <div v-if="tab === 'outline'" class="wa-body">
      <div v-if="!foreshadowCount" class="empty-state">
        <div class="icon">🎯</div><div class="title">还没有伏笔数据</div>
        <div class="desc">AI 分析章节后会自动检测伏笔</div>
      </div>
      <template v-else>
        <p class="wa-hint">当前有 {{ foreshadowCount }} 个伏笔（{{ unresolvedCount }} 个未收），AI 将基于这些伏笔生成收线建议。</p>
        <button class="btn-primary" @click="doOutline" :disabled="outlineLoading">
          {{ outlineLoading ? '生成中...' : '📋 生成大纲建议' }}
        </button>
        <div v-if="outlineResult" class="result-card" v-html="renderMd(outlineResult)"></div>
        <button v-if="outlineResult" class="btn-primary" style="margin-top:10px;width:100%" @click="saveAsset('大纲建议', outlineResult, 'outline')">💾 保存</button>
      </template>
    </div>

    <!-- 已保存 -->
    <div v-if="tab === 'saved'" class="wa-body">
      <div v-if="!savedAssets.length" class="empty-state">
        <div class="icon">💾</div><div class="title">还没有保存的内容</div>
        <div class="desc">在起名/续写/大纲生成后点 💾 保存</div>
      </div>
      <div v-for="a in savedAssets" :key="a.id" class="saved-card">
        <div class="saved-header">
          <span class="saved-cat">{{ catLabel(a.category) }}</span>
          <strong>{{ a.title }}</strong>
          <span class="saved-time">{{ fmtDate(a.createdAt) }}</span>
          <button class="btn-sm-del" @click="deleteAsset(a)">🗑</button>
        </div>
        <div class="saved-body" v-html="renderMd(a.content)"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useProjectStore } from '../stores/project'
import { useSettingsStore } from '../stores/settings'
import { marked } from 'marked'

const projectStore = useProjectStore()
const settingsStore = useSettingsStore()
const emit = defineEmits(['close'])
const props = defineProps({ embedded: { type: Boolean, default: true } })
const tab = ref('naming')

// ---- 保存 ----
const savedAssets = computed(() => projectStore.currentProject?.entities?.writingNotes || [])

function saveAsset(title, content, category) {
  if (!projectStore.currentProject) return
  projectStore.updateEntity(projectStore.currentProject.id, 'writingNotes', {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
    title, content, category, createdAt: new Date().toISOString()
  })
}

function saveName(item) {
  saveAsset(item.name, `含义：${item.meaning || '无'}`, 'naming')
  item.saved = true
}

function deleteAsset(a) {
  if (!projectStore.currentProject) return
  projectStore.removeEntity(projectStore.currentProject.id, 'writingNotes', a.id)
}

function catLabel(cat) {
  const map = { naming: '🏷️ 起名', continue: '📝 续写', outline: '📋 大纲' }
  return map[cat] || '📝'
}

function fmtDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// ---- 起名 ----
const naming = ref({ worldStyle: '', gender: '', count: 5, extra: '' })
const namingLoading = ref(false)
const namingResults = ref([])

async function doNaming() {
  const config = settingsStore.getAIConfig()
  if (!config.apiKey) { alert('请先配置 API Key'); return }
  namingLoading.value = true
  namingResults.value = []
  try {
    const existingNames = (projectStore.currentProject?.entities?.characters || []).map(c => c.name).filter(Boolean)
    const prompt = `生成${naming.value.count}个${naming.value.gender || ''}性中文名字，世界观：${naming.value.worldStyle || '通用'}。${naming.value.extra ? '要求：' + naming.value.extra : ''}
格式：每行一个名字，名字后加冒号和简短含义。只输出名字列表。`
    const result = await window.electronAPI?.aiRequest({ ...config, messages: [{ role: 'user', content: prompt }], maxTokens: 512, temperature: 0.8 })
    const lines = (result?.content || '').split('\n').filter(Boolean)
    namingResults.value = lines.map(line => {
      const [name, ...rest] = line.replace(/^\d+[\.\、\s]+/, '').split(/[：:]/)
      const cleanName = name?.trim().replace(/[\*\#\-\s]/g, '') || line.trim()
      return {
        name: cleanName,
        meaning: rest.join(':').trim(),
        duplicate: existingNames.includes(cleanName)
      }
    })
  } catch (err) { alert('生成失败：' + err.message) }
  finally { namingLoading.value = false }
}

// ---- 续写 ----
const continueInput = ref({ from: '', direction: '' })
const continueLoading = ref(false)
const continueResult = ref('')

async function doContinue() {
  const config = settingsStore.getAIConfig()
  if (!config.apiKey) { alert('请先配置 API Key'); return }
  continueLoading.value = true; continueResult.value = ''
  try {
    const prompt = buildContinuePrompt()
    const result = await window.electronAPI?.aiRequest({ ...config, messages: [{ role: 'user', content: prompt }], maxTokens: 1024, temperature: 0.7 })
    continueResult.value = result?.content || '无响应'
  } catch (err) { alert('生成失败：' + err.message) }
  finally { continueLoading.value = false }
}

function buildContinuePrompt() {
  const proj = projectStore.currentProject
  const parts = []
  if (proj?.name) parts.push(`作品：《${proj.name}》`)

  const chs = proj?.chapters || []
  if (chs.length) parts.push(`已写${chs.length}章，最新章：${chs[chs.length-1]?.title || '无'}`)

  const e = proj?.entities || {}
  if (e.characters?.length) parts.push('主要人物：' + e.characters.slice(0, 8).map(c => `${c.name}(${c.status||'存活'})`).join('、'))
  if (e.foreshadows?.length) parts.push('未收伏笔：' + e.foreshadows.filter(f => f.status !== '已收').slice(0, 5).map(f => f.content).join('；'))
  if (e.chapterSummaries?.length) parts.push('近期摘要：' + e.chapterSummaries.slice(-3).map(s => s.summary).join(' '))

  let prompt = `你是网文写作顾问。基于以下信息，给出3条续写建议。\n${parts.join('\n')}`
  if (continueInput.value.from) prompt += `\n续写起点：${continueInput.value.from}`
  if (continueInput.value.direction) prompt += `\n偏好方向：${continueInput.value.direction}`
  prompt += '\n每条建议包含：方向标题 + 1-2句话说明。用markdown格式，简洁。'
  return prompt
}

// ---- 大纲 ----
const outlineLoading = ref(false)
const outlineResult = ref('')
const foreshadows = computed(() => projectStore.currentProject?.entities?.foreshadows || [])
const foreshadowCount = computed(() => foreshadows.value.length)
const unresolvedCount = computed(() => foreshadows.value.filter(f => f.status !== '已收' && f.status !== 'resolved').length)

async function doOutline() {
  const config = settingsStore.getAIConfig()
  if (!config.apiKey) { alert('请先配置 API Key'); return }
  outlineLoading.value = true; outlineResult.value = ''
  try {
    const proj = projectStore.currentProject
    const unresolved = foreshadows.value.filter(f => f.status !== '已收' && f.status !== 'resolved')
    const resolved = foreshadows.value.filter(f => f.status === '已收' || f.status === 'resolved')

    let prompt = `你是网文大纲顾问。基于以下伏笔信息，规划收线顺序和剧情大纲。\n`

    if (proj?.name) prompt += `作品：《${proj.name}》\n`
    if (unresolved.length) {
      prompt += `\n未收伏笔（${unresolved.length}个）：\n`
      prompt += unresolved.map((f, i) => `${i+1}. ${f.content}（第${f.plantedAt||'?'}章埋）`).join('\n')
    }
    if (resolved.length) {
      prompt += `\n已收伏笔（${resolved.length}个）：\n`
      prompt += resolved.map(f => `- ${f.content}`).join('\n')
    }

    prompt += '\n请给出：1) 收线优先级排序 2) 每条伏笔建议收束章节范围 3) 可能的剧情节点。简洁，用编号。'

    const result = await window.electronAPI?.aiRequest({ ...config, messages: [{ role: 'user', content: prompt }], maxTokens: 1024, temperature: 0.5 })
    outlineResult.value = result?.content || '无响应'
  } catch (err) { alert('生成失败：' + err.message) }
  finally { outlineLoading.value = false }
}

function renderMd(text) { return text ? marked.parse(text) : '' }
</script>

<style scoped>
.writing-asst.embedded {
  position: fixed; top: 40px; right: 0; width: 420px; height: calc(100vh - 40px);
  background: var(--bg-elevated); border-left: 1px solid var(--border);
  display: flex; flex-direction: column; z-index: 50;
  box-shadow: var(--shadow-lg); animation: slideIn 0.2s ease;
}
.writing-asst.standalone {
  height: 100%; display: flex; flex-direction: column; padding: 0 24px;
  background: transparent;
}
.wa-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 0; margin-bottom: 8px;
}
.wa-header h3 { margin: 0; font-size: var(--font-size-lg); font-weight: 700; }
.wa-tabs {
  display: flex; gap: 4px; border-bottom: 1px solid var(--border);
  padding-bottom: 0; margin-bottom: 20px;
}
.wa-tab {
  padding: 10px 18px; background: transparent; border: none; border-bottom: 2px solid transparent;
  color: var(--text-muted); font-size: var(--font-size-base); cursor: pointer;
  transition: all var(--transition-fast); border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  font-weight: 500;
}
.wa-tab:hover { color: var(--text-primary); background: var(--bg-hover); }
.wa-tab.active { color: var(--accent); border-bottom-color: var(--accent); background: var(--accent-subtle); }
.wa-body { flex: 1; overflow-y: auto; padding: 4px 0 24px; }
.wa-form { margin-bottom: 24px; max-width: 560px; }
.form-row { margin-bottom: 14px; }
.form-row label { display: block; font-size: var(--font-size-sm); color: var(--text-secondary); margin-bottom: 6px; font-weight: 500; }
.form-row input, .form-row select {
  width: 100%; padding: 10px 14px; font-size: var(--font-size-base);
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-md); color: var(--text-primary);
  font-family: inherit; transition: border-color var(--transition-fast);
}
.form-row input:focus, .form-row select:focus {
  border-color: var(--accent); outline: none; box-shadow: 0 0 0 3px var(--accent-subtle);
}
.wa-hint { font-size: var(--font-size-sm); color: var(--text-secondary); margin-bottom: 16px; line-height: 1.6; }

.name-list { display: grid; gap: 8px; }
.name-card {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-md); font-size: var(--font-size-base);
  transition: border-color var(--transition-fast);
}
.name-card:hover { border-color: var(--accent); }
.name-card.dup { border-color: var(--warning); background: rgba(245,158,11,.06); }
.name-text { font-weight: 700; color: var(--accent); min-width: 70px; font-size: var(--font-size-md); }
.name-desc { font-size: var(--font-size-sm); color: var(--text-secondary); flex: 1; }
.dup-badge { font-size: var(--font-size-xs); color: var(--warning); font-weight: 600; }
.ok-badge { font-size: var(--font-size-xs); color: var(--success); font-weight: 600; }
.btn-sm-save {
  padding: 4px 10px; font-size: 13px; background: var(--accent-subtle);
  border: 1px solid var(--accent); border-radius: var(--radius-sm); cursor: pointer;
  color: var(--accent); font-weight: 600; transition: all var(--transition-fast);
}
.btn-sm-save:hover { background: var(--accent); color: #fff; }
.btn-sm-save:disabled { opacity: 0.3; cursor: default; background: transparent; border-color: var(--border); color: var(--text-muted); }

.result-card {
  margin-top: 16px; padding: 20px; background: var(--bg-card);
  border: 1px solid var(--border); border-radius: var(--radius-lg);
  font-size: var(--font-size-base); line-height: 1.8; color: var(--text-primary);
}
.result-card :deep(h3) { margin: 14px 0 8px; font-size: var(--font-size-base); color: var(--accent); }
.result-card :deep(ul) { padding-left: 20px; margin: 8px 0; }
.result-card :deep(li) { margin-bottom: 6px; }
.result-card :deep(strong) { color: var(--accent); }

.saved-card { margin-bottom:14px; padding:16px 20px; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg); }
.saved-card:hover { border-color:var(--accent); }
.saved-header { display:flex; align-items:center; gap:10px; margin-bottom:10px; font-size:var(--font-size-sm); }
.saved-cat { font-size:var(--font-size-xs); color:var(--accent); background:var(--accent-subtle); padding:2px 8px; border-radius:99px; font-weight:600; }
.saved-time { font-size:var(--font-size-xs); color:var(--text-muted); margin-left:auto; }
.saved-body { font-size:var(--font-size-sm); line-height:1.8; color:var(--text-secondary); }
.saved-body :deep(h3) { margin:8px 0 6px; font-size:var(--font-size-sm); color:var(--text-primary); }
.btn-sm-del { padding:4px 8px; font-size:13px; background:transparent; border:none; color:var(--text-muted); cursor:pointer; border-radius:var(--radius-sm); }
.btn-sm-del:hover { color:var(--error); background:rgba(239,68,68,.08); }

.empty-state { text-align:center; padding:60px 20px; color:var(--text-muted); }
.empty-state .icon { font-size:48px; margin-bottom:12px; opacity:0.6; }
.empty-state .title { font-size:var(--font-size-md); margin-bottom:6px; font-weight:600; color: var(--text-secondary); }
.empty-state .desc { font-size:var(--font-size-sm); }

.btn-primary { display:inline-flex; align-items:center; gap:6px; }
</style>
