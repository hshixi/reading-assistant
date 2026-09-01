/**
 * 前后端共享的 DTO 类型。命名约定：表名 → PascalCase 实体接口。
 * 时间字段一律为 ISO 8601 字符串。
 */
import type { ActionType } from './constants'

/** 书籍（PDF 元数据，文件本体存文件系统，DB 只存相对路径） */
export interface Book {
  id: number
  title: string
  author: string | null
  fileName: string
  fileSize: number
  mimeType: string | null
  pageCount: number | null
  sha256: string | null
  lastOpenedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface BookPatch {
  title?: string
  author?: string | null
}

export interface ChatSession {
  id: number
  bookId: number
  title: string | null
  messageCount?: number
  createdAt: string
  updatedAt: string
}

export type ChatRole = 'user' | 'assistant'

export type ContentType = 'text' | 'image' | 'mixed'

/** 消息元数据（JSON 存库） */
export interface MessageMeta {
  tokens?: number
  model?: string
  action?: ActionType
  interrupted?: boolean
}

export interface ChatMessage {
  id: number
  sessionId: number
  role: ChatRole
  contentType: ContentType
  content: string
  imageRelPath: string | null
  meta: MessageMeta | null
  createdAt: string
}

/** 归一化矩形坐标（0–1，相对页面宽高）。截图与高亮共用同一坐标系。 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** 一次框选：所在页码 + 归一化矩形 */
export interface Selection {
  page: number
  rect: Rect
}

export interface Note {
  id: number
  bookId: number
  sessionId: number | null
  content: string
  pageNumber: number | null
  rect: Rect | null
  screenshotRelPath: string | null
  createdAt: string
  updatedAt: string
}

export interface Highlight {
  id: number
  bookId: number
  pageNumber: number
  rect: Rect
  color: string
  excerptText: string | null
  noteId: number | null
  createdAt: string
}

export interface Annotation {
  id: number
  bookId: number
  pageNumber: number
  rect: Rect | null
  text: string
  annotationType: string
  createdAt: string
  updatedAt: string
}

/** app_settings 表的扁平 key-value */
export type AppSettings = Record<string, string>

export interface AiSettings {
  aiBaseUrl: string
  aiApiKey: string
  aiModel: string
  aiMaxTokens: number
  aiTemperature: number
}

/** 聊天请求体（SSE /api/chat/stream） */
export interface ChatRequest {
  /** 已有会话则传 sessionId；新会话省略由后端创建 */
  sessionId?: number
  bookId: number
  message: string
  /** PNG dataURL（data:image/png;base64,...）或 undefined */
  imageDataUrl?: string
  /** 快捷动作：translate | explain | note | highlight */
  action?: ActionType
  /** 动作所需的框选坐标（落库用，坐标由前端精确给定） */
  selection?: Selection
}

/** ---- SSE 事件 ----
 * event: meta    { sessionId, messageId }   —— 立即发，前端拿到 messageId 以追加消息
 * event: delta   { text }                   —— 逐段追加
 * event: save    { kind: 'note'|'highlight', id }  —— AI 已落库
 * event: done    {}
 * event: error   { message }
 */
export interface SseMeta {
  sessionId: number
  messageId: number
}
export interface SseDelta {
  text: string
}
export interface SseSave {
  kind: 'note' | 'highlight'
  id: number
}
export interface SseError {
  message: string
}

export interface ApiErrorBody {
  error: { code: string; message: string }
}
