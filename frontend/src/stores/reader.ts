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

/** 文本选择：pdf 文本层原生拖选 → 行盒 + 原文（V2 高亮/笔记语义） */
export interface TextSelectionPayload {
  kind: 'text'
  page: number
  /** 归一化行盒（shared Rect，0–1） */
  rects: Rect[]
  /** 选中原文（落库 excerpt / 发聊天提及用） */
  text: string
}

/** 框选截图：canvas 截取区域 → PNG（vision 提问/翻译图） */
export interface ImageSelectionPayload {
  kind: 'image'
  page: number
  /** 归一化矩形 */
  rect: Rect
  imageDataUrl: string
}

/** V2：阅读器内一种选区，二者互斥（文本层拖选 或 截图框选） */
export type ReaderSelection = TextSelectionPayload | ImageSelectionPayload

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
