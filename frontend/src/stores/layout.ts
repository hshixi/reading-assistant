/**
 * 布局 store（V2-F2）：阅读器右侧面板宽度（可拖分隔线）。
 * 宽度持久化到 localStorage（会话级偏好）。
 */
import { defineStore } from 'pinia'

const KEY = 'ui.readerChatWidth'
const DEFAULT_WIDTH = 380
const MIN_WIDTH = 280
const MAX_WIDTH = 720

export const useLayoutStore = defineStore('layout', {
  state: () => ({
    readerChatWidth: readWidth(),
  }),
  actions: {
    setReaderChatWidth(w: number): void {
      this.readerChatWidth = clampWidth(w)
      try {
        localStorage.setItem(KEY, String(this.readerChatWidth))
      } catch {
        /* 忽略存储异常 */
      }
    },
  },
})

function readWidth(): number {
  try {
    const raw = Number(localStorage.getItem(KEY))
    if (Number.isFinite(raw)) return clampWidth(raw)
  } catch {
    /* fallthrough */
  }
  return DEFAULT_WIDTH
}

function clampWidth(w: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(w)))
}
