/**
 * 高亮 API（M11）：矩形高亮 CRUD。
 * rect 为归一化坐标（0–1，前端框选精确给定），渲染层按百分比定位随缩放自适应。
 */
import type { Highlight, Rect } from '@reading/shared'
import { ApiPaths, baseUrl, parseApiError } from './client'

export interface HighlightInput {
  bookId: number
  pageNumber: number
  /** V2：归一化行盒数组（多行文本每行一盒） */
  rects: Rect[]
  color?: string
  excerptText?: string | null
  /** V2.4：区域/扫描类记录留档截图文件名（存 books/{bookId}/region/；非空 = 细边框区域） */
  screenshotRelPath?: string | null
}

export async function listHighlights(bookId: number): Promise<Highlight[]> {
  const res = await fetch(`${baseUrl()}${ApiPaths.highlightsForBook(bookId)}`)
  if (!res.ok) throw await parseApiError(res)
  return res.json()
}

export async function createHighlight(input: HighlightInput): Promise<Highlight> {
  const res = await fetch(`${baseUrl()}${ApiPaths.highlightsForBook(input.bookId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw await parseApiError(res)
  return res.json()
}

export async function deleteHighlight(id: number): Promise<void> {
  const res = await fetch(`${baseUrl()}${ApiPaths.highlight(id)}`, { method: 'DELETE' })
  if (!res.ok) throw await parseApiError(res)
}
