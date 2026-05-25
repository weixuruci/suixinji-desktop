<template>
  <div class="settings-view">
    <div class="sv-header">
      <h2>⚙️ 设置</h2>
      <button class="btn-ghost" @click="$router.back()">← 返回</button>
    </div>

    <div class="sv-content">
      <!-- AI 提供商 -->
      <div class="sv-section">
        <h3>🤖 AI 提供商</h3>
        <div class="provider-list">
          <div
            v-for="p in providers"
            :key="p.id"
            class="provider-card"
            :class="{ active: activeProviderId === p.id }"
            @click="selectProvider(p.id)"
          >
            <div class="pv-icon">{{ providerIcon(p.id) }}</div>
            <div class="pv-info">
              <div class="pv-name">{{ p.name }}</div>
              <div class="pv-model">{{ p.models[0] }}</div>
            </div>
            <div v-if="p.apiKey" class="pv-status" title="已配置 API Key">✓</div>
          </div>
        </div>
      </div>

      <!-- API Key -->
      <div class="sv-section">
        <h3>🔑 API Key</h3>
        <div class="key-row">
          <div class="key-input-wrap">
            <input
              :type="showKey ? 'text' : 'password'"
              v-model="apiKeyInput"
              :placeholder="`${activeProvider.name} API Key`"
              @keyup.enter="saveKey"
            />
          </div>
          <button class="btn-ghost" @click="showKey = !showKey">
            {{ showKey ? '🙈 隐藏' : '👁 显示' }}
          </button>
          <button class="btn-primary btn-sm" @click="saveKey">保存</button>
          <button class="btn-secondary btn-sm" @click="testKey">测试连接</button>
        </div>
        <div v-if="testResult" class="test-result" :class="testResult.ok ? 'ok' : 'err'">
          {{ testResult.ok ? '✅ ' : '❌ ' }}{{ testResult.msg }}
        </div>
      </div>

      <!-- 本地模型配置 -->
      <div class="sv-section" v-if="activeProviderId === 'local'">
        <h3>🏠 本地服务地址</h3>
        <div class="key-row">
          <div class="key-input-wrap">
            <input v-model="localURL" placeholder="http://localhost:11434/v1" @keyup.enter="saveLocalURL" />
          </div>
          <button class="btn-primary btn-sm" @click="saveLocalURL">保存</button>
        </div>
        <p class="sv-hint">默认 Ollama 地址。支持任何 OpenAI 兼容 API。</p>

        <h3 style="margin-top:18px">📝 模型名称</h3>
        <div class="key-row">
          <div class="key-input-wrap">
            <input v-model="newLocalModel" placeholder="输入模型名，如 qwen3:14b" @keyup.enter="addLocalModel" />
          </div>
          <button class="btn-primary btn-sm" @click="addLocalModel">添加</button>
        </div>
        <div v-if="activeProvider.models.length" class="model-tags">
          <span v-for="(m, i) in activeProvider.models" :key="m" class="model-tag">
            {{ m }} <button class="tag-remove" @click="removeLocalModel(i)">×</button>
          </span>
        </div>
      </div>

      <!-- 模型选择 -->
      <div class="sv-section">
        <h3>🎯 模型</h3>
        <select v-model="activeModel" @change="onModelChange" class="model-select">
          <option v-for="m in activeProvider.models" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>

      <!-- 外观 -->
      <div class="sv-section">
        <h3>🎨 外观</h3>
        <div class="theme-switcher">
          <button class="theme-btn" :class="{ active: theme === 'dark' }" @click="theme = 'dark'">
            <span class="theme-icon">🌙</span> <span>暗色</span>
          </button>
          <button class="theme-btn" :class="{ active: theme === 'light' }" @click="theme = 'light'">
            <span class="theme-icon">☀️</span> <span>亮色</span>
          </button>
          <button class="theme-btn" :class="{ active: theme === 'green' }" @click="theme = 'green'">
            <span class="theme-icon">🌿</span> <span>绿色</span>
          </button>
          <button class="theme-btn" :class="{ active: theme === 'pink' }" @click="theme = 'pink'">
            <span class="theme-icon">🌸</span> <span>粉色</span>
          </button>
        </div>
      </div>

      <!-- 数据管理 -->
      <div class="sv-section">
        <h3>💾 数据</h3>
        <div class="data-actions">
          <button class="btn-secondary" @click="exportData">📤 导出知识库</button>
          <button class="btn-secondary" @click="importData">📥 导入知识库</button>
          <button class="btn-danger" @click="clearAllData">🗑 清除所有数据</button>
        </div>
      </div>
    </div>

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
import { ref, computed, reactive, onMounted } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useProjectStore } from '../stores/project'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const store = useSettingsStore()
const projectStore = useProjectStore()

