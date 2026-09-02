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

/**
 * V2：一次文本选择/框选的几何 —— 所在页码 + 归一化行盒数组。
 * 高亮/笔记落库用 rects（多行文本 → 多个行盒），旧 V1 单 rect 数据读取时归一化为单元素数组。
 */
export interface Selection {
  page: number
  /** 归一化行盒（0–1，通常一个文本行一个，随缩放等比准确） */
  rects: Rect[]
}

export interface Note {
  id: number
  bookId: number
  sessionId: number | null
  content: string
  /** V2：选中原文摘录（来源文本动作），AI 整理笔记也回填原文 */
  excerptText: string | null
  pageNumber: number | null
  /** V2：归一化行盒数组（DB 列仍名 rect）；文本动作落库用，可空 */
  rects: Rect[] | null
  /** 截图留档（仅 V1 框选 AI 摘抄遗留数据） */
  screenshotRelPath: string | null
  createdAt: string
  updatedAt: string
}

export interface Highlight {
  id: number
  bookId: number
  pageNumber: number
  /** V2：归一化行盒数组（DB 列仍名 rect；V1 单 rect 读取时归一化为单元素数组） */
  rects: Rect[]
  color: string
  /** 被高亮的原文摘录 */
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

/**
 * 设置页 DTO（GET/PUT /api/settings）。
 * 安全约束：API key 绝不下发渲染层 —— 只返回「是否已配置」，不返回明文。
 */
export interface SettingsDto {
  aiBaseUrl: string
  aiModel: string
  aiMaxTokens: number
  aiTemperature: number
  aiApiKeySet: boolean
  /** 实际运行中的数据库模式：sqlite | mysql */
  dbMode: string
  schemaVersion: string
}

/** 设置修改入参（PUT，部分更新）：key 非空才写入，空/缺省 = 保持不变 */
export interface SettingsPatch {
  aiBaseUrl?: string
  aiModel?: string
  aiMaxTokens?: number
  aiTemperature?: number
  aiApiKey?: string
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
  /** 动作所需的选中文字（文本动作原文；note/highlight 落库用原文而非 AI 摘句） */
  excerptText?: string
  /** 动作所需的选中几何（rects 行盒坐标由前端精确给定） */
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
