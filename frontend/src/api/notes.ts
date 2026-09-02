/**
 * 笔记 API（M11）：摘抄笔记 CRUD。
 */
import type { Note } from '@reading/shared'
import { ApiPaths, baseUrl, parseApiError } from './client'

/** 创建笔记入参：bookId 必填，其余可选 */
export interface NoteInput {
  bookId: number
  content: string
  /** V2：选中原文摘录 */
  excerptText?: string | null
  sessionId?: number
  pageNumber?: number
  /** V2：归一化行盒数组（DB 列仍名 rect） */
  rects?: { x: number; y: number; width: number; height: number }[] | null
  screenshotRelPath?: string | null
}

export async function listNotes(bookId: number): Promise<Note[]> {
  const res = await fetch(`${baseUrl()}${ApiPaths.notesForBook(bookId)}`)
  if (!res.ok) throw await parseApiError(res)
  return res.json()
}

export async function createNote(input: NoteInput): Promise<Note> {
  const res = await fetch(`${baseUrl()}${ApiPaths.notesForBook(input.bookId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw await parseApiError(res)
  return res.json()
}

export async function deleteNote(id: number): Promise<void> {
  const res = await fetch(`${baseUrl()}${ApiPaths.note(id)}`, { method: 'DELETE' })
  if (!res.ok) throw await parseApiError(res)
}
