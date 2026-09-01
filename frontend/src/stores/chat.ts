/**
 * 聊天 store：会话列表、当前会话、消息流、SSE 消费。
 */
import { reactive } from 'vue'
import { defineStore } from 'pinia'
import type { ActionType, ChatMessage, ChatSession, Selection } from '@reading/shared'
import { createSession, listMessages, listSessions, streamChat } from '@/api/chat'

export interface LocalMessage extends ChatMessage {
  /** 流式中 */
  streaming?: boolean
  /** 出错提示（流 error 事件 / 网络异常） */
  error?: string
  /** 本地预览用图片（截图 dataURL，尚未落库文件） */
  imageDataUrl?: string
}

const PAGE_SIZE = 50

export const useChatStore = defineStore('chat', {
  state: () => ({
    bookId: null as number | null,
    sessions: [] as ChatSession[],
    activeSessionId: null as number | null,
    messages: [] as LocalMessage[],
    isStreaming: false,
    /** 历史是否还有更早消息 */
    hasMore: true,
    loadingHistory: false,
    _abort: null as AbortController | null,
  }),
  actions: {
    async loadSessions(bookId: number): Promise<void> {
      this.bookId = bookId
      const sessions = await listSessions(bookId)
      this.sessions = sessions
      // 自动选中最近会话；无会话则保持空（首次发送时自动建）
      if (sessions.length > 0 && !sessions.some((s) => s.id === this.activeSessionId)) {
        this.activeSessionId = sessions[0].id
        await this.loadMessages(sessions[0].id)
      }
    },

    async ensureSession(): Promise<number> {
      if (this.activeSessionId) return this.activeSessionId
      if (!this.bookId) throw new Error('尚未打开书籍')
      const session = await createSession(this.bookId)
      this.sessions.unshift(session)
      this.activeSessionId = session.id
      this.messages = []
      this.hasMore = false
      return session.id
    },

    async openSession(sessionId: number): Promise<void> {
      if (sessionId === this.activeSessionId) return
      this.activeSessionId = sessionId
      this.messages = []
      this.hasMore = true
      await this.loadMessages(sessionId)
    },

    async loadMessages(sessionId: number): Promise<void> {
      this.loadingHistory = true
      try {
        const rows = await listMessages(sessionId, { limit: PAGE_SIZE })
        this.messages = rows
        this.hasMore = rows.length >= PAGE_SIZE
      } catch (err) {
        console.error('[chat] 加载消息失败:', err)
      } finally {
        this.loadingHistory = false
      }
    },

    /** 加载更早的历史（滚动到顶部时） */
    async loadMore(): Promise<void> {
      if (!this.activeSessionId || !this.hasMore || this.loadingHistory) return
      this.loadingHistory = true
      try {
        const oldest = this.messages[0]
        if (!oldest) {
          this.hasMore = false
          return
        }
        const rows = await listMessages(this.activeSessionId, {
          before: oldest.createdAt,
          limit: PAGE_SIZE,
        })
        this.messages = [...rows, ...this.messages]
        this.hasMore = rows.length >= PAGE_SIZE
      } catch (err) {
        console.error('[chat] 加载更多失败:', err)
      } finally {
        this.loadingHistory = false
      }
    },

    async send(
      text: string,
      opts: { imageDataUrl?: string; action?: ActionType; selection?: Selection } = {},
    ): Promise<void> {
      if (this.isStreaming) return
      const clean = text.trim()
      if (!clean && !opts.imageDataUrl) return
      const sessionId = await this.ensureSession()
      const bookId = this.bookId!

      // 本地追加用户消息
      const userMsg: LocalMessage = {
        id: -Date.now(),
        sessionId,
        role: 'user',
        contentType: opts.imageDataUrl ? 'mixed' : 'text',
        content: clean,
        imageRelPath: null,
        meta: opts.action ? { action: opts.action } : null,
        createdAt: new Date().toISOString(),
        imageDataUrl: opts.imageDataUrl,
      }
      this.messages.push(userMsg)

      // 助手占位
      // 注意：SSE 回调里会持续修改 content/streaming 等字段，
      // 必须用 reactive() 包裹，否则原始对象上的修改不会触发 Vue 重新渲染。
      const assistantMsg = reactive({
        id: -Date.now() - 1,
        sessionId,
        role: 'assistant',
        contentType: 'text',
        content: '',
        imageRelPath: null,
        meta: {},
        createdAt: new Date().toISOString(),
        streaming: true,
      } as LocalMessage)
      this.messages.push(assistantMsg)

      this.isStreaming = true
      this._abort = new AbortController()
      let acc = ''
      let finished = false

      try {
        await streamChat(
          {
            sessionId,
            bookId,
            message: clean,
            imageDataUrl: opts.imageDataUrl,
            action: opts.action,
            selection: opts.selection,
          },
          {
            onMeta: ({ messageId }) => {
              assistantMsg.id = messageId
            },
            onDelta: ({ text }) => {
              acc += text
              assistantMsg.content = acc
            },
            onDone: () => {
              assistantMsg.streaming = false
              finished = true
            },
            onError: ({ message }) => {
              assistantMsg.streaming = false
              assistantMsg.error = message
            },
          },
          this._abort.signal,
        )
      } catch (err) {
        if (this._abort?.signal.aborted) {
          // 用户主动停止
          assistantMsg.streaming = false
          assistantMsg.meta = { ...(assistantMsg.meta ?? {}), interrupted: true }
        } else {
          assistantMsg.streaming = false
          assistantMsg.error = err instanceof Error ? err.message : String(err)
        }
      } finally {
        this.isStreaming = false
        this._abort = null
        // 刷新会话列表（消息数/更新时间变化）
        void this.refreshSessions()
        void finished
      }
    },

    stop(): void {
      this._abort?.abort()
    },

    async refreshSessions(): Promise<void> {
      if (!this.bookId) return
      try {
        this.sessions = await listSessions(this.bookId)
      } catch {
        /* 静默 */
      }
    },

    /** 换书时重置 */
    reset(): void {
      this._abort?.abort()
      this.sessions = []
      this.activeSessionId = null
      this.messages = []
      this.isStreaming = false
      this.hasMore = true
      this.bookId = null
    },
  },
})
