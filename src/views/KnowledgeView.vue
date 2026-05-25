<template>
  <div class="knowledge-view">
    <div class="k-header">
      <div class="k-title">
        <h2>📖 知识库</h2>
        <span class="k-stats" v-if="totalEntities">{{ totalEntities }} 个实体</span>
      </div>
      <div class="k-search">
        <input v-model="searchQuery" placeholder="搜索实体..." />
      </div>
    </div>

    <!-- 类型标签栏 -->
    <div class="k-tabs">
      <button
        v-for="tab in entityTabs"
        :key="tab.type"
        class="k-tab"
        :class="{ active: activeTab === tab.type }"
        @click="activeTab = tab.type"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
        <span class="tab-count">{{ getEntities(tab.type).length }}</span>
      </button>
    </div>

    <!-- 撤销提示 -->
    <div v-if="undoEntry" class="undo-bar">
      <span>已删除「{{ undoEntry.entity?.name || undoEntry.entity?.title || '(未命名)' }}」</span>
      <button class="btn-ghost undo-btn" @click="doUndo">↩ 撤销</button>
      <button class="btn-ghost undo-close" @click="undoEntry = null">✕</button>
    </div>

    <!-- 标签筛选 -->
    <div v-if="allTags.length" class="tag-filter">
      <button
        v-for="tag in allTags" :key="tag"
        class="tag-chip" :class="{ active: tagFilter === tag }"
        @click="tagFilter = tagFilter === tag ? null : tag"
      >{{ tag }}</button>
    </div>

    <!-- 实体网格 -->
    <div class="k-grid">
      <div
        v-for="entity in filteredEntities"
        :key="entity.id"
        class="k-card card interactive"
        @click="openEditor(entity)"
      >
        <div class="k-card-header">
          <div class="k-card-type-badge">{{ activeTabLabel }}</div>
          <button class="btn-icon danger" @click.stop="deleteEntity(entity)" title="删除">✕</button>
        </div>
        <div class="k-card-body">
          <div class="entity-name">{{ entity.name || entity.title || entity.content || '(未命名)' }}</div>
          <div class="entity-summary" v-if="activeTab !== 'powerSystem'">{{ getEntitySummary(entity) }}</div>
          <div v-else class="entity-summary">
            <span v-for="(s,i) in (entity.stages||[]).slice(0,3)" :key="i" class="stage-chip">{{ s.name }}</span>
            <span v-if="(entity.stages||[]).length > 3" class="stage-chip">+{{ entity.stages.length - 3 }}</span>
          </div>
        </div>
        <div class="k-card-footer" v-if="getEntityTags(entity).length">
          <span v-for="tag in getEntityTags(entity).slice(0, 4)" :key="tag" class="badge">{{ tag }}</span>
          <span v-if="getEntityTags(entity).length > 4" class="badge">+{{ getEntityTags(entity).length - 4 }}</span>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="!filteredEntities.length" class="empty-state" style="grid-column: 1/-1">
        <div class="icon">🔍</div>
        <div class="title" v-if="searchQuery">没有找到匹配的实体</div>
        <div class="title" v-else>还没有{{ activeTabLabel }}</div>
        <div class="desc">上传章节后 AI 会自动提取实体信息</div>
      </div>
    </div>

    <!-- 实体编辑对话框 -->
    <div v-if="editing" class="dialog-overlay" @click.self="closeEditor">
      <div class="dialog dialog-large">
        <h3>{{ editing.id ? '编辑' : '新增' }}{{ activeTabLabel }}</h3>
        <p class="dialog-desc">{{ editing.name || editing.title || '(未命名)' }}</p>

        <div class="editor-form">
          <!-- 通用标签 -->
          <div class="form-row">
            <label>标签（逗号分隔，如：主角, 反派阵营）</label>
            <input v-model="tagsInput" @change="syncTags" placeholder="输入标签..." />
          </div>

          <!-- 人物 characters -->
          <template v-if="activeTab === 'characters'">
            <div class="form-row">
              <label>姓名</label>
              <input v-model="editing.name" />
            </div>
            <div class="form-row">
              <label>别名（逗号分隔）</label>
              <input v-model="aliasInput" @change="syncAliases" />
            </div>
            <div class="form-row">
              <label>外貌/性格描述</label>
              <textarea v-model="editing.description" rows="2"></textarea>
            </div>
            <div class="form-row">
              <label>当前状态</label>
              <input v-model="editing.status" placeholder="正常 / 受伤 / 失踪 / 已死亡 ..." />
            </div>
            <div class="form-row">
              <label>首次出场章节</label>
              <input v-model="editing.firstAppear" placeholder="第1章" />
            </div>
            <div class="form-row">
              <label>备注</label>
              <textarea v-model="editing.notes" rows="2"></textarea>
            </div>
          </template>

          <!-- 设定 settings -->
          <template v-else-if="activeTab === 'settings'">
            <div class="form-row">
              <label>设定名称</label>
              <input v-model="editing.name" />
            </div>
            <div class="form-row">
              <label>类别</label>
              <select v-model="editing.category">
                <option value="">未分类</option>
                <option value="功法">功法</option>
                <option value="势力">势力</option>
                <option value="地理">地理</option>
                <option value="货币">货币</option>
                <option value="种族">种族</option>
                <option value="法则">法则</option>
                <option value="其他">其他</option>
              </select>
            </div>
            <div class="form-row">
              <label>详细说明</label>
              <textarea v-model="editing.description" rows="4"></textarea>
            </div>
            <div class="form-row">
              <label>备注</label>
              <textarea v-model="editing.notes" rows="2"></textarea>
            </div>
          </template>

          <!-- 关系 relationships -->
          <template v-else-if="activeTab === 'relationships'">
            <div class="form-row">
              <label>人物 A</label>
              <input v-model="editing.personA" />
            </div>
            <div class="form-row">
              <label>人物 B</label>
              <input v-model="editing.personB" />
            </div>
            <div class="form-row">
              <label>关系类型</label>
              <select v-model="editing.relation">
                <option value="">未指定</option>
                <option value="师徒">师徒</option>
                <option value="父子/母子">父子/母子</option>
                <option value="兄弟">兄弟</option>
                <option value="朋友">朋友</option>
                <option value="恋人">恋人</option>
                <option value="仇敌">仇敌</option>
                <option value="盟友">盟友</option>
                <option value="从属">从属</option>
                <option value="对手">对手</option>
                <option value="陌路">陌路</option>
              </select>
            </div>
            <div class="form-row">
              <label>起始章节</label>
              <input v-model="editing.since" />
            </div>
            <div class="form-row">
              <label>备注</label>
              <textarea v-model="editing.notes" rows="2"></textarea>
            </div>
          </template>

          <!-- 伏笔 foreshadows -->
          <template v-else-if="activeTab === 'foreshadows'">
            <div class="form-row">
              <label>伏笔内容</label>
              <textarea v-model="editing.content" rows="3"></textarea>
            </div>
            <div class="form-row">
              <label>埋设章节</label>
              <input v-model="editing.plantedAt" />
            </div>
            <div class="form-row">
              <label>回收状态</label>
              <select v-model="editing.status">
                <option value="未收">未收</option>
                <option value="已收">已收</option>
              </select>
            </div>
            <div class="form-row">
              <label>备注</label>
              <textarea v-model="editing.notes" rows="2"></textarea>
            </div>
          </template>

          <!-- 事件 events -->
          <template v-else-if="activeTab === 'events'">
            <div class="form-row">
              <label>事件名称</label>
              <input v-model="editing.name" />
            </div>
            <div class="form-row">
              <label>时间点</label>
              <input v-model="editing.time" />
            </div>
            <div class="form-row">
              <label>地点</label>
              <input v-model="editing.location" />
            </div>
            <div class="form-row">
              <label>参与人物（逗号分隔）</label>
              <input v-model="participantsInput" @change="syncParticipants" />
            </div>
            <div class="form-row">
              <label>结果</label>
              <textarea v-model="editing.result" rows="2"></textarea>
            </div>
            <div class="form-row">
              <label>出处章节</label>
              <input v-model="editing.chapter" />
            </div>
          </template>

          <!-- 物品 items -->
          <template v-else-if="activeTab === 'items'">
            <div class="form-row">
              <label>物品名称</label>
              <input v-model="editing.name" />
            </div>
            <div class="form-row">
              <label>类型</label>
              <select v-model="editing.type">
                <option value="">未分类</option>
                <option value="武器">武器</option>
                <option value="法宝">法宝</option>
                <option value="丹药">丹药</option>
                <option value="功法秘籍">功法秘籍</option>
                <option value="材料">材料</option>
                <option value="灵药">灵药</option>
                <option value="其他">其他</option>
              </select>
            </div>
            <div class="form-row">
              <label>持有者</label>
              <input v-model="editing.owner" />
            </div>
            <div class="form-row">
              <label>描述</label>
              <textarea v-model="editing.description" rows="3"></textarea>
            </div>
            <div class="form-row">
              <label>备注</label>
              <textarea v-model="editing.notes" rows="2"></textarea>
            </div>
          </template>

          <!-- 战力 powerRankings -->
          <template v-else-if="activeTab === 'powerRankings'">
            <div class="form-row">
              <label>人物名</label>
              <input v-model="editing.name" />
            </div>
            <div class="form-row">
              <label>境界/等级</label>
              <input v-model="editing.level" placeholder="金丹期 / 化神境 / S级 ..." />
            </div>
            <div class="form-row">
              <label>战力描述</label>
              <textarea v-model="editing.power" rows="2"></textarea>
            </div>
            <div class="form-row">
              <label>出处章节</label>
              <input v-model="editing.source" />
            </div>
            <div class="form-row">
              <label>备注</label>
              <textarea v-model="editing.notes" rows="2"></textarea>
            </div>
          </template>

          <!-- 摘要 chapterSummaries -->
          <template v-else-if="activeTab === 'chapterSummaries'">
            <div class="form-row">
              <label>章节号</label>
              <input v-model="editing.chapter" />
            </div>
            <div class="form-row">
              <label>标题</label>
              <input v-model="editing.title" />
            </div>
            <div class="form-row">
              <label>摘要（200字以内）</label>
              <textarea v-model="editing.summary" rows="3"></textarea>
            </div>
            <div class="form-row">
              <label>关键事件（逗号分隔）</label>
              <input v-model="keyEventsInput" @change="syncKeyEvents" />
            </div>
            <div class="form-row">
              <label>新增重要实体（逗号分隔）</label>
              <input v-model="newEntitiesInput" @change="syncNewEntities" />
            </div>
          </template>

          <!-- 修炼体系 powerSystem -->
          <template v-else-if="activeTab === 'powerSystem'">
            <div class="form-row">
              <label>体系名称</label>
              <input v-model="editing.name" placeholder="修仙体系 / 异能等级 ..." />
            </div>
            <div class="form-row">
              <label>体系说明</label>
              <textarea v-model="editing.description" rows="2"></textarea>
            </div>
            <div class="form-row">
              <label>境界划分</label>
              <div v-for="(s, si) in editing.stages" :key="si" class="stage-row">
                <input v-model="s.order" type="number" class="stage-order" placeholder="序" />
                <input v-model="s.name" class="stage-name" placeholder="境界名" />
                <input v-model="s.description" class="stage-desc" placeholder="描述" />
                <input v-model="s.requirements" class="stage-req" placeholder="突破条件" />
                <button class="btn-icon danger" @click="editing.stages.splice(si,1)">✕</button>
              </div>
              <button class="btn-secondary btn-sm" style="margin-top:6px" @click="addStage">+ 添加境界</button>
            </div>
          </template>

          <!-- 写作笔记 writingNotes -->
          <template v-else-if="activeTab === 'writingNotes'">
            <div class="form-row">
              <label>标题</label>
              <input v-model="editing.title" />
            </div>
            <div class="form-row">
              <label>分类</label>
              <select v-model="editing.category">
                <option value="naming">起名</option>
                <option value="continue">续写</option>
                <option value="outline">大纲</option>
              </select>
            </div>
            <div class="form-row">
              <label>内容</label>
              <textarea v-model="editing.content" rows="8"></textarea>
            </div>
          </template>

          <!-- 切换 JSON 编辑 -->
          <details class="raw-editor">
            <summary class="btn-ghost" style="font-size:12px">🔧 JSON 原始数据</summary>
            <textarea v-model="editingJSON" rows="8" class="json-area"></textarea>
            <button class="btn-ghost" @click="applyJSON" style="margin-top:6px">从 JSON 更新</button>
          </details>
        </div>

        <div class="dialog-actions">
          <button class="btn-secondary" @click="closeEditor">取消</button>
          <button class="btn-primary" @click="saveEdit">保存</button>
        </div>
      </div>
    </div>

    <!-- 删除确认 -->
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
import { ref, reactive, computed, watch, watchEffect, nextTick } from 'vue'
import { useProjectStore } from '../stores/project'
import { useKnowledgeStore } from '../stores/knowledge'
import { ENTITY_TYPE_LABEL_MAP, ENTITY_TYPE_PLAIN_MAP, ENTITY_TYPES, createEmptyEntities, getEntitySummary as getSummary, getEntityTags as getTags, buildSearchText } from '../constants/entities'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const projectStore = useProjectStore()
const knowledgeStore = useKnowledgeStore()
const undoEntry = ref(null)  // { entity, type, timer }
let undoTimer = null
const activeTab = ref('characters')
const searchQuery = ref('')
const editing = ref(null)
const editingJSON = ref('')

