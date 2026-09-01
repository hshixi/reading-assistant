/**
 * 笔记 store（M11）：当前书的摘抄笔记列表。
 * AI 摘抄落库后由 chat 流 onSave 事件触发 refresh()，无需手动刷新。
 */
import { defineStore } from 'pinia'
import type { Note } from '@reading/shared'
import { deleteNote as apiDeleteNote, listNotes } from '@/api/notes'

export const useNotesStore = defineStore('notes', {
  state: () => ({
    bookId: null as number | null,
    notes: [] as Note[],
  }),
  actions: {
    async load(bookId: number): Promise<void> {
      this.bookId = bookId
      try {
        this.notes = await listNotes(bookId)
      } catch (err) {
        console.error('[notes] 加载笔记失败:', err)
      }
    },
    async refresh(): Promise<void> {
      if (!this.bookId) return
      try {
        this.notes = await listNotes(this.bookId)
      } catch (err) {
        console.error('[notes] 刷新笔记失败:', err)
      }
    },
    async remove(id: number): Promise<void> {
      await apiDeleteNote(id)
      this.notes = this.notes.filter((n) => n.id !== id)
    },
  },
})
