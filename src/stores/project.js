import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createEmptyEntities } from '../constants/entities'

/**
 * 项目 Store — 管理作品（项目）列表和当前项目
 */
export const useProjectStore = defineStore('project', () => {
  // ---------- state ----------
  const projects = ref([])
  const currentProjectId = ref(null)

  const currentProject = computed(() =>
    projects.value.find(p => p.id === currentProjectId.value) || null
  )

  // ---------- actions ----------
  async function loadProjects() {
    // 优先从 Electron IPC（JSON 文件）读取
    if (window.electronAPI?.projectsList) {
      try {
        const list = await window.electronAPI.projectsList()
        if (list && list.length > 0) { projects.value = list; return }
      } catch (e) { console.warn('IPC load failed, fallback to localStorage', e) }
    }
    // localStorage 兜底：按项目分 key 读取
    try {
      const index = JSON.parse(localStorage.getItem('suixinji_projects_index') || '[]')
      const loaded = []
      for (const id of index) {
        const raw = localStorage.getItem('suixinji_proj_' + id)
        if (raw) loaded.push(JSON.parse(raw))
      }
      if (loaded.length > 0) { projects.value = loaded; return }
    } catch {}
    // 最后的兜底：旧的单 key 格式
    const saved = localStorage.getItem('suixinji_projects')
    if (saved) { try { projects.value = JSON.parse(saved) } catch {} }
  }

  async function saveProjects() {
    // IPC 逐项目保存为主，localStorage 兜底（断电/崩溃不丢数据）
    const saved = {}
    for (const proj of projects.value) {
      try { if (window.electronAPI?.projectSave) await window.electronAPI.projectSave(proj) } catch (e) { console.warn('IPC save failed', e) }
      saved[proj.id] = proj
    }
    // localStorage 兜底：按项目分 key，避免多项目合并混淆
    localStorage.setItem('suixinji_projects_index', JSON.stringify(Object.keys(saved)))
    for (const [id, proj] of Object.entries(saved)) {
      try { localStorage.setItem('suixinji_proj_' + id, JSON.stringify(proj)) } catch {}
    }
  }

  async function createProject({ name, description = '' }) {
    const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const project = {
      id,
      name,
      description,
      chapters: [],
      chatMessages: [],
      entities: createEmptyEntities(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    projects.value.push(project)
    currentProjectId.value = id
    await saveProjects()
    return project
  }

  async function deleteProject(id) {
    const idx = projects.value.findIndex(p => p.id === id)
    if (idx === -1) return false
    const proj = projects.value[idx]
    projects.value.splice(idx, 1)
    // IPC 删除文件
    if (window.electronAPI?.projectDelete) {
      try { await window.electronAPI.projectDelete(id) } catch {}
    }
    if (currentProjectId.value === id) {
      currentProjectId.value = projects.value[0]?.id || null
    }
    return true
  }

  function setCurrentProject(id) {
    currentProjectId.value = id
  }

  async function updateProject(id, patch) {
    const proj = projects.value.find(p => p.id === id)
    if (!proj) return
    Object.assign(proj, patch, { updatedAt: new Date().toISOString() })
    await saveProjects()
  }

  async function addChapter(projectId, chapter) {
    const proj = projects.value.find(p => p.id === projectId)
    if (!proj) return
    proj.chapters.push({
      number: chapter.number,
      title: chapter.title || `第${chapter.number}章`,
      contentPath: chapter.contentPath || null,
      content: chapter.content || null,
      analyzed: chapter.analyzed !== undefined ? chapter.analyzed : true,
      uploadedAt: new Date().toISOString()
    })
    proj.updatedAt = new Date().toISOString()
    await saveProjects()
  }

  async function updateChapter(projectId, chapterNumber, patch) {
    const proj = projects.value.find(p => p.id === projectId)
    if (!proj) return
    const ch = proj.chapters.find(c => c.number === chapterNumber)
    if (ch) {
      Object.assign(ch, patch)
      proj.updatedAt = new Date().toISOString()
      await saveProjects()
    }
  }

  async function removeChapter(projectId, chapter) {
    const proj = projects.value.find(p => p.id === projectId)
    if (!proj) return
    const idx = proj.chapters.findIndex(c => c.number === chapter.number && c.title === chapter.title)
    if (idx >= 0) proj.chapters.splice(idx, 1)
    proj.updatedAt = new Date().toISOString()
    await saveProjects()
  }

  async function renameChapter(projectId, chapter, newTitle) {
    const proj = projects.value.find(p => p.id === projectId)
    if (!proj) return
    const ch = proj.chapters.find(c => c.number === chapter.number && c.title === chapter.title)
    if (ch) { ch.title = newTitle; proj.updatedAt = new Date().toISOString() }
    await saveProjects()
  }

  async function updateEntity(projectId, type, entity) {
    const proj = projects.value.find(p => p.id === projectId)
    if (!proj) return
    if (!proj.entities[type]) proj.entities[type] = []
    const list = proj.entities[type]

    // 先按 id 匹配
    let idx = list.findIndex(e => e.id === entity.id)
    // 再按实体类型的关键字段去重匹配
    if (idx < 0) {
      idx = list.findIndex(e => matchEntity(e, entity, type))
    }

    if (idx >= 0) {
      // 合并：保留已有字段，新字段覆盖
      const merged = { ...list[idx] }
      for (const key of Object.keys(entity)) {
        if (entity[key] !== undefined && entity[key] !== '' && key !== 'id' && key !== 'createdAt') {
          // 数组字段追加而非覆盖
          if (Array.isArray(entity[key]) && Array.isArray(merged[key])) {
            merged[key] = [...new Set([...merged[key], ...entity[key]])]
          } else {
            merged[key] = entity[key]
          }
        }
      }
      merged.updatedAt = new Date().toISOString()
      list[idx] = merged
    } else {
      list.push({ ...entity, id: entity.id || generateId(type), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    }
    proj.updatedAt = new Date().toISOString()
    await saveProjects()
  }

  /** 按关键字段判断两个实体是否相同 */
  function matchEntity(existing, incoming, type) {
    switch (type) {
      case 'characters': return existing.name && incoming.name && existing.name === incoming.name
      case 'settings': return existing.name && incoming.name && existing.name === incoming.name
      case 'items': return existing.name && incoming.name && existing.name === incoming.name
      case 'events': return existing.name && incoming.name && existing.name === incoming.name
      case 'powerRankings': return existing.name && incoming.name && existing.name === incoming.name
      case 'powerSystem': return existing.name && incoming.name && existing.name === incoming.name
      case 'foreshadows': return existing.content && incoming.content && existing.content === incoming.content
      case 'relationships': return existing.personA === incoming.personA && existing.personB === incoming.personB && existing.relation === incoming.relation
      case 'chapterSummaries': return existing.chapter === incoming.chapter
      case 'writingNotes': return existing.title && incoming.title && existing.title === incoming.title
      default: return false
    }
  }

  async function removeEntity(projectId, type, entityId) {
    const proj = projects.value.find(p => p.id === projectId)
    if (!proj) return
    if (!proj.entities[type]) return
    const list = proj.entities[type]
    const idx = list.findIndex(e => e.id === entityId)
    if (idx >= 0) list.splice(idx, 1)
    proj.updatedAt = new Date().toISOString()
    await saveProjects()
  }

  function generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  }

  function saveWritingAsset(projectId, asset) {
    const proj = projects.value.find(p => p.id === projectId)
    if (!proj) return
    if (!proj.writingAssets) proj.writingAssets = []
    proj.writingAssets.push({ ...asset, id: generateId('asset'), createdAt: new Date().toISOString() })
    saveProjects()
  }

  function deleteWritingAsset(projectId, assetId) {
    const proj = projects.value.find(p => p.id === projectId)
    if (!proj?.writingAssets) return
    const idx = proj.writingAssets.findIndex(a => a.id === assetId)
    if (idx >= 0) { proj.writingAssets.splice(idx, 1); saveProjects() }
  }

  return {
    // state
    projects, currentProjectId,
    // getters
    currentProject,
    // actions
    loadProjects, createProject, deleteProject, setCurrentProject, updateProject,
    addChapter, removeChapter, updateChapter, renameChapter, updateEntity, removeEntity,
    saveProjects, saveWritingAsset, deleteWritingAsset
  }
})
