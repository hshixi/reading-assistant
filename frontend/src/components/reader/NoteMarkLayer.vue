<template>
  <div
    v-if="marks.length"
    class="note-mark-layer"
    :data-page="page"
  >
    <div
      v-for="m in marks"
      :key="m.key"
      class="note-mark-rect"
      :style="m.style"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Note, Rect } from '@reading/shared'
import { useNotesStore } from '@/stores/notes'

const props = defineProps<{ page: number }>()
const notesStore = useNotesStore()

/** 该页的笔记 */
const notes = computed(() => notesStore.notes.filter((n) => n.pageNumber === props.page))

/**
 * V2-F7：笔记在原文上画「淡红下划线」。把每条笔记的行盒数组摊平成独立下划线
 * （归一化百分比定位，随缩放自适应）。交互（hover/点击）由 ReaderView 统一命中，
 * 本层 pointer-events:none，不挡文本拖选。
 */
const marks = computed(() => {
  const out: { key: string; style: Record<string, string> }[] = []
  for (const n of notes.value) {
    for (const r of rectsOf(n)) {
      out.push({
        key: `${n.id}-${r.x.toFixed(3)}-${r.y.toFixed(3)}`,
        style: {
          left: `${r.x * 100}%`,
          top: `${r.y * 100}%`,
          width: `${r.width * 100}%`,
          height: `${r.height * 100}%`,
        },
      })
    }
  }
  return out
})

/** 读行盒；对无 rects / V1 遗留单 rect 数据防御兜底 */
function rectsOf(n: Note): Rect[] {
  if (Array.isArray(n.rects) && n.rects.length) return n.rects
  const legacy = (n as unknown as { rect?: Rect }).rect
  return legacy ? [legacy] : []
}
</script>

<style scoped>
.note-mark-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* 每条笔记的下划线：2px 底边 + 极浅红底，肉眼可见但不压字 */
.note-mark-rect {
  position: absolute;
  border-bottom: 2px solid rgba(231, 76, 60, 0.55);
  background: rgba(231, 76, 60, 0.06);
  border-radius: 1px;
}
</style>
