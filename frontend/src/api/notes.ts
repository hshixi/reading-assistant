/**
 * 笔记 API（M11）：摘抄笔记 CRUD。
 */
import type { Note } from '@reading/shared'
import { ApiPaths, baseUrl, parseApiError } from './client'

/** 创建笔记入参：bookId 必填，其余可选 */
export interface NoteInput {
  bookId: number
  content: string
  sessionId?: number
  pageNumber?: number
  rect?: { x: number; y: number; width: number; height: number } | null
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
