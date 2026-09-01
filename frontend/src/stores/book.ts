/**
 * 书架 store：书籍列表 + 上传/删除。
 */
import { defineStore } from 'pinia'
import type { Book } from '@reading/shared'
import { listBooks, removeBook, uploadBook } from '@/api/books'

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

    async remove(id: number): Promise<void> {
      await removeBook(id)
      this.books = this.books.filter((b) => b.id !== id)
    },
  },
})