// 辅助输入字段（用于数组类型字段的双向绑定）
const aliasInput = ref('')
const participantsInput = ref('')
const keyEventsInput = ref('')
const newEntitiesInput = ref('')
const tagsInput = ref('')
const tagFilter = ref(null)

const entityTabs = ENTITY_TYPES

const activeTabLabel = computed(() =>
  entityTabs.find(t => t.type === activeTab.value)?.label || ''
)

const totalEntities = computed(() => {
  const e = projectStore.currentProject?.entities
  if (!e) return 0
  let count = 0
  for (const t of entityTabs) count += (e[t.type]?.length || 0)
  return count
})

function getEntities(type) {
  return projectStore.currentProject?.entities?.[type] || []
}

const allTags = computed(() => {
  const tags = new Set()
  for (const t of entityTabs) {
    for (const e of (projectStore.currentProject?.entities?.[t.type] || [])) {
      if (e.tags) e.tags.forEach(tag => tags.add(tag))
    }
  }
  return [...tags].sort()
})

const filteredEntities = computed(() => {
  let list = getEntities(activeTab.value)
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(e => buildSearchText(e, activeTab.value).includes(q))
  }
  if (tagFilter.value) {
    list = list.filter(e => e.tags?.includes(tagFilter.value))
  }
  return list
})

