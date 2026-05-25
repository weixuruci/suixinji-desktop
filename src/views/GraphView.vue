<template>
  <div class="graph-view">
    <div class="gv-header">
      <h2>🕸️ 图谱</h2>
      <div class="gv-tabs">
        <button class="gv-tab" :class="{ active: mode === 'relation' }" @click="mode = 'relation'">🔗 关系</button>
        <button class="gv-tab" :class="{ active: mode === 'power' }" @click="mode = 'power'">💪 战力</button>
        <button class="gv-tab" :class="{ active: mode === 'cultivation' }" @click="mode = 'cultivation'">⬆️ 修炼</button>
        <button class="gv-tab" :class="{ active: mode === 'foreshadow' }" @click="mode = 'foreshadow'">🎯 伏笔 ({{ foreshadows.length }})</button>
      </div>
    </div>

    <!-- 关系图谱 -->
    <div v-if="mode === 'relation'" class="gv-content">
      <div v-if="!hasRelations" class="empty-state">
        <div class="icon">🔗</div><div class="title">还没有人物和关系数据</div>
        <div class="desc">上传章节后点「全部分析」自动提取人物关系</div>
      </div>
      <div v-else class="gv-split">
        <div class="gv-chart-wrap">
          <div class="gv-toolbar">
            <input v-model="relSearch" class="gv-search" placeholder="🔍 搜索角色..." @input="onRelSearch" />
            <select v-model="relTypeFilter" class="gv-filter" @change="onRelSearch">
              <option value="">全部关系</option>
              <option v-for="rt in relTypes" :key="rt" :value="rt">{{ rt }}</option>
            </select>
            <span class="gv-summary">{{ visibleNodes.length }}角色 · {{ visibleLinks.length }}关系</span>
          </div>
          <v-chart v-if="visibleNodes.length" :option="relationOption" autoresize class="echart" @click="onNodeClick" />
          <div v-else class="empty-state" style="padding:40px"><div class="desc">没有匹配的角色</div></div>
        </div>
        <div v-if="selectedChar" class="gv-detail">
          <div class="detail-header">
            <h3 :style="{color: getColor(charIndex(selectedChar.name), characters.length)}">{{ selectedChar.name }}</h3>
            <button class="btn-ghost" @click="selectedChar = null">✕</button>
          </div>
          <div class="detail-body">
            <div v-if="selectedChar.status" class="detail-row"><span class="dl">状态</span>{{ selectedChar.status }}</div>
            <div v-if="charLevel(selectedChar.name)" class="detail-row"><span class="dl">境界</span><span class="dl-val-accent">{{ charLevel(selectedChar.name) }}</span></div>
            <div v-if="selectedChar.description" class="detail-row"><span class="dl">描述</span>{{ selectedChar.description }}</div>
            <div v-if="selectedChar.firstAppear" class="detail-row"><span class="dl">出场</span>第{{ selectedChar.firstAppear }}章</div>
            <div v-if="charRels(selectedChar.name).length" class="detail-section">
              <div class="ds-title">关联 ({{ charRels(selectedChar.name).length }})</div>
              <div v-for="r in charRels(selectedChar.name)" :key="r.id" class="detail-rel">
                {{ r.personA }} → {{ r.personB }}：<strong>{{ r.relation }}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 战力排行 -->
    <div v-if="mode === 'power'" class="gv-content">
      <div v-if="!powerList.length" class="empty-state">
        <div class="icon">💪</div><div class="title">还没有战力数据</div>
        <div class="desc">上传章节后点「全部分析」自动提取战力排行</div>
      </div>
      <div v-else class="power-ladder">
        <div class="pl-tier" v-for="(tier, ti) in powerTiers" :key="ti" :style="{borderLeftColor: tierColor(ti)}">
          <div class="pl-tier-label" :style="{color: tierColor(ti)}">{{ tier.label }}</div>
          <div class="pl-tier-chars">
            <div v-for="p in tier.chars" :key="p.name" class="pl-char-card">
              <span class="pl-char-name">{{ p.name }}</span>
              <span v-if="p.power" class="pl-char-power">{{ p.power }}</span>
            </div>
            <div v-if="!tier.chars.length" class="pl-empty">暂无此境界角色</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 修炼体系 -->
    <div v-if="mode === 'cultivation'" class="gv-content">
      <div v-if="!powerSystems.length" class="empty-state">
        <div class="icon">⬆️</div><div class="title">还没有修炼体系数据</div>
        <div class="desc">重新分析章节后 AI 会提取修炼境界体系</div>
      </div>
      <div v-else class="cultivation-view">
        <div v-for="ps in powerSystems" :key="ps.id" class="cv-system">
          <h3>{{ ps.name || '修炼体系' }}</h3>
          <p v-if="ps.description" class="cv-desc">{{ ps.description }}</p>
          <div class="cv-stages">
            <div v-for="s in sortedStages(ps)" :key="s.name" class="cv-stage">
              <div class="cv-stage-num">{{ s.order || '?' }}</div>
              <div class="cv-stage-info">
                <strong>{{ s.name }}</strong>
                <span v-if="s.description" class="cv-stage-desc">{{ s.description }}</span>
                <span v-if="s.requirements" class="cv-stage-req">突破条件：{{ s.requirements }}</span>
              </div>
              <div class="cv-stage-chars">
                <span v-for="name in charsAtStage(s.name)" :key="name" class="cv-char-tag">{{ name }}</span>
                <span v-if="!charsAtStage(s.name).length" class="cv-no-char">—</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 伏笔看板 -->
    <div v-if="mode === 'foreshadow'" class="gv-content">
      <div v-if="!foreshadows.length" class="empty-state">
        <div class="icon">🎯</div><div class="title">还没有伏笔数据</div>
      </div>
      <div v-else class="foreshadow-board">
        <div class="fb-column">
          <div class="fb-col-header unresolved">🔴 未收 ({{ unresolved.length }})</div>
          <div v-for="f in unresolved" :key="f.id" class="fb-card" @click="markResolved(f)">
            <div class="fb-content">{{ f.content }}</div>
            <div class="fb-meta">第{{ f.plantedAt || '?' }}章 · 点击标记已收</div>
          </div>
        </div>
        <div class="fb-column">
          <div class="fb-col-header resolved">🟢 已收 ({{ resolved.length }})</div>
          <div v-for="f in resolved" :key="f.id" class="fb-card resolved-card" @click="markUnresolved(f)">
            <div class="fb-content">{{ f.content }}</div>
            <div class="fb-meta">第{{ f.plantedAt || '?' }}章 → 第{{ f.resolvedAt || '?' }}章 · 点击撤销</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { use } from 'echarts/core'
import { GraphChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { useProjectStore } from '../stores/project'

use([GraphChart, TooltipComponent, CanvasRenderer])

const projectStore = useProjectStore()
const mode = ref('relation')
const selectedChar = ref(null)
const relSearch = ref('')
const relTypeFilter = ref('')

const characters = computed(() => projectStore.currentProject?.entities?.characters || [])
const relationships = computed(() => projectStore.currentProject?.entities?.relationships || [])
const hasRelations = computed(() => characters.value.length > 0)
const powerSystems = computed(() => projectStore.currentProject?.entities?.powerSystem || [])

// 关系图谱 —— 搜索与筛选
const relTypes = computed(() => [...new Set(relationships.value.map(r => r.relation).filter(Boolean))])

const filteredRelations = computed(() => {
  let rels = relationships.value
  if (relTypeFilter.value) rels = rels.filter(r => r.relation === relTypeFilter.value)
  return rels
})

const visibleNodes = computed(() => {
  const q = relSearch.value.trim().toLowerCase()
  if (!q && !relTypeFilter.value) return characters.value
  const relSet = new Set()
  for (const r of filteredRelations.value) { relSet.add(r.personA || r.from); relSet.add(r.personB || r.to) }
  let chars = characters.value.filter(c => relSet.has(c.name))
  if (q) chars = chars.filter(c => c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q))
  return chars
})