const providers = computed(() => store.providers)
const activeProviderId = computed(() => store.activeProviderId)
const activeProvider = computed(() => store.activeProvider)
const activeModel = computed({
  get: () => store.activeModel,
  set: v => store.setActiveModel(v)
})
const theme = computed({
  get: () => store.theme,
  set: v => { store.theme = v; store.saveSettings() }
})

const apiKeyInput = ref('')
const showKey = ref(false)
const testResult = ref(null)
const localURL = ref('')
const newLocalModel = ref('')

function providerIcon(id) {
  const icons = { deepseek: '🔷', openai: '🟢', claude: '🟣', qwen: '🌐', local: '🏠' }
  return icons[id] || '🤖'
}

onMounted(() => {
  store.loadSettings()
  apiKeyInput.value = activeProvider.value?.apiKey || ''
})

function selectProvider(id) {
  store.setActiveProvider(id)
  apiKeyInput.value = store.activeProvider?.apiKey || ''
  localURL.value = store.activeProvider?.baseURL || ''
  testResult.value = null
}

function saveKey() {
  store.setApiKey(activeProviderId.value, apiKeyInput.value.trim())
  testResult.value = { ok: true, msg: '已保存' }
}

function saveLocalURL() {
  if (!localURL.value.trim()) return
  const p = store.providers.find(pp => pp.id === 'local')
  if (p) { p.baseURL = localURL.value.trim(); store.saveSettings() }
  testResult.value = { ok: true, msg: '地址已保存' }
}

function addLocalModel() {
  if (!newLocalModel.value.trim()) return
  const p = store.providers.find(pp => pp.id === 'local')
  if (p && !p.models.includes(newLocalModel.value.trim())) {
    p.models.push(newLocalModel.value.trim())
    store.saveSettings()
  }
  newLocalModel.value = ''
}

function removeLocalModel(index) {
  const p = store.providers.find(pp => pp.id === 'local')
  if (p) { p.models.splice(index, 1); store.saveSettings() }
}

async function testKey() {
  testResult.value = { ok: false, msg: '测试中...' }
  try {
    const config = store.getAIConfig()
    if (!config.apiKey) throw new Error('请先填入 API Key')
    const result = await window.electronAPI?.aiRequest({
      ...config,
      messages: [{ role: 'user', content: '你好' }],
      maxTokens: 100
    })
    if (result?.content) {
      testResult.value = { ok: true, msg: `成功！响应：${result.content.slice(0, 50)}` }
    } else {
      testResult.value = { ok: false, msg: '无响应内容' }
    }
  } catch (err) {
    testResult.value = { ok: false, msg: err.message }
  }
}

function onModelChange() { store.saveSettings() }

