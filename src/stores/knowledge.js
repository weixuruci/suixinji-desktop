import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 知识库 Store — 管理实体查询、搜索、提取预览
 */
export const useKnowledgeStore = defineStore('knowledge', () => {
  // ---------- 搜索 ----------
  const searchQuery = ref('')
  const searchResults = ref([])
  const isSearching = ref(false)

  // ---------- 提取预览 ----------
  const extractionPreview = ref(null)   // { entities: [...], stats: {...} }
  const isExtracting = ref(false)
  const extractionProgress = ref(0)     // 0-100

  // ---------- 冲突检测 ----------
  const conflicts = ref([])

  // ---------- 操作历史（误操作恢复）----------
  const undoStack = ref([])             // [{ action, entity, timestamp }]
  const maxUndoSteps = 50

  function pushUndo(action, entity) {
    undoStack.value.unshift({ action: JSON.parse(JSON.stringify(action)), entity: JSON.parse(JSON.stringify(entity)), timestamp: Date.now() })
    if (undoStack.value.length > maxUndoSteps) undoStack.value.pop()
  }

  function popUndo() {
    return undoStack.value.shift() || null
  }

  // ---------- 自然语言提问 ----------
  const queryAnswer = ref(null)
  const isQuerying = ref(false)

  return {
    // search
    searchQuery, searchResults, isSearching,
    // extraction
    extractionPreview, isExtracting, extractionProgress,
    // conflicts
    conflicts,
    // undo
    undoStack, pushUndo, popUndo,
    // query
    queryAnswer, isQuerying
  }
})