const visibleLinks = computed(() => {
  const nameSet = new Set(visibleNodes.value.map(c => c.name))
  return filteredRelations.value.filter(r => {
    const a = r.personA || r.from; const b = r.personB || r.to
    return nameSet.has(a) && nameSet.has(b)
  })
})

function onRelSearch() {}

const relationOption = computed(() => {
  const nodes = visibleNodes.value
  const links = visibleLinks.value
  const charNameSet = new Set(nodes.map(c => c.name))
  const connCount = {}
  for (const l of links) { connCount[l.personA] = (connCount[l.personA] || 0) + 1; connCount[l.personB] = (connCount[l.personB] || 0) + 1 }

  const nodeData = nodes.map((c, i) => ({
    id: c.id, name: c.name, category: 0,
    symbolSize: Math.max(32, Math.min(65, 30 + (connCount[c.name] || 0) * 8)),
    itemStyle: { color: getColor(i, nodes.length) },
    tooltip: { formatter: () => `<b>${c.name}</b><br/>${c.status || ''} ${charLevel(c.name) || ''}` }
  }))

  const linkData = links.map(r => {
    const a = r.personA || r.from; const b = r.personB || r.to
    const aNode = nodes.find(c => c.name === a); const bNode = nodes.find(c => c.name === b)
    return {
      source: aNode?.id || a, target: bNode?.id || b,
      label: { show: true, formatter: r.relation || '?', fontSize: 13, fontWeight: 'bold',
        color: '#000' }
    }
  })

  return {
    tooltip: {},
    legend: { show: false },
    animationDuration: 600,
    series: [{
      type: 'graph', layout: 'force', roam: true, draggable: true,
      force: { repulsion: 400, edgeLength: [80, 220], gravity: 0.06 },
      data: nodeData, links: linkData,
      label: { show: true, position: 'right', fontSize: 14, fontWeight: 'bold',
        color: '#000' },
      lineStyle: { curveness: 0.25, opacity: 0.65, width: 1.5,
        color: isDark.value ? undefined : '#aaa' },
      edgeSymbol: ['none', 'none']
    }]
  }
})

function getColor(i, total) {
  const colors = ['#7c6ff7','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#06b6d4']
  return colors[i % colors.length]
}

function onNodeClick(params) {
  if (params.dataType === 'node') {
    selectedChar.value = characters.value.find(c => c.name === params.name) || null
  }
}

function charLevel(name) {
  const powers = projectStore.currentProject?.entities?.powerRankings || []
  return powers.find(p => p.name === name)?.level || characters.value.find(c => c.name === name)?.level || ''
}

function charRels(name) {
  return relationships.value.filter(r => r.personA === name || r.personB === name)
}

function charIndex(name) {
  return characters.value.findIndex(c => c.name === name)
}

// ---- 战力阶梯 ----
const isDark = computed(() => {
  if (typeof window === 'undefined') return true
  return getComputedStyle(document.documentElement).getPropertyValue('--bg-deep').trim() !== '#f5f5f8'
})

const powerList = computed(() => {
  const powers = projectStore.currentProject?.entities?.powerRankings || []
  return powers.map(p => ({ name: p.name, level: p.level || '?', power: p.power || '' }))
})