function getEntitySummary(entity) { return getSummary(entity, activeTab.value) }

function getEntityTags(entity) { return getTags(entity) }

// ---- 编辑器 ----
function openEditor(entity) {
  editing.value = JSON.parse(JSON.stringify(entity))
  if (!editing.value.id) editing.value.id = `${activeTab.value}_${Date.now()}`

  // 同步数组字段到辅助 input
  aliasInput.value = (entity.aliases || []).join(', ')
  participantsInput.value = (entity.participants || []).join(', ')
  keyEventsInput.value = (entity.keyEvents || []).join(', ')
  newEntitiesInput.value = (entity.newEntities || []).join(', ')
  tagsInput.value = (entity.tags || []).join(', ')

  editingJSON.value = JSON.stringify(entity, null, 2)
}

function closeEditor() {
  editing.value = null
}

function syncAliases() {
  if (editing.value) editing.value.aliases = aliasInput.value.split(',').map(s => s.trim()).filter(Boolean)
}
function syncParticipants() {
  if (editing.value) editing.value.participants = participantsInput.value.split(',').map(s => s.trim()).filter(Boolean)
}
function syncKeyEvents() {
  if (editing.value) editing.value.keyEvents = keyEventsInput.value.split(',').map(s => s.trim()).filter(Boolean)
}
function syncNewEntities() {
  if (editing.value) editing.value.newEntities = newEntitiesInput.value.split(',').map(s => s.trim()).filter(Boolean)
}
function syncTags() {
  if (editing.value) editing.value.tags = tagsInput.value.split(',').map(s => s.trim()).filter(Boolean)
}

