/**
 * V2-F7：右键「笔记」选中的原文草稿 —— NotesPanel 预填的编辑态入参。
 */
import type { Rect } from '@reading/shared'

export interface NoteDraft {
  /** 选中所在页 */
  page: number
  /** 归一化行盒数组（原文下划线据此绘制） */
  rects: Rect[]
  /** 选中原文（excerpt） */
  text: string
}