async function exportData() {
  // 导出全部数据：设置 + 所有作品
  const exportObj = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    settings: JSON.parse(JSON.stringify(store.$state)),
    projects: JSON.parse(JSON.stringify(projectStore.projects))
  }
  const json = JSON.stringify(exportObj, null, 2)

  // Electron 下用原生保存对话框
  if (window.electronAPI?.fileWrite) {
    try {
      const userDataPath = await window.electronAPI.getUserDataPath()
      const filename = `suixinji-backup-${new Date().toISOString().slice(0, 10)}.json`
      // 用 file-dialog 让用户选保存路径
      const result = await window.electronAPI.fileDialogSave?.({
        defaultPath: filename,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (result?.filePath) {
        await window.electronAPI.fileWrite(result.filePath, json)
        return
      }
    } catch {}
  }

  // 浏览器 fallback
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `suixinji-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importData() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // 恢复设置
      if (data.settings?.providers) {
        for (const saved of data.settings.providers) {
          const p = store.providers.find(pp => pp.id === saved.id)
          if (p && saved.apiKey) p.apiKey = saved.apiKey
        }
        if (data.settings.activeProviderId) store.activeProviderId = data.settings.activeProviderId
        if (data.settings.activeModel) store.activeModel = data.settings.activeModel
        if (data.settings.theme) store.theme = data.settings.theme
        store.saveSettings()
      }

      // 恢复作品
      if (data.projects?.length) {
        projectStore.projects = data.projects
        await projectStore.saveProjects()
      }

      location.reload()
    } catch (err) {
      alert('导入失败：' + err.message)
    }
  }
  input.click()
}

const confirmDialog = reactive({ show: false, title: '', message: '', danger: false, okText: '确定', onOk: () => {} })

function clearAllData() {
  confirmDialog.title = '清除所有数据'
  confirmDialog.message = '确定要清除所有数据吗？此操作不可恢复！'
  confirmDialog.danger = true
  confirmDialog.okText = '清除全部'
  confirmDialog.onOk = () => { localStorage.clear(); location.reload() }
  confirmDialog.show = true
}

// ====== 云同步相关函数已移除 ======
</script>

<style scoped>
.settings-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.sv-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 0;
  flex-shrink: 0;
}
.sv-header h2 { margin: 0; font-size: var(--font-size-xl); }
.sv-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 24px 32px;
  max-width: 640px;
}

.sv-section {
  margin-top: 28px;
}
.sv-section h3 {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 14px;
}

/* Providers */
.provider-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}
.provider-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.provider-card:hover { border-color: var(--accent); }
.provider-card.active {
  border-color: var(--accent);
  background: var(--accent-subtle);
}
.pv-icon { font-size: 20px; }
.pv-info { flex: 1; min-width: 0; }
.pv-name {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}
.pv-model {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
}
.pv-status {
  width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center;
  background: var(--success);
  color: #000;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
}

/* Key */
.key-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.key-input-wrap { flex: 1; }
.key-input-wrap input {
  width: 100%;
}
.btn-sm { padding: 8px 14px; font-size: var(--font-size-sm); }

.test-result {
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  margin-top: 10px;
}
.test-result.ok {
  background: rgba(74, 222, 128, 0.08);
  border: 1px solid rgba(74, 222, 128, 0.2);
  color: var(--success);
}
.test-result.err {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: var(--error);
}

/* Model */
.model-select {
  width: 100%;
}

/* Theme */
.theme-switcher {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.theme-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.theme-btn:hover { border-color: var(--accent); }
.theme-btn.active {
  border-color: var(--accent);
  background: var(--accent-subtle);
  color: var(--accent);
}
.theme-icon { font-size: 24px; }

.sv-hint { font-size: var(--font-size-xs); color: var(--text-muted); margin: 8px 0 0; }
.model-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.model-tag {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; background: var(--bg-card); border: 1px solid var(--border);
  border-radius: 99px; font-size: var(--font-size-sm); color: var(--text-secondary);
}
.tag-remove {
  background: none; border: none; color: var(--text-muted);
  cursor: pointer; font-size: 14px; padding: 0 2px; line-height: 1;
}
.tag-remove:hover { color: var(--error); }

/* Data */
.data-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.cloud-project-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; background: var(--bg-card);
  border: 1px solid var(--border); border-radius: var(--radius-md);
  margin-bottom: 6px;
}
.cloud-project-name { flex: 1; font-size: var(--font-size-sm); color: var(--text-primary); }
.cloud-project-ver { font-size: var(--font-size-xs); color: var(--text-muted); }
</style>
