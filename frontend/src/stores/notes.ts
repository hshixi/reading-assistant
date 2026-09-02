/**
 * 笔记 store（M11）：当前书的摘抄笔记列表。
 * AI 摘抄落库后由 chat 流 onSave 事件触发 refresh()，无需手动刷新。
 */
import { defineStore } from 'pinia'
import type { Note } from '@reading/shared'
import {
  createNote as apiCreateNote,
  deleteNote as apiDeleteNote,
  listNotes,
  type NoteInput,
} from '@/api/notes'

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
    /** V2-F7：本地直建笔记（excerpt 原文 + 批注 + 几何），成功即入列表 */
    async create(input: Omit<NoteInput, 'bookId'>): Promise<Note> {
      if (!this.bookId) throw new Error('未加载书籍')
      const n = await apiCreateNote({ bookId: this.bookId, ...input })
      this.notes = [n, ...this.notes]
      return n
    },
    async remove(id: number): Promise<void> {
      await apiDeleteNote(id)
      this.notes = this.notes.filter((n) => n.id !== id)
    },
  },
})
