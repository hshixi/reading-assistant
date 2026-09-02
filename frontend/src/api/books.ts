/**
 * 书籍相关 API 调用。统一走后端 baseURL，错误解析 { error: { code, message } }。
 */
import type { Book, BookPatch } from '@reading/shared'
import { ApiPaths, baseUrl } from './client'

async function parseError(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
  return new Error(body?.error?.message ?? `请求失败：HTTP ${res.status}`)
}

export async function listBooks(): Promise<Book[]> {
  const res = await fetch(`${baseUrl()}${ApiPaths.books}`)
  if (!res.ok) throw await parseError(res)
  return res.json()
}

export async function getBook(id: number): Promise<Book> {
  const res = await fetch(`${baseUrl()}${ApiPaths.book(id)}`)
  if (!res.ok) throw await parseError(res)
  return res.json()
}

export async function updateBook(id: number, patch: BookPatch): Promise<Book> {
  const res = await fetch(`${baseUrl()}${ApiPaths.book(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw await parseError(res)
  return res.json()
}

export async function uploadBook(file: File): Promise<Book> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${baseUrl()}${ApiPaths.books}`, { method: 'POST', body: form })
  if (!res.ok) throw await parseError(res)
  return res.json()
}

export async function removeBook(id: number): Promise<void> {
  const res = await fetch(`${baseUrl()}${ApiPaths.book(id)}`, { method: 'DELETE' })
  if (!res.ok) throw await parseError(res)
}
