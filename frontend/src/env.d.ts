/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: DefineComponent<Record<string, never>, Record<string, never>, any>
  export default component
}

/** Electron preload 暴露的 API（contextBridge） */
interface Window {
  electronAPI?: {
    openFileDialog(): Promise<string[]>
    getBackendPort(): Promise<number>
    getAppDataPath(): Promise<string>
    onBackendStatus(cb: (status: 'ok' | 'error') => void): void
  }
}
