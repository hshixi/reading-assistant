/**
 * Electron 主进程入口。
 * - dev 模式：加载 Vite dev server（http://localhost:5173）
 * - prod 模式：加载打包后的 frontend/dist/index.html
 * 后端子进程（M13）在 prod 模式由本进程拉起，端口经 backend.port 文件握手。
 */
import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { registerIpc } from './ipc'
import { frontendDistDir } from './paths'

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173'
const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null

/** 带重试的加载：dev 下 vite 可能尚未就绪，prod 下文件可能正在释放 */
async function loadRenderer(win: BrowserWindow): Promise<void> {
  const target = isDev
    ? DEV_SERVER_URL
    : `file://${path.join(frontendDistDir(), 'index.html')}`
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      await win.loadURL(target)
      return
    } catch (err) {
      console.warn(`[electron] 加载失败（第 ${attempt} 次）: ${String(err)}`)
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  throw new Error(`无法加载 ${target}`)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'Reading Assistant',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload 需访问 node 模块（仅白名单 IPC）
      webSecurity: true,
    },
  })

  // 外链一律交给系统浏览器，禁止新开窗口
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow?.webContents.getURL() ?? ''
    if (url !== current && !url.startsWith('http://localhost')) {
      event.preventDefault()
    }
  })

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
  void loadRenderer(mainWindow).catch((err) => {
    console.error('[electron] 渲染进程加载失败:', err)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.setName('Reading Assistant')

// 单实例锁：避免多个后端进程与端口冲突
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    registerIpc()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
