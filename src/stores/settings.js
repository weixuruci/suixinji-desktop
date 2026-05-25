import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * 设置 Store — AI 提供商配置、API Key（加密存储）、通用设置
 */
export const useSettingsStore = defineStore('settings', () => {
  // ---------- AI 提供商配置 ----------
  const providers = ref([
    { id: 'deepseek', name: 'DeepSeek',  baseURL: 'https://api.deepseek.com',                     models: ['deepseek-v4-flash', 'deepseek-v4-pro'], apiKey: '' },
    { id: 'openai',   name: 'OpenAI',    baseURL: 'https://api.openai.com/v1',                     models: ['gpt-4o', 'gpt-4o-mini'], apiKey: '' },
    { id: 'claude',   name: 'Claude',    baseURL: 'https://api.anthropic.com/v1',                  models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250514'], apiKey: '' },
    { id: 'qwen',     name: '通义千问',  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-max', 'qwen-plus', 'qwen-turbo'], apiKey: '' },
    { id: 'local',    name: '本地模型',  baseURL: 'http://localhost:11434/v1',                     models: ['qwen3:14b', 'qwen3:32b', 'deepseek-r1:8b', 'deepseek-r1:14b', 'llama3:8b'], apiKey: '' }
  ])

  const activeProviderId = ref('deepseek')
  const activeModel = ref('deepseek-v4-flash')

  // ---------- 分析设置 ----------
  const analysisMode = ref('single')
  const rangeSize = ref(10)
  const conflictDetection = ref(false)
  const spellCheck = ref(false)

  // ---------- 外观设置 ----------
  const theme = ref('light')
  const fontSize = ref(14)

  // ---------- getters ----------
  const activeProvider = computed(() =>
    providers.value.find(p => p.id === activeProviderId.value) || providers.value[0]
  )

  const hasApiKey = computed(() =>
    !!activeProvider.value?.apiKey
  )

  // ---------- actions ----------
  async function loadSettings() {
    const saved = localStorage.getItem('suixinji_settings')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        if (data.providers) {
          for (const saved of data.providers) {
            const p = providers.value.find(pp => pp.id === saved.id)
            if (p && saved.apiKeyEncrypted) {
              // 解密 API Key
              try {
                p.apiKey = await window.electronAPI?.decryptKey(saved.apiKeyEncrypted) || ''
              } catch {
                p.apiKey = ''
              }
            }
          }
        }
        if (data.activeProviderId) activeProviderId.value = data.activeProviderId
        if (data.activeModel) activeModel.value = data.activeModel
        if (data.theme) theme.value = data.theme
        if (data.fontSize) fontSize.value = data.fontSize
        if (data.analysisMode) analysisMode.value = data.analysisMode
      } catch (e) {
        console.warn('Failed to load settings:', e)
      }
    }
  }

  async function saveSettings() {
    // 加密后存储
    const encryptedProviders = []
    for (const p of providers.value) {
      let apiKeyEncrypted = null
      if (p.apiKey) {
        try {
          apiKeyEncrypted = await window.electronAPI?.encryptKey(p.apiKey) || null
        } catch {
          apiKeyEncrypted = null
        }
      }
      encryptedProviders.push({
        id: p.id,
        apiKeyEncrypted
      })
    }

    localStorage.setItem('suixinji_settings', JSON.stringify({
      providers: encryptedProviders,
      activeProviderId: activeProviderId.value,
      activeModel: activeModel.value,
      theme: theme.value,
      fontSize: fontSize.value,
      analysisMode: analysisMode.value
    }))
  }

  function setApiKey(providerId, key) {
    const p = providers.value.find(pp => pp.id === providerId)
    if (p) { p.apiKey = key; saveSettings() }
  }

  function setActiveProvider(providerId) {
    activeProviderId.value = providerId
    const p = providers.value.find(pp => pp.id === providerId)
    if (p && p.models.length) activeModel.value = p.models[0]
    saveSettings()
  }

  function setActiveModel(model) {
    activeModel.value = model
    saveSettings()
  }

  function getAIConfig() {
    return {
      provider: activeProviderId.value,
      apiKey: activeProvider.value?.apiKey,
      model: activeModel.value,
      baseURL: activeProvider.value?.baseURL
    }
  }

  return {
    // state
    providers, activeProviderId, activeModel,
    analysisMode, rangeSize, conflictDetection, spellCheck,
    theme, fontSize,
    // getters
    activeProvider, hasApiKey,
    // actions
    loadSettings, saveSettings, setApiKey, setActiveProvider, setActiveModel, getAIConfig
  }
})
