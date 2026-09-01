/** IPC handler 注册。preload 通过 contextBridge 暴露的白名单通道。 */
import { app, dialog, ipcMain, shell } from 'electron'
import { userDataDir } from './paths'
import { getBackendPort } from './backend-process'

/** 开发默认后端端口（dev.mjs 外部启动）；M13 起 prod 由后端进程握手动态端口。 */
export const DEV_BACKEND_PORT = Number(process.env.BACKEND_PORT ?? 8787)

export function registerIpc(isDev: boolean): void {
  // 打开文件对话框，选择要导入的 PDF。返回选中的文件绝对路径列表。
  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择 PDF 文件',
      properties: ['openFile'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (result.canceled) return []
    return result.filePaths
  })

  // 返回用户数据目录（用于展示存储位置）
  ipcMain.handle('app:getDataPath', () => userDataDir())

  // 后端端口：dev 返回固定端口；prod 等待后端子进程就绪后返回动态端口（首次调用即拉起后端）
  ipcMain.handle('app:getBackendPort', async () =>
    isDev ? DEV_BACKEND_PORT : getBackendPort(),
  )

  // 白名单外链（仅文档链接）
  ipcMain.handle('app:openExternal', async (_evt, url: string) => {
    if (typeof url === 'string' && /^https?:\/\//.test(url)) {
      await shell.openExternal(url)
    }
  })

  ipcMain.on('app:quit', () => app.quit())
}
