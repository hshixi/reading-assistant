/**
 * 阅读器 store：当前书、页码、缩放、框选选区（M7）。
 */
import { defineStore } from 'pinia'
import type { Book } from '@reading/shared'

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
  }),
  actions: {
    setBook(book: Book): void {
      this.book = book
      this.pageNumber = 1
      this.pageCount = book.pageCount ?? 0
      this.scale = 1
      this.selection = null
    },
    setSelection(sel: ReaderSelection): void {
      this.selection = sel
    },
    clearSelection(): void {
      this.selection = null
    },
  },
})
