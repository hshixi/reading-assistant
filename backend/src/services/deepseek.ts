/**
 * DeepSeek（OpenAI 兼容）流式客户端（M9）。
 * 职责：把 `/chat/completions` 的流式响应转换为文本 chunk 生成器，
 * 并负责消息组装（system prompt + 裁剪的历史 + 当前 vision 消息）。
 * 异常统一抛出（转成 SSE error）；API key 只用于 Authorization 头，绝不进日志。
 */
import { LessThan } from 'typeorm'
import type { ActionType } from '@reading/shared'
import { getRepository } from '../db'
import { ChatMessage } from '../db/entities'
import type { ResolvedAiSettings } from './ai-settings'

/** HTTP 层错误（保留状态码，便于区分重试/友好提示） */
export class AiHttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'AiHttpError'
    this.status = status
  }
}

/** 5 秒无数据视为 stall，中止请求 */
const STALL_MS = 5000

/** 各快捷动作的 system prompt；无动作走普通对话 */
const SYSTEM_PROMPTS: Record<ActionType | 'chat', string> = {
  translate:
    '你是翻译助手。把图片或文字中的内容翻译成目标语言（默认中文），只输出译文本身，不要解释。',
  explain:
    '你是阅读助手。面向中文读者，分点解释图片或文字中的内容，帮助理解其含义与背景。',
  note: '你是笔记助手。把内容整理成结构化笔记，以 JSON 返回：{"type":"note","title":"…","content":"…"}，不要输出其他文字。',
  highlight:
    '你是摘要助手。提取内容中的关键句作为高亮摘录，以 JSON 返回：{"type":"highlight","excerpt":"…"}，不要输出其他文字。',
  chat: '你是阅读助手。结合图片与文字内容，用中文简洁准确地回答用户的问题。',
}

export interface DeepSeekInput {
  sessionId: number
  /** 当前用户消息 id：历史查询时排除，避免与当前消息重复 */
  excludeMessageId: number
  message: string
  action?: ActionType
  /** PNG dataURL。仅当前消息携带，历史只带文本省 token */
  imageDataUrl?: string
  /** 选中原文：有动作且无图时注入 user 消息（文本动作不必走 vision） */
  excerptText?: string
}

/** OpenAI 兼容的 messages 元素（vision 用 content 数组） */
type OpenAiMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | {
      role: 'user'
      content: Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >
    }

/** 中文按「字符数 / 2」粗略估算 token */
const tokens = (s: string): number => Math.ceil(s.length / 2)

function endpointUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`
}

function backoffMs(attempt: number): number {
  return Math.min(2000, 500 * 2 ** (attempt - 1))
}

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export function isAbortError(err: unknown): boolean {
  return (
    err instanceof DOMException ||
    (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError')
  )
}

/** 组装请求体：system + 裁剪历史（文本） + 当前用户消息（可带图） */
async function buildMessages(
  input: DeepSeekInput,
  settings: ResolvedAiSettings,
): Promise<OpenAiMessage[]> {
  const system = SYSTEM_PROMPTS[input.action ?? 'chat']
  const history = await getRepository(ChatMessage).find({
    where: { sessionId: input.sessionId, id: LessThan(input.excludeMessageId) },
    order: { id: 'ASC' },
    take: 40,
  })

  // token 预算：约 70% 给上下文（图片按约 300 token 估）
  const budget = Math.floor(settings.maxTokens * 0.7)
  let remaining = budget - tokens(system) - tokens(input.message) - (input.imageDataUrl ? 300 : 0)
  const historyMsgs: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i]
    if (!m.content) continue
    const cost = tokens(m.content) + 4
    if (remaining - cost < 100) break
    remaining -= cost
    historyMsgs.unshift({ role: m.role, content: m.content })
  }

  const messages: OpenAiMessage[] = [{ role: 'system', content: system }, ...historyMsgs]
  if (input.imageDataUrl) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: input.message },
        { type: 'image_url', image_url: { url: input.imageDataUrl } },
      ],
    })
  } else {
    // 动作携带选中原文时注入 <选中内容> 块：模型对文本动作直接翻译/解释/摘句，无需走图
    const excerpt = input.excerptText?.trim()
    const userText = excerpt
      ? `${input.message ? `${input.message}\n\n` : ''}<选中内容>\n${excerpt}\n</选中内容>`
      : input.message
    messages.push({ role: 'user', content: userText })
  }
  return messages
}

/** 单次流式调用（不重试）。消费者 break/return 时自动取消底层请求。 */
async function* streamOnce(
  settings: ResolvedAiSettings,
  messages: OpenAiMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const ctrl = new AbortController()
  let stalled = false
  const onExternalAbort = (): void => ctrl.abort()
  if (signal) {
    if (signal.aborted) throw new DOMException('已停止', 'AbortError')
    signal.addEventListener('abort', onExternalAbort, { once: true })
  }

  let timer: NodeJS.Timeout | null = null
  try {
    const res = await fetch(endpointUrl(settings.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        stream: true,
        max_tokens: settings.maxTokens,
        temperature: settings.temperature,
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new AiHttpError(
        res.status,
        `AI 服务返回 HTTP ${res.status}${detail ? `：${detail.slice(0, 200)}` : ''}`,
      )
    }
    if (!res.body) throw new Error('AI 服务响应为空')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let lastData = Date.now()

    // stall 检测：超过 STALL_MS 无数据则中止（转超时错误）
    timer = setInterval(() => {
      if (Date.now() - lastData > STALL_MS) {
        stalled = true
        ctrl.abort()
      }
    }, 1000)

    try {
      while (true) {
        let result: { done: boolean; value?: Uint8Array }
        try {
          result = await reader.read()
        } catch (err) {
          if (stalled) throw new Error('AI 回复超时，已中断（请稍后重试）')
          throw err
        }
        if (result.done) break
        lastData = Date.now()
        buf += decoder.decode(result.value, { stream: true })
        let idx: number
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, idx)
          buf = buf.slice(idx + 2)
          const payload = block
            .split('\n')
            .filter((l) => l.startsWith('data:'))
            .map((l) => l.slice(5).trim())
            .join('\n')
          if (!payload) continue
          if (payload === '[DONE]') return
          let json: { choices?: Array<{ delta?: { content?: unknown } }> }
          try {
            json = JSON.parse(payload)
          } catch {
            continue
          }
          const delta = json?.choices?.[0]?.delta?.content
          if (typeof delta === 'string' && delta) yield delta
        }
      }
    } finally {
      if (timer) clearInterval(timer)
      timer = null
    }
  } finally {
    if (timer) clearInterval(timer)
    signal?.removeEventListener('abort', onExternalAbort)
    // 无论正常结束还是被 break，都取消底层请求，避免悬空连接
    ctrl.abort()
  }
}

/** 把 AI 错误映射成用户可读的中文提示 */
function mapAiError(err: unknown): Error {
  if (isAbortError(err)) return err instanceof Error ? err : new Error(String(err))
  if (err instanceof AiHttpError) {
    switch (err.status) {
      case 401:
      case 403:
        return new Error('AI API Key 无效或未配置，请在设置页检查')
      case 402:
        return new Error('AI 账户额度不足，请检查用量')
      case 404:
        return new Error('AI 模型或接口地址不存在，请检查 base_url 与模型设置')
      case 408:
        return new Error('AI 请求超时')
      case 429:
        return new Error('AI 请求过于频繁，请稍后重试')
      default:
        return err.status >= 500
          ? new Error(`AI 服务暂时不可用（HTTP ${err.status}）`)
          : new Error(`AI 服务错误（HTTP ${err.status}）`)
    }
  }
  const msg = err instanceof Error ? err.message : String(err)
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg)) {
    return new Error('无法连接 AI 服务，请检查网络或 base_url 设置')
  }
  return err instanceof Error ? err : new Error(msg)
}

/** 429 → 重试 3 次；5xx → 重试 2 次（仅当尚未输出任何内容，避免重复） */
const RETRY_AFTER: Record<number, number> = { 429: 3, 500: 2, 502: 2, 503: 2, 504: 2 }

/**
 * 对外主入口：组装消息 → 流式调用（带重试）→ 逐段产出文本。
 * 已开始输出后的失败不重试，直接抛出。
 */
export async function* streamDeepSeek(
  input: DeepSeekInput,
  settings: ResolvedAiSettings,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const messages = await buildMessages(input, settings)
  let attempt = 0
  let started = false
  for (;;) {
    try {
      for await (const chunk of streamOnce(settings, messages, signal)) {
        started = true
        yield chunk
      }
      return
    } catch (err) {
      if (started) throw mapAiError(err)
      if (err instanceof AiHttpError && RETRY_AFTER[err.status] != null) {
        if (attempt < RETRY_AFTER[err.status]) {
          attempt += 1
          await delay(backoffMs(attempt))
          continue
        }
      }
      throw mapAiError(err)
    }
  }
}
