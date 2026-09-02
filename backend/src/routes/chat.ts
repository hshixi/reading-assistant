/**
 * 聊天流式路由（M8 骨架，M9 接入真实 DeepSeek）：
 *  POST /api/chat/stream —— SSE 流式回复
 *
 * 流式落库策略：用户消息在发起流前落库；助手消息先插占位，流结束一次 UPDATE。
 * SSE 事件协议（shared/types.ts 已定）：
 *   meta {sessionId, messageId} / delta {text} / save {kind,id} / done {} / error {message}
 *
 * AI 来源：默认走真实 DeepSeek；设 AI_MOCK=1 时退回 M8 的 mock 打字机（离线开发/测试用）。
 */
import { Router, type Request, type Response, type NextFunction } from 'express'
import type { ChatRequest, SseMeta, SseSave } from '@reading/shared'
import { ApiPaths } from '@reading/shared'
import { getRepository } from '../db'
import { Book, ChatMessage, ChatSession, Highlight, Note } from '../db/entities'
import { streamAiChunks } from '../services/chat-provider'
import { isAbortError, streamDeepSeek, type DeepSeekInput } from '../services/deepseek'
import { getAiSettings } from '../services/ai-settings'
import { ApiError } from '../middleware/error'
import type { AppContext } from '../app'

function sse(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

/**
 * 从模型回复提取第一个 JSON 对象：
 * 优先 ```json 代码块，兜底找文本里第一个平衡的 {…} 块。
 */
function extractJsonObject(text: string): Record<string, unknown> | null {
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidates: string[] = block ? [block[1]] : []
  const start = text.indexOf('{')
  if (start >= 0) {
    let depth = 0
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++
      else if (text[i] === '}') {
        depth--
        if (depth === 0) {
          candidates.push(text.slice(start, i + 1))
          break
        }
      }
    }
  }
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c)
      if (parsed && typeof parsed === 'object') return parsed
    } catch {
      /* 试下一个候选 */
    }
  }
  return null
}

/** 新会话默认标题：取用户消息前 20 字 */
function defaultTitle(message: string): string {
  const t = message.trim()
  return t.length > 20 ? `${t.slice(0, 20)}…` : t
}