function addStage() {
  if (!editing.value) return
  if (!editing.value.stages) editing.value.stages = []
  editing.value.stages.push({ name: '', order: editing.value.stages.length + 1, description: '', requirements: '' })
}

function applyJSON() {
  try {
    const parsed = JSON.parse(editingJSON.value)
    editing.value = parsed
    aliasInput.value = (parsed.aliases || []).join(', ')
    participantsInput.value = (parsed.participants || []).join(', ')
    keyEventsInput.value = (parsed.keyEvents || []).join(', ')
    newEntitiesInput.value = (parsed.newEntities || []).join(', ')
  } catch (err) {
    alert('JSON 格式错误: ' + err.message)
  }
}

function saveEdit() {
  const entity = editing.value
  // 确保数组字段已同步
  syncAliases(); syncParticipants(); syncKeyEvents(); syncNewEntities(); syncTags()

  // 清理 _confirmed 等脏数据
  const clean = { ...entity }
  delete clean._confirmed
  delete clean.__v_isRef

  projectStore.updateEntity(projectStore.currentProjectId, activeTab.value, clean)
  editing.value = null
}

function deleteEntity(entity) {
  pendingDelete.value = entity
  confirmDialog.show = true
}

const pendingDelete = ref(null)
const confirmDialog = reactive({ show: false, title: '删除实体', message: '', danger: true, okText: '删除', onOk: () => {} })

