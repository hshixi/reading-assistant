/**
 * 阅读器 store：当前书、页码、缩放、框选选区、高亮（M7/M11）。
 */
import { defineStore } from 'pinia'
import type { Book, Highlight, Rect } from '@reading/shared'
import {
  createHighlight as apiCreateHighlight,
  deleteHighlight as apiDeleteHighlight,
  listHighlights,
  type HighlightInput,
} from '@/api/highlights'

/** 框选结果：归一化矩形 + PNG dataURL，供聊天/AI 动作消费 */
export interface ReaderSelection {
  page: number
  rectNorm: { x: number; y: number; w: number; h: number }
  imageDataUrl: string
}

export const useReaderStore = defineStore('reader', {
  state: () => ({
    book: null as Book | null,
    pageNumber: 1,
    pageCount: 0,
    scale: 1,
    /** 最近一次框选（M8 聊天发送前读取，M11 落库高亮/笔记） */
    selection: null as ReaderSelection | null,
    /** 当前书的高亮（HighlightLayer 按 page 分组渲染，百分比定位随缩放自适应） */
    highlights: [] as Highlight[],
  }),
  actions: {
    setBook(book: Book): void {
      this.book = book
      this.pageNumber = 1
      this.pageCount = book.pageCount ?? 0
      this.scale = 1
      this.selection = null
      this.highlights = []
    },

    async loadHighlights(): Promise<void> {
      if (!this.book) return
      try {
        this.highlights = await listHighlights(this.book.id)
      } catch (err) {
        console.error('[reader] 加载高亮失败:', err)
      }
    },

    /** 从框选直接创建高亮（rect/page 前端精确给定），成功后本地追加 */
    async addHighlight(input: Omit<HighlightInput, 'bookId'>): Promise<Highlight | null> {
      if (!this.book) return null
      const h = await apiCreateHighlight({ bookId: this.book.id, ...input })
      this.highlights.push(h)
      return h
    },

    async removeHighlight(id: number): Promise<void> {
      await apiDeleteHighlight(id)
      this.highlights = this.highlights.filter((h) => h.id !== id)
    },

    setSelection(sel: ReaderSelection): void {
      this.selection = sel
    },
    clearSelection(): void {
      this.selection = null
    },
  },
})

/** 把框选的 rectNorm 转成 shared 的 Rect */
export function toRect(sel: ReaderSelection): Rect {
  return {
    x: sel.rectNorm.x,
    y: sel.rectNorm.y,
    width: sel.rectNorm.w,
    height: sel.rectNorm.h,
  }
}