const powerTiers = computed(() => {
  const stages = []
  // 优先使用修炼体系数据
  const sys = powerSystems.value[0]
  if (sys?.stages?.length) {
    for (const s of sortedStages(sys)) {
      stages.push({ label: s.name, chars: powerList.value.filter(p => (p.level || '').includes(s.name)) })
    }
  } else {
    // 按默认境界分组
    const order = ['大乘','渡劫','化神','元婴','金丹','筑基','练气','凡人']
    const grouped = {}
    for (const p of powerList.value) {
      const tier = order.find(l => (p.level || '').includes(l)) || '其他'
      if (!grouped[tier]) grouped[tier] = []
      grouped[tier].push(p)
    }
    for (const l of order) {
      if (grouped[l]) stages.push({ label: l, chars: grouped[l] })
    }
    if (grouped['其他']) stages.push({ label: '其他', chars: grouped['其他'] })
  }
  return stages
})

function tierColor(i) {
  const colors = ['#ef4444','#f59e0b','#fbbf24','#10b981','#3b82f6','#8b5cf6','#7c6ff7','#a78bfa']
  return colors[i % colors.length]
}

// ---- 修炼体系 ----
function sortedStages(ps) {
  return (ps.stages || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0))
}

function charsAtStage(stageName) {
  return powerList.value.filter(p => (p.level || '').includes(stageName)).map(p => p.name)
}

// ---- 伏笔 ----
const foreshadows = computed(() => projectStore.currentProject?.entities?.foreshadows || [])
const unresolved = computed(() => foreshadows.value.filter(f => f.status !== '已收' && f.status !== 'resolved'))
const resolved = computed(() => foreshadows.value.filter(f => f.status === '已收' || f.status === 'resolved'))

function markResolved(f) {
  const sid = projectStore.currentProject?.id
  if (sid) projectStore.updateEntity(sid, 'foreshadows', { ...f, status: '已收', resolvedAt: String(Date.now()) })
}

function markUnresolved(f) {
  const sid = projectStore.currentProject?.id
  if (sid) projectStore.updateEntity(sid, 'foreshadows', { ...f, status: '未收', resolvedAt: '' })
}
</script>

<style scoped>
.graph-view { height:100%; display:flex; flex-direction:column; padding:20px 24px; overflow:hidden; }
.gv-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-shrink:0; }
.gv-header h2 { margin:0; font-size:var(--font-size-xl); }
.gv-tabs { display:flex; gap:4px; }
.gv-tab {
  padding:6px 14px; background:var(--bg-card); border:1px solid var(--border);
  border-radius:var(--radius-md); color:var(--text-muted); font-size:var(--font-size-sm);
  cursor:pointer; transition:all var(--transition-fast);
}
.gv-tab:hover { border-color:var(--accent); color:var(--text-primary); }
.gv-tab.active { background:var(--accent-subtle); border-color:var(--accent); color:var(--accent); }
.gv-content { flex:1; overflow:hidden; }

/* Toolbar */
.gv-toolbar { display:flex; gap:8px; align-items:center; padding-bottom:10px; flex-shrink:0; }
.gv-search {
  width:180px; padding:6px 10px; font-size:var(--font-size-sm); font-family:inherit;
  background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md);
  color:var(--text-primary);
}
.gv-search:focus { border-color:var(--accent); outline:none; }
.gv-filter {
  padding:6px 8px; font-size:var(--font-size-sm);
  background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md);
  color:var(--text-primary);
}
.gv-summary { font-size:var(--font-size-xs); color:var(--text-muted); margin-left:auto; }

.gv-split { display:flex; gap:16px; height:100%; }
.gv-chart-wrap { flex:1; display:flex; flex-direction:column; min-width:0; }
.echart { flex:1; min-width:0; }
.gv-detail {
  width:260px; min-width:260px; background:var(--bg-card); border:1px solid var(--border);
  border-radius:var(--radius-lg); padding:16px; overflow-y:auto;
}
.detail-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
.detail-header h3 { margin:0; font-size:var(--font-size-lg); }
.detail-body { font-size:var(--font-size-sm); }
.detail-row { margin-bottom:8px; line-height:1.5; color:var(--text-secondary); }
.dl { font-weight:600; color:var(--text-primary); margin-right:8px; }
.dl-val-accent { color:var(--accent); font-weight:600; }
.detail-section { margin-top:12px; padding-top:12px; border-top:1px solid var(--border); }
.ds-title { font-size:var(--font-size-xs); color:var(--text-muted); font-weight:600; margin-bottom:6px; }
.detail-rel { font-size:var(--font-size-xs); color:var(--text-secondary); padding:3px 0; }
.btn-ghost { background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:16px; }
.btn-ghost:hover { color:var(--error); }

