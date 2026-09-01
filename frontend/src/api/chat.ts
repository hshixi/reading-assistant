/**
 * 会话/消息/聊天流 API。
 */
import type { ChatMessage, ChatRequest, ChatSession } from '@reading/shared'
import { ApiPaths, baseUrl } from './client'
import { consumeSse, type SseHandlers } from './sse'

async function parseError(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
  return new Error(body?.error?.message ?? `请求失败：HTTP ${res.status}`)
}

/** 某本书的会话列表 */
export async function listSessions(bookId: number): Promise<ChatSession[]> {
  const res = await fetch(`${baseUrl()}${ApiPaths.sessionsForBook(bookId)}`)
  if (!res.ok) throw await parseError(res)
  return res.json()
}

/** 新建会话 */
export async function createSession(bookId: number, title?: string): Promise<ChatSession> {
  const res = await fetch(`${baseUrl()}${ApiPaths.sessionsForBook(bookId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw await parseError(res)
  return res.json()
}

/** 重命名会话 */
export async function renameSession(id: number, title: string): Promise<ChatSession> {
  const res = await fetch(`${baseUrl()}${ApiPaths.session(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw await parseError(res)
  return res.json()
}

/** 删除会话 */
export async function deleteSession(id: number): Promise<void> {
  const res = await fetch(`${baseUrl()}${ApiPaths.session(id)}`, { method: 'DELETE' })
  if (!res.ok) throw await parseError(res)
}

/** 分页拉取消息（升序返回）。before 为最旧一条的 createdAt ISO。 */
export async function listMessages(
  sessionId: number,
  opts: { before?: string; limit?: number } = {},
): Promise<ChatMessage[]> {
  const params = new URLSearchParams()
  if (opts.before) params.set('before', opts.before)
  if (opts.limit) params.set('limit', String(opts.limit))
  const qs = params.toString()
  const res = await fetch(`${baseUrl()}${ApiPaths.messages(sessionId)}${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw await parseError(res)
  return res.json()
}

/** 发起一次流式聊天，消费 SSE。 */
export async function streamChat(
  req: ChatRequest,
  handlers: SseHandlers,
  signal?: AbortSignal,
): Promise<void> {
  await consumeSse(`${baseUrl()}${ApiPaths.chatStream}`, req, handlers, signal)
}
