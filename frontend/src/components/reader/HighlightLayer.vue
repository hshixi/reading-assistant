<template>
  <div
    v-if="rects.length"
    class="highlight-layer"
    :data-page="page"
  >
    <div
      v-for="h in rects"
      :key="h.id"
      class="highlight-rect"
      :style="styleFor(h)"
      :title="h.excerptText || undefined"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Highlight } from '@reading/shared'
import { useReaderStore } from '@/stores/reader'

const props = defineProps<{ page: number }>()
const readerStore = useReaderStore()

/** 该页的高亮（归一化 rect → 百分比定位，随缩放自适应） */
const rects = computed(() => readerStore.highlights.filter((h) => h.pageNumber === props.page))

function styleFor(h: Highlight): Record<string, string> {
  return {
    left: `${h.rect.x * 100}%`,
    top: `${h.rect.y * 100}%`,
    width: `${h.rect.width * 100}%`,
    height: `${h.rect.height * 100}%`,
    backgroundColor: h.color || 'yellow',
  }
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
  cursor: pointer;
  pointer-events: auto;
}
</style>