/* Power Ladder */
.power-ladder { overflow-y:auto; height:100%; display:flex; flex-direction:column; gap:0; }
.pl-tier {
  border-left:3px solid; padding:10px 0 10px 20px; margin-left:8px;
  position:relative;
}
.pl-tier::before {
  content:''; position:absolute; left:-7px; top:18px; width:10px; height:10px;
  border-radius:50%; background:inherit; border:2px solid currentColor;
}
.pl-tier-label { font-size:var(--font-size-md); font-weight:700; margin-bottom:8px; }
.pl-tier-chars { display:flex; flex-wrap:wrap; gap:8px; }
.pl-char-card {
  padding:8px 14px; background:var(--bg-card); border:1px solid var(--border);
  border-radius:var(--radius-md); display:flex; flex-direction:column; gap:2px;
  min-width:100px;
}
.pl-char-name { font-size:var(--font-size-sm); font-weight:600; color:var(--text-primary); }
.pl-char-power { font-size:var(--font-size-xs); color:var(--text-secondary); }
.pl-empty { font-size:var(--font-size-xs); color:var(--text-muted); padding:4px 0; }

/* Cultivation */
.cultivation-view { overflow-y:auto; height:100%; }
.cv-system { margin-bottom:24px; }
.cv-system h3 { font-size:var(--font-size-lg); margin:0 0 6px; color:var(--accent); }
.cv-desc { font-size:var(--font-size-sm); color:var(--text-secondary); margin:0 0 16px; }
.cv-stages { display:flex; flex-direction:column; gap:8px; }
.cv-stage {
  display:flex; align-items:center; gap:14px; padding:12px 16px;
  background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md);
}
.cv-stage-num { width:28px;height:28px;min-width:28px;display:flex;align-items:center;justify-content:center;
  background:var(--accent);color:#fff;border-radius:50%;font-size:var(--font-size-xs);font-weight:700; }
.cv-stage-info { flex:1;display:flex;flex-direction:column;gap:2px; }
.cv-stage-info strong { font-size:var(--font-size-base);color:var(--text-primary); }
.cv-stage-desc { font-size:var(--font-size-xs);color:var(--text-secondary); }
.cv-stage-req { font-size:var(--font-size-xs);color:var(--warning); }
.cv-stage-chars { display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;min-width:100px; }
.cv-char-tag { font-size:var(--font-size-xs);padding:2px 8px;background:var(--accent-subtle);color:var(--accent);border-radius:99px;font-weight:600; }
.cv-no-char { font-size:var(--font-size-xs);color:var(--text-muted); }

/* Foreshadow */
.foreshadow-board { display:flex; gap:16px; height:100%; overflow-y:auto; }
.fb-column { flex:1; display:flex; flex-direction:column; }
.fb-col-header { font-size:var(--font-size-sm); font-weight:600; padding:8px 12px; border-radius:var(--radius-md); margin-bottom:10px; }
.fb-col-header.unresolved { background:rgba(239,68,68,.08); color:var(--error); border:1px solid rgba(239,68,68,.2); }
.fb-col-header.resolved { background:rgba(16,185,129,.08); color:var(--success); border:1px solid rgba(16,185,129,.2); }
.fb-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:12px; margin-bottom:8px; cursor:pointer; }
.fb-card:hover { border-color:var(--accent); }
.fb-content { font-size:var(--font-size-sm); color:var(--text-primary); margin-bottom:6px; line-height:1.4; }
.fb-meta { font-size:var(--font-size-xs); color:var(--text-muted); }
</style>
