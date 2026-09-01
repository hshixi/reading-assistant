/**
 * 阅读器 store：当前书、页码、缩放、框选（M7）。
 */
import { defineStore } from 'pinia'
import type { Book } from '@reading/shared'

export const useReaderStore = defineStore('reader', {
  state: () => ({
    book: null as Book | null,
    pageNumber: 1,
    pageCount: 0,
    scale: 1,
  }),
  actions: {
    setBook(book: Book): void {
      this.book = book
      this.pageNumber = 1
      this.pageCount = book.pageCount ?? 0
      this.scale = 1
    },
  },
})
