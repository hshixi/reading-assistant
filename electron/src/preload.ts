/**
 * preload：contextBridge 暴露最小白名单 API 给渲染层。
 * 不暴露任何 Node 能力，仅 IPC 转发。
 */
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: (): Promise<string[]> => ipcRenderer.invoke('dialog:openFile'),
  getAppDataPath: (): Promise<string> => ipcRenderer.invoke('app:getDataPath'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('app:openExternal', url),
  quit: (): void => ipcRenderer.send('app:quit'),

  // 后端状态推送（M13 起由主进程在健康检查通过后调用）
  onBackendStatus: (cb: (status: 'ok' | 'error') => void): void => {
    ipcRenderer.on('backend:status', (_evt, status: 'ok' | 'error') => cb(status))
  },
  getBackendPort: (): Promise<number> => ipcRenderer.invoke('app:getBackendPort'),
})
