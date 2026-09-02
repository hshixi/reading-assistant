/**
 * 书架 store：书籍列表 + 上传/删除。
 */
import { defineStore } from 'pinia'
import type { Book } from '@reading/shared'
import { getBook, listBooks, removeBook, uploadBook } from '@/api/books'

export const useBookStore = defineStore('book', {
  state: () => ({
    books: [] as Book[],
    loading: false,
    error: '',
  }),
  actions: {
    async fetchBooks(): Promise<void> {
      this.loading = true
      this.error = ''
      try {
        this.books = await listBooks()
      } catch (err) {
        this.error = err instanceof Error ? err.message : String(err)
      } finally {
        this.loading = false
      }
    },

    async upload(file: File): Promise<Book> {
      const book = await uploadBook(file)
      // 新上传的书插到最前
      this.books.unshift(book)
      return book
    },

    /**
     * 上传后后台轮询该书 pageCount：后端页数解析是异步的，解析完成即刷新卡片，
     * 让「解析中…」尽早变成真实页数。到达上限（解析失败/异常）静默退出 ——
     * 打开该书时阅读器会兜底回填 pageCount（见 ReaderView.onPageCount）。
     */
    async ensurePageCount(id: number, timeoutMs = 30_000): Promise<void> {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        try {
          const updated = await getBook(id)
          const i = this.books.findIndex((b) => b.id === id)
          if (i >= 0) this.books[i] = updated
          if (updated.pageCount != null) return
        } catch {
          return
        }
        await new Promise((r) => setTimeout(r, 1500))
      }
    },

    async remove(id: number): Promise<void> {
      await removeBook(id)
      this.books = this.books.filter((b) => b.id !== id)
    },
  },
})
