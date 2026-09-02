<template>
  <div
    v-if="boxes.length"
    class="highlight-layer"
    :data-page="page"
  >
    <div
      v-for="b in boxes"
      :key="b.key"
      class="highlight-rect"
      :style="b.style"
      :title="b.excerpt || undefined"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Highlight, Rect } from '@reading/shared'
import { useReaderStore } from '@/stores/reader'

const props = defineProps<{ page: number }>()
const readerStore = useReaderStore()

/** 该页的高亮 */
const highlights = computed(() => readerStore.highlights.filter((h) => h.pageNumber === props.page))

/** V2：一条高亮可含多行盒 → 展平成独立色块（归一化百分比定位，随缩放自适应） */
const boxes = computed(() => {
  const out: { key: string; style: Record<string, string>; excerpt: string | null }[] = []
  for (const h of highlights.value) {
    for (const r of rectsOf(h)) {
      out.push({
        key: `${h.id}-${r.x.toFixed(3)}-${r.y.toFixed(3)}`,
        style: {
          left: `${r.x * 100}%`,
          top: `${r.y * 100}%`,
          width: `${r.width * 100}%`,
          height: `${r.height * 100}%`,
          backgroundColor: h.color || 'yellow',
        },
        excerpt: h.excerptText,
      })
    }
  }
  return out
})

/** 读取行盒；对 V1 遗留单对象（后端应已归一化，这里防御兜底） */
function rectsOf(h: Highlight): Rect[] {
  if (Array.isArray(h.rects)) return h.rects
  const legacy = (h as unknown as { rect?: Rect }).rect
  return legacy ? [legacy] : []
}
</script>

<style scoped>
.highlight-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.highlight-rect {
  position: absolute;
  opacity: 0.35;
  border-radius: 2px;
  /* N5：不拦截指针，保证原生文本选择可穿过高亮 */
  pointer-events: none;
}
</style>
