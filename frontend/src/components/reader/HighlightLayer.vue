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
      :class="{ region: b.region, flash: b.flash }"
      :style="b.style"
      :title="b.excerpt || undefined"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Highlight, Rect } from '@reading/shared'
import { useReaderStore } from '@/stores/reader'

const props = defineProps<{ page: number; flashId?: number | null }>()
const readerStore = useReaderStore()

/** 该页的高亮 */
const highlights = computed(() => readerStore.highlights.filter((h) => h.pageNumber === props.page))

/**
 * V2：一条高亮可含多行盒 → 展平成独立色块（归一化百分比定位，随缩放自适应）。
 * V2.4：带截图留档（screenshotRelPath）的区域/扫描记录 → 只画细边框不做文字底
 * （扫描页无文字层，fill 会糊在原图上）；同条记录聚焦（flashId）时整组闪烁。
 */
const boxes = computed(() => {
  const out: {
    key: string
    style: Record<string, string>
    excerpt: string | null
    region: boolean
    flash: boolean
  }[] = []
  for (const h of highlights.value) {
    const region = !!h.screenshotRelPath
    const flash = props.flashId === h.id
    for (const r of rectsOf(h)) {
      out.push({
        key: `${h.id}-${r.x.toFixed(3)}-${r.y.toFixed(3)}`,
        style: {
          left: `${r.x * 100}%`,
          top: `${r.y * 100}%`,
          width: `${r.width * 100}%`,
          height: `${r.height * 100}%`,
          backgroundColor: region ? 'transparent' : h.color || 'yellow',
        },
        excerpt: h.excerptText,
        region,
        flash,
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

/* V2.4：区域记录 → 细边框（不做文字底）。虚线便于与原图内容区分 */
.highlight-rect.region {
  opacity: 1;
  border: 1.5px dashed var(--el-color-warning);
}

/* V2.4：面板/新落库定位到某条高亮时，整组闪烁提示位置 */
.highlight-rect.flash {
  animation: hl-flash 1.4s ease-out 1;
}
@keyframes hl-flash {
  0% {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--el-color-warning) 70%, transparent);
  }
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--el-color-warning) 70%, transparent);
  }
}
</style>
