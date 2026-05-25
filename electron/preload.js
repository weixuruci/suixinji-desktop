const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  windowSetTitle: (title) => ipcRenderer.send('window-set-title', title),

  // AI
  aiRequest: (options) => ipcRenderer.invoke('ai-request', options),
  aiStream: (options) => ipcRenderer.invoke('ai-stream', options),
  onAIStreamChunk: (callback) => {
    ipcRenderer.on('ai-stream-chunk', (_event, chunk) => callback(chunk))
  },
  removeAIStreamListener: () => {
    ipcRenderer.removeAllListeners('ai-stream-chunk')
  },

  // API Key 安全存储
  encryptKey: (text) => ipcRenderer.invoke('safe-storage-encrypt', text),
  decryptKey: (encrypted) => ipcRenderer.invoke('safe-storage-decrypt', encrypted),

  // 项目持久化
  projectsList: () => ipcRenderer.invoke('projects-list'),
  projectSave: (project) => ipcRenderer.invoke('project-save', project),
  projectLoad: (projectId) => ipcRenderer.invoke('project-load', projectId),
  projectDelete: (projectId) => ipcRenderer.invoke('project-delete', projectId),

  // 文件
  fileRead: (filePath) => ipcRenderer.invoke('file-read', filePath),
  fileWrite: (filePath, content) => ipcRenderer.invoke('file-write', filePath, content),
  fileDialogOpen: () => ipcRenderer.invoke('file-dialog-open'),

  // 系统
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path')
})
