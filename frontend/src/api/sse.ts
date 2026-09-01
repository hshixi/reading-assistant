/**
 * SSE 客户端：原生 fetch + ReadableStream 手动解析。
 * 不用 EventSource（需要 POST body 携带图片/动作）。
 */

export interface SseHandlers {
  onMeta?: (d: { sessionId: number; messageId: number }) => void
  onDelta?: (d: { text: string }) => void
  onSave?: (d: { kind: 'note' | 'highlight'; id: number }) => void
  onDone?: (d: Record<string, never>) => void
  onError?: (d: { message: string }) => void
}

export type SseEventName = 'meta' | 'delta' | 'save' | 'done' | 'error'

/** 解析单条 SSE 块（event/data 行），返回事件名与 data JSON */
function parseEventBlock(block: string): { event: string; data: string } | null {
  let event = 'message'
  let data = ''
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data += line.slice(5).trim()
  }
  if (!data) return null
  return { event, data }
}

/**
 * POST 到指定 URL 并消费 SSE 流。返回 { sessionId?, messageId? }（从 meta 事件提取）。
 * 中止：外部传入 AbortSignal。
 */
export async function consumeSse(
  url: string,
  body: unknown,
  handlers: SseHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(`请求失败：HTTP ${res.status}${text ? ` ${text.slice(0, 120)}` : ''}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const dispatch = (event: string, data: string): void => {
    let parsed: unknown = {}
    try {
      parsed = JSON.parse(data)
    } catch {
      parsed = { text: data }
    }
    switch (event) {
      case 'meta':
        handlers.onMeta?.(parsed as { sessionId: number; messageId: number })
        break
      case 'delta':
        handlers.onDelta?.(parsed as { text: string })
        break
      case 'save':
        handlers.onSave?.(parsed as { kind: 'note' | 'highlight'; id: number })
        break
      case 'done':
        handlers.onDone?.(parsed as Record<string, never>)
        break
      case 'error':
        handlers.onError?.(parsed as { message: string })
        break
      default:
        // 忽略未知事件
        break
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      const parsed = parseEventBlock(block)
      if (parsed) dispatch(parsed.event, parsed.data)
    }
  }
}
