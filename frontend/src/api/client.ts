/**
 * 前端 API 客户端：统一封装后端 baseURL。
 * - dev：渲染层同源（vite dev server），走相对 /api 由 Vite proxy 转发，无跨域。
 * - prod：渲染层为 file://，需用绝对地址 http://127.0.0.1:{port}/api，端口经 Electron IPC 获取。
 */
import { API_PREFIX, ApiPaths } from '@reading/shared'

let port: number | null = null

/** 启动时调用一次，解析后端端口 */
export async function initApi(): Promise<void> {
  if (window.electronAPI) {
    try {
      port = await window.electronAPI.getBackendPort()
    } catch {
      port = 8787
    }
  } else {
    // 浏览器直连 vite dev
    port = 8787
  }
}

export function baseUrl(): string {
  if (import.meta.env.DEV) return API_PREFIX
  return `http://127.0.0.1:${port ?? 8787}${API_PREFIX}`
}

export interface HealthResponse {
  ok: boolean
  name: string
  time: number
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${baseUrl()}${ApiPaths.health}`)
  if (!res.ok) throw new Error(`health check failed: HTTP ${res.status}`)
  return (await res.json()) as HealthResponse
}

/** 解析后端统一错误体 { error: { code, message } } */
export async function parseApiError(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
  return new Error(body?.error?.message ?? `请求失败：HTTP ${res.status}`)
}

/** 书籍文件下载地址（pdf.js 直接拉取，依赖后端 Range 支持） */
export function bookFileUrl(id: number): string {
  return `${baseUrl()}${ApiPaths.bookFile(id)}`
}

export { ApiPaths }
