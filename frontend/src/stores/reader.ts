/**
 * 阅读器 store：当前书、页码、缩放、选区（文本/截图）、高亮（M7/M11/V2）。
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

/**
 * 把同一视觉行上的多个行盒合并成一个（原生 getClientRects 会按 span 粒度返回重叠小盒，
 * 逐盒渲染会让高亮重叠处变深）。判定：竖直区间重叠超过矮者 40% → 视为同一行，取并集。
 */
function mergeLineRects(rects: Rect[]): Rect[] {
  const rows: Rect[] = []
  for (const r of rects) {
    let placed = false
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const top = Math.max(row.y, r.y)
      const bottom = Math.min(row.y + row.height, r.y + r.height)
      const overlap = bottom - top
      const minH = Math.min(row.height, r.height)
      if (overlap > 0 && overlap >= minH * 0.4) {
        const left = Math.min(row.x, r.x)
        const right = Math.max(row.x + row.width, r.x + r.width)
        rows[i] = { x: left, y: Math.min(row.y, r.y), width: right - left, height: Math.max(row.y + row.height, r.y + r.height) - Math.min(row.y, r.y) }
        placed = true
        break
      }
    }
    if (!placed) rows.push({ ...r })
  }
  return rows
}

export const useReaderStore = defineStore('reader', {
  state: () => ({
    book: null as Book | null,
    pageNumber: 1,
    pageCount: 0,
    scale: 1,
    /** 最近一次选区（文本拖选或截图框选） */
    selection: null as ReaderSelection | null,
    /** 最近一次跨页文本选择（提示用户同页选择用，成功后清空） */
    crossPageSelection: false,
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
      this.crossPageSelection = false
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

    /** 从文本选择/框选直接创建高亮（rects/page 前端精确给定），成功后本地追加 */
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

    /**
     * V2-F6：把当前原生文本选区解析为行盒 + 原文，存入 selection（kind:'text'）。
     * 归一化矩形：对每个 getClientRects() 行盒，命中该页 textLayer 下的 span →
     * 换算为相对 .page-wrap 的 [0,1] 行盒。
     * 跨页选择不落选区（置 crossPageSelection 标记，由 UI 提示同页选择）。
     */
    captureTextSelection(): TextSelectionPayload | null {
      this.crossPageSelection = false
      const selObj = window.getSelection()
      if (!selObj || selObj.isCollapsed || selObj.rangeCount === 0) return null
      const text = (selObj.toString() || '').replace(/[\u00a0\u2007\u202f]/g, ' ').trim()
      if (!text) return null

      const byPage = new Map<number, Rect[]>()
      for (let r = 0; r < selObj.rangeCount; r++) {
        const crs = selObj.getRangeAt(r).getClientRects()
        for (let i = 0; i < crs.length; i++) {
          const cr = crs[i]
          if (cr.width < 1 || cr.height < 1) continue
          const hit = document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2)
          const textLayer = hit?.closest?.('[data-page-text]') as HTMLElement | null
          const wrap = hit?.closest?.('.page-wrap') as HTMLElement | null
          if (!textLayer || !wrap) continue
          const page = Number(textLayer.dataset.pageText ?? 0)
          if (!page) continue
          const wr = wrap.getBoundingClientRect()
          if (wr.width <= 0 || wr.height <= 0) continue
          const x = Math.max(0, Math.min(1, (cr.left - wr.left) / wr.width))
          const y = Math.max(0, Math.min(1, (cr.top - wr.top) / wr.height))
          const w = Math.max(0, Math.min(1 - x, cr.width / wr.width))
          const h = Math.max(0, Math.min(1 - y, cr.height / wr.height))
          if (w <= 0.0005 || h <= 0.0005) continue
          const arr = byPage.get(page) ?? []
          arr.push({ x, y, width: w, height: h })
          byPage.set(page, arr)
        }
      }
      if (byPage.size === 0) return null
      if (byPage.size > 1) {
        this.crossPageSelection = true
        return null
      }
      const [page, rawRects] = [...byPage.entries()][0]
      // 合并同一视觉行内的重叠小盒 → 每条线一个矩形，高亮/截图视觉干净
      const rects = mergeLineRects(rawRects)
      if (rects.length === 0) return null
      const payload: TextSelectionPayload = { kind: 'text', page, rects, text }
      // 已有「框选截图」待发送时不被顶掉（聊天输入预览保留）；仅空闲或同为文本选择时替换
      if (this.selection === null || this.selection.kind === 'text') this.selection = payload
      return payload
    },
  },
})
