/**
 * 显式命名导出（避免 `export *` 在 CJS 产物下导致 rollup 无法静态分析的坑）。
 */

export { API_PREFIX, ApiPaths } from './api'

export { ACTION_TYPES, ACTION_LABELS, DEFAULT_AI_SETTINGS, SETTINGS_KEYS } from './constants'
export type { ActionType } from './constants'

export type {
  AiSettings,
  Annotation,
  ApiErrorBody,
  AppSettings,
  Book,
  BookPatch,
  ChatMessage,
  ChatRequest,
  ChatRole,
  ChatSession,
  ContentType,
  Highlight,
  MessageMeta,
  Note,
  Rect,
  Selection,
  SseDelta,
  SseError,
  SseMeta,
  SseSave,
} from './types'
