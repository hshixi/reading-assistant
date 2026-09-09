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
      :class="{ region: m.region, flash: m.flash }"
      :style="m.style"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Note, Rect } from '@reading/shared'
import { useNotesStore } from '@/stores/notes'

const props = defineProps<{ page: number; flashId?: number | null }>()
const notesStore = useNotesStore()

/** 该页的笔记 */
const notes = computed(() => notesStore.notes.filter((n) => n.pageNumber === props.page))

/**
 * V2-F7：笔记在原文上画「淡红下划线」。把每条笔记的行盒数组摊平成独立下划线
 * （归一化百分比定位，随缩放自适应）。交互（hover/点击）由 ReaderView 统一命中，
 * 本层 pointer-events:none，不挡文本拖选。
 * V2.4：带截图留档（screenshotRelPath）的扫描区域笔记 → 细边框；flashId 命中时整组闪烁。
 */
const marks = computed(() => {
  const out: { key: string; style: Record<string, string>; region: boolean; flash: boolean }[] = []
  for (const n of notes.value) {
    const region = !!n.screenshotRelPath
    const flash = props.flashId === n.id
    for (const r of rectsOf(n)) {
      out.push({
        key: `${n.id}-${r.x.toFixed(3)}-${r.y.toFixed(3)}`,
        style: {
          left: `${r.x * 100}%`,
          top: `${r.y * 100}%`,
          width: `${r.width * 100}%`,
          height: `${r.height * 100}%`,
        },
        region,
        flash,
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

/* V2.4：区域笔记 → 细边框（扫描页无文字层，不做下划线底）；用红色系描边区分截图边界 */
.note-mark-rect.region {
  border: 1.5px dashed rgba(231, 76, 60, 0.75);
  border-radius: 2px;
  background: transparent;
}

/* V2.4：定位到某条笔记时整组闪烁提示位置 */
.note-mark-rect.flash {
  animation: note-flash-ring 1.4s ease-out 1;
}
@keyframes note-flash-ring {
  0% {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--el-color-danger) 55%, transparent);
  }
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--el-color-danger) 55%, transparent);
  }
}
</style>
