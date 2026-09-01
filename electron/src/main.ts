/**
 * Electron 主进程入口。
 * - dev 模式（未打包且未设 READING_APP_PROD=1）：后端由 scripts/dev.mjs 外部启动（8787），
 *   窗口加载 Vite dev server。
 * - prod 模式（打包，或 READING_APP_PROD=1 源码验证）：本进程拉起后端子进程（动态端口），
 *   窗口加载打包后的 frontend/dist/index.html（file://）。
 */
import { app, BrowserWindow, Menu, shell } from 'electron'
import path from 'node:path'
import { registerIpc } from './ipc'
import { frontendDistDir } from './paths'
import { startBackend, stopBackend } from './backend-process'

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173'
/** 开发判断：未打包且未强制 prod（READING_APP_PROD=1 用于源码验证生产路径） */
const isDev = !app.isPackaged && process.env.READING_APP_PROD !== '1'

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

/** macOS 应用菜单：保证复制/粘贴/全选等快捷键可用 */
function installMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? ([{ role: 'appMenu' }] as Electron.MenuItemConstructorOptions[])
      : []),
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
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

// 测试/验证便利：允许把 userData（含 DB/书库）指到别处，避免污染真实用户目录
if (process.env.READING_APP_USER_DATA) {
  app.setPath('userData', process.env.READING_APP_USER_DATA)
}

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
    installMenu()
    registerIpc(isDev)

    // prod：立即拉起后端子进程（渲染层经 IPC 等待其就绪）
    if (!isDev) {
      void startBackend()
        .then((p) => {
          mainWindow?.webContents.send('backend:status', 'ok')
          console.log(`[electron] 后端就绪，端口 ${p}`)
        })
        .catch((err) => {
          console.error('[electron] 后端启动失败:', err)
          mainWindow?.webContents.send('backend:status', 'error')
        })
    }

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  // 退出前清理后端子进程
  app.on('before-quit', () => {
    stopBackend()
  })
}