// 初始化确认对话框（每次 deleteEntity 触发前更新 message）
confirmDialog.onOk = () => {
  if (pendingDelete.value) {
    const entity = JSON.parse(JSON.stringify(pendingDelete.value))
    undoEntry.value = { entity, type: activeTab.value }
    clearTimeout(undoTimer)
    undoTimer = setTimeout(() => { undoEntry.value = null }, 8000)
    projectStore.removeEntity(projectStore.currentProjectId, activeTab.value, pendingDelete.value.id)
    pendingDelete.value = null
    confirmDialog.show = false
  }
}

function doUndo() {
  if (!undoEntry.value) return
  const { entity, type } = undoEntry.value
  projectStore.updateEntity(projectStore.currentProjectId, type, entity)
  undoEntry.value = null
  clearTimeout(undoTimer)
}
watchEffect(() => {
  if (pendingDelete.value) {
    confirmDialog.message = `确定删除「${pendingDelete.value.name || pendingDelete.value.title || pendingDelete.value.content || '(未命名)'}」？`
  }
})

// 切换 tab 时关闭编辑器
watch(activeTab, () => { editing.value = null })
</script>

<style scoped>
.knowledge-view {
  padding: 24px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.k-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.k-title h2 {
  margin: 0;
  font-size: var(--font-size-xl);
  display: inline;
}
.k-stats {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  margin-left: 12px;
}
.k-search input {
  width: 220px;
  padding: 8px 14px;
  font-size: var(--font-size-sm);
}

/* Tabs */
.k-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.k-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: var(--font-size-sm);
  white-space: nowrap;
  transition: all var(--transition-fast);
}
.k-tab:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}
.k-tab.active {
  background: var(--accent-subtle);
  border-color: var(--accent);
  color: var(--accent);
}
.tab-icon { font-size: 15px; }
.tab-count {
  font-size: var(--font-size-xs);
  background: var(--bg-hover);
  padding: 1px 6px;
  border-radius: 99px;
}
.k-tab.active .tab-count {
  background: var(--accent);
  color: var(--text-inverse);
}

/* Undo bar */
.undo-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding: 8px 14px;
  background: var(--accent-subtle);
  border: 1px solid var(--accent);
  border-radius: var(--radius-md);
  color: var(--accent);
  font-size: var(--font-size-sm);
  animation: slideUp 0.2s ease;
}
.undo-btn {
  color: var(--accent) !important;
  font-weight: 600;
  padding: 4px 10px !important;
}
.undo-close {
  margin-left: auto;
  opacity: 0.5;
}

/* Tag filter */
.tag-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}
.tag-chip {
  padding: 4px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 99px;
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.tag-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.tag-chip.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

/* Grid */
.k-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
  align-content: start;
}

/* Cards */
.k-card {
  display: flex;
  flex-direction: column;
  padding: 14px;
}
.k-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.k-card-type-badge {
  font-size: var(--font-size-xs);
  color: var(--accent);
  background: var(--accent-subtle);
  padding: 2px 8px;
  border-radius: 99px;
  font-weight: 500;
}
.k-card-body {
  flex: 1;
}
.entity-name {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
  line-height: 1.3;
}
.entity-summary {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.k-card-footer {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

/* Editor form */
.editor-form {
  max-height: 50vh;
  overflow-y: auto;
  padding-right: 4px;
}
.form-row {
  margin-bottom: 14px;
}
.form-row label {
  display: block;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-bottom: 5px;
  font-weight: 500;
}
.form-row input,
.form-row textarea,
.form-row select {
  width: 100%;
}

.raw-editor {
  margin-top: 16px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}
.raw-editor summary {
  color: var(--text-muted);
  cursor: pointer;
  list-style: none;
}
.json-area {
  width: 100%;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  padding: 10px;
  outline: none;
  margin-top: 8px;
  resize: vertical;
}
.stage-row { display:flex; gap:6px; margin-bottom:6px; align-items:center; }
.stage-order { width:40px; }
.stage-name { width:100px; }
.stage-desc { flex:1; }
.stage-req { flex:1; }
.stage-chip {
  display:inline-block; padding:2px 8px; margin:2px; background:var(--accent-subtle);
  color:var(--accent); border-radius:99px; font-size:var(--font-size-xs); font-weight:600;
}
</style>