export function createChatRouter(context: AppContext): Router {
  const router = Router()
  const useMock = process.env.AI_MOCK === '1'

  router.post(ApiPaths.chatStream, async (req: Request, res: Response, next: NextFunction) => {
    const body = (req.body ?? {}) as ChatRequest
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!body.bookId || !message) {
      next(new ApiError(400, 'BAD_CHAT_REQUEST', '缺少 bookId 或 message'))
      return
    }

    // 客户端断开（停止/切页）时中止底层 AI 请求
    const reqCtrl = new AbortController()
    res.on('close', () => {
      if (!res.writableEnded) reqCtrl.abort()
    })

    try {
      // 1. 校验书籍
      const book = await getRepository(Book).findOneBy({ id: body.bookId })
      if (!book) throw new ApiError(404, 'BOOK_NOT_FOUND', '书籍不存在')

      // 2. 会话：指定 sessionId 则复用，否则新建
      let session: ChatSession | null = null
      if (body.sessionId) {
        session = await getRepository(ChatSession).findOneBy({ id: body.sessionId })
        if (session && session.bookId !== body.bookId) {
          throw new ApiError(400, 'SESSION_BOOK_MISMATCH', '会话与书籍不匹配')
        }
      }
      if (!session) {
        session = await getRepository(ChatSession).save(
          getRepository(ChatSession).create({ bookId: body.bookId, title: defaultTitle(message) }),
        )
      }

      // 2.5 AI 配置在落库前解析：未配置 key 直接报错，避免产生孤儿占位消息
      const aiSettings = useMock ? null : await getAiSettings(context.dataSource, context.config)
      if (!useMock && !aiSettings!.apiKey) {
        throw new ApiError(503, 'AI_NOT_CONFIGURED', '未配置 AI API Key，请在设置页填写')
      }

      // 3. 用户消息先落库（图片文件落盘在 M11 media-store 引入）
      // 3.5 更新会话：未命名则用首条消息命名；触达时间上移（会话列表按最近在前）
      const contentType = body.imageDataUrl ? 'mixed' : 'text'
      const userMsg = await getRepository(ChatMessage).save(
        getRepository(ChatMessage).create({
          sessionId: session.id,
          role: 'user',
          contentType,
          content: message,
          imageRelPath: null,
          meta: body.action ? { action: body.action } : null,
        }),
      )

      const now = new Date()
      if (!session.title || session.title === '新对话') {
        await getRepository(ChatSession).update(session.id, {
          title: defaultTitle(message),
          updatedAt: now,
        })
      } else {
        await getRepository(ChatSession).update(session.id, { updatedAt: now })
      }

      // 4. 助手消息占位
      const assistantMsg = await getRepository(ChatMessage).save(
        getRepository(ChatMessage).create({
          sessionId: session.id,
          role: 'assistant',
          contentType: 'text',
          content: '',
          meta: {},
        }),
      )

      // 5. 一切就绪才进入 SSE（此前失败可正常返回 JSON 错误）
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders()

      const meta: SseMeta = { sessionId: session.id, messageId: assistantMsg.id }
      sse(res, 'meta', meta)

      let text = ''
      let interrupted = false
      let errMsg: string | null = null
      try {
        if (useMock) {
          for await (const chunk of streamAiChunks({
            message,
            action: body.action,
            selection: body.selection,
            imageDataUrl: body.imageDataUrl,
            excerptText: typeof body.excerptText === 'string' ? body.excerptText : undefined,
          })) {
            if (res.writableEnded || res.destroyed) {
              interrupted = true
              break
            }
            text += chunk
            sse(res, 'delta', { text: chunk })
          }
        } else {
          const input: DeepSeekInput = {
            sessionId: session.id,
            excludeMessageId: userMsg.id,
            message,
            action: body.action,
            imageDataUrl: body.imageDataUrl,
            excerptText: typeof body.excerptText === 'string' ? body.excerptText : undefined,
          }
          for await (const chunk of streamDeepSeek(input, aiSettings!, reqCtrl.signal)) {
            if (res.writableEnded || res.destroyed) {
              interrupted = true
              break
            }
            text += chunk
            sse(res, 'delta', { text: chunk })
          }
        }
      } catch (err) {
        if (isAbortError(err)) {
          interrupted = true
        } else {
          errMsg = err instanceof Error ? err.message : String(err)
          sse(res, 'error', { message: errMsg })
        }
      }

      // AI 笔记落库：action=note 且模型返回 JSON 笔记时，用前端框选的 rects 行盒落 notes 并广播 save
      // V2：原文（body.excerptText）回填 excerptText，坐标精确由前端给定、模型不参与。
      let saved: SseSave | null = null
      if (!errMsg && body.action === 'note' && body.selection && text.trim()) {
        const parsed = extractJsonObject(text)
        if (parsed?.type === 'note') {
          const content = String(parsed.content ?? parsed.title ?? '').trim()
          if (content) {
            const note = await getRepository(Note).save(
              getRepository(Note).create({
                bookId: body.bookId,
                sessionId: session.id,
                content,
                excerptText: typeof body.excerptText === 'string' && body.excerptText.trim()
                  ? body.excerptText.trim()
                  : null,
                pageNumber: body.selection.page,
                rects: body.selection.rects,
              }),
            )
            saved = { kind: 'note', id: note.id }
            sse(res, 'save', saved)
          }
        }
      }

      // AI 高亮摘录落库：action=highlight 且模型返回 JSON 摘录时，用前端 rects 落 highlights 并广播 save
      // V2：摘录正文优先取 body.excerptText（用户选中的原文，所见即所得）；模型 excerpt 作兜底。
      if (!errMsg && body.action === 'highlight' && body.selection && text.trim()) {
        const parsed = extractJsonObject(text)
        if (parsed?.type === 'highlight') {
          const fromUser =
            typeof body.excerptText === 'string' && body.excerptText.trim()
              ? body.excerptText.trim()
              : null
          const fromModel =
            typeof parsed.excerpt === 'string' && parsed.excerpt.trim()
              ? parsed.excerpt.trim()
              : null
          const highlight = await getRepository(Highlight).save(
            getRepository(Highlight).create({
              bookId: body.bookId,
              pageNumber: body.selection.page,
              rects: body.selection.rects,
              color: 'yellow',
              excerptText: fromUser ?? fromModel,
            }),
          )
          saved = { kind: 'highlight', id: highlight.id }
          sse(res, 'save', saved)
        }
      }

      // 流结束落库（一次 UPDATE）
      await getRepository(ChatMessage).update(assistantMsg.id, {
        content: errMsg ? `⚠️ 出错了：${errMsg}` : text,
        meta: {
          model: useMock ? undefined : aiSettings!.model,
          interrupted: interrupted || (errMsg != null) || undefined,
        },
      })

      if (!errMsg) sse(res, 'done', {})
      res.end()
    } catch (err) {
      next(err)
    }
  })

  return router
}
