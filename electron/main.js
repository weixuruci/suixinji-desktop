const { app, BrowserWindow, ipcMain, safeStorage } = require('electron')
const path = require('path')

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // 开发环境：vite.config.js 存在且 dist 不存在 → 连 dev server
  // 生产环境：app.isPackaged 为 true，或 dist/index.html 存在 → 加载打包产物
  const isDev = !app.isPackaged && require('fs').existsSync(path.join(__dirname, '../vite.config.js'))

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.setTitle('随心记')
  if (require('fs').existsSync(path.join(__dirname, 'icon.png'))) {
    mainWindow.setIcon(path.join(__dirname, 'icon.png'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ==================== IPC Handlers ====================

// 窗口控制
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.on('window-close', () => mainWindow?.close())
ipcMain.on('window-set-title', (_e, title) => {
  if (mainWindow) mainWindow.setTitle(title)
})

// AI 请求
ipcMain.handle('ai-request', async (_event, options) => {
  const { createAIProvider } = require('./services/ai-provider')
  const provider = createAIProvider(options)
  return provider.chat(options)
})

// AI 流式请求
ipcMain.handle('ai-stream', async (event, options) => {
  const { createAIProvider } = require('./services/ai-provider')
  const provider = createAIProvider(options)
  return provider.chat({
    ...options,
    stream: true,
    onChunk: (chunk) => {
      mainWindow?.webContents.send('ai-stream-chunk', chunk)
    }
  })
})

// ==================== API Key 安全存储 ====================

ipcMain.handle('safe-storage-encrypt', (_event, text) => {
  if (!text) return null
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(text).toString('base64')
    }
    // Fallback: base64 混淆（非真正的加密，但比明文稍好）
    return Buffer.from(text).toString('base64')
  } catch (e) {
    console.warn('Encrypt failed:', e.message)
    return null
  }
})

ipcMain.handle('safe-storage-decrypt', (_event, encrypted) => {
  if (!encrypted) return ''
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
    }
    // Fallback
    return Buffer.from(encrypted, 'base64').toString('utf-8')
  } catch (e) {
    console.warn('Decrypt failed:', e.message)
    return ''
  }
})

// ==================== 项目数据持久化 ====================

const fs = require('fs/promises')
const userDataPath = app.getPath('userData')
const projectsDir = path.join(userDataPath, 'projects')

async function ensureProjectsDir() {
  await fs.mkdir(projectsDir, { recursive: true })
}

ipcMain.handle('projects-list', async () => {
  await ensureProjectsDir()
  const files = await fs.readdir(projectsDir)
  const projects = []
  for (const f of files) {
    if (!f.endsWith('.json')) continue
    try {
      const data = JSON.parse(await fs.readFile(path.join(projectsDir, f), 'utf-8'))
      projects.push(data)
    } catch {}
  }
  return projects
})

ipcMain.handle('project-save', async (_event, project) => {
  await ensureProjectsDir()
  const filePath = path.join(projectsDir, `${project.id}.json`)
  await fs.writeFile(filePath, JSON.stringify(project, null, 2), 'utf-8')
  return { ok: true }
})

ipcMain.handle('project-load', async (_event, projectId) => {
  const filePath = path.join(projectsDir, `${projectId}.json`)
  try {
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data)
  } catch {
    return null
  }
})

ipcMain.handle('project-delete', async (_event, projectId) => {
  const filePath = path.join(projectsDir, `${projectId}.json`)
  try { await fs.unlink(filePath) } catch {}
  return { ok: true }
})

// 文件操作
ipcMain.handle('file-read', async (_event, filePath) => {
  return require('fs/promises').readFile(filePath, 'utf-8')
})

ipcMain.handle('file-write', async (_event, filePath, content) => {
  await require('fs/promises').mkdir(path.dirname(filePath), { recursive: true })
  return require('fs/promises').writeFile(filePath, content, 'utf-8')
})

ipcMain.handle('file-dialog-open', async () => {
  const { dialog } = require('electron')
  return dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '文本文件', extensions: ['txt', 'md'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
})

// 获取用户数据路径
ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData')
})

// EPIPE 全局防护
process.on('uncaughtException', (err) => {
  if (err.code === 'EPIPE' || err.code === 'ECONNRESET') return
  console.error('Uncaught exception:', err)
})
