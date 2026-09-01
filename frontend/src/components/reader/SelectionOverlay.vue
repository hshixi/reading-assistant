<template>
  <div
    v-if="active"
    class="selection-overlay"
    @mousedown="onDown"
    @mousemove="onMove"
  >
    <div
      v-show="rect"
      class="selection-rect"
      :style="rectStyle"
    />
    <div class="selection-hint">
      按住拖拽框选要发送给 AI 的区域（Esc 取消）
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

/** 归一化矩形：坐标相对页面 CSS 尺寸，取值 [0,1]，随缩放自适应 */
export interface RectNorm {
  x: number
  y: number
  w: number
  h: number
}

export interface SelectionResult {
  page: number
  rectNorm: RectNorm
  imageDataUrl: string
}

const props = defineProps<{ active: boolean }>()
const emit = defineEmits<{
  selection: [sel: SelectionResult]
  cancel: []
}>()

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const start = ref<{ x: number; y: number } | null>(null)
const rect = ref<Rect | null>(null)

const rectStyle = computed(() => {
  const r = rect.value
  if (!r) return {}
  return {
    left: `${r.x}px`,
    top: `${r.y}px`,
    width: `${r.w}px`,
    height: `${r.h}px`,
  }
})

function onDown(e: MouseEvent): void {
  if (e.button !== 0) return
  start.value = { x: e.clientX, y: e.clientY }
  rect.value = { x: e.clientX, y: e.clientY, w: 0, h: 0 }
  window.addEventListener('mouseup', onUp)
  e.preventDefault()
}

function onMove(e: MouseEvent): void {
  if (!start.value || !rect.value) return
  rect.value = {
    x: Math.min(start.value.x, e.clientX),
    y: Math.min(start.value.y, e.clientY),
    w: Math.abs(e.clientX - start.value.x),
    h: Math.abs(e.clientY - start.value.y),
  }
}

function onUp(): void {
  window.removeEventListener('mouseup', onUp)
  if (!start.value || !rect.value) return
  const r = rect.value
  start.value = null
  rect.value = null
  if (r.w < 4 || r.h < 4) return
  const sel = captureSelection(r)
  if (sel) emit('selection', sel)
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    start.value = null
    rect.value = null
    emit('cancel')
  }
}

/**
 * 把视口坐标选区换算到命中的页（选区与页边界求交），
 * 并按物理像素从源 canvas 截图，保证 Retina 2x 下与选区无偏移。
 */
function captureSelection(sel: Rect): SelectionResult | null {
  const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>('.pdf-canvas'))
  let best: HTMLCanvasElement | null = null
  let bestRect: DOMRect | null = null
  let bestArea = 0
  for (const c of canvases) {
    const cr = c.getBoundingClientRect()
    const ix = Math.max(0, Math.min(sel.x + sel.w, cr.right) - Math.max(sel.x, cr.left))
    const iy = Math.max(0, Math.min(sel.y + sel.h, cr.bottom) - Math.max(sel.y, cr.top))
    const area = ix * iy
    if (area > bestArea) {
      bestArea = area
      best = c
      bestRect = cr
    }
  }
  if (!best || !bestRect || bestArea < 4) return null

  const page = Number(best.dataset.page || 0)
  if (page <= 0) return null

  // 与页面边界求交，得到页内选区
  const l = Math.max(bestRect.left, sel.x)
  const t = Math.max(bestRect.top, sel.y)
  const r = Math.min(bestRect.right, sel.x + sel.w)
  const b = Math.min(bestRect.bottom, sel.y + sel.h)
  const lw = r - l
  const lh = b - t
  if (lw < 4 || lh < 4) return null

  const cw = bestRect.width
  const ch = bestRect.height
  if (cw <= 0 || ch <= 0) return null
  const rectNorm: RectNorm = {
    x: (l - bestRect.left) / cw,
    y: (t - bestRect.top) / ch,
    w: lw / cw,
    h: lh / ch,
  }

  // 物理像素截图（源 canvas 像素密度），避免 Retina 模糊
  const dprX = best.width / cw
  const dprY = best.height / ch
  const sx = Math.max(0, Math.round((l - bestRect.left) * dprX))
  const sy = Math.max(0, Math.round((t - bestRect.top) * dprY))
  const sw = Math.max(1, Math.round(lw * dprX))
  const sh = Math.max(1, Math.round(lh * dprY))
  const out = document.createElement('canvas')
  out.width = sw
  out.height = sh
  const ctx = out.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(best, sx, sy, sw, sh, 0, 0, sw, sh)
  const imageDataUrl = out.toDataURL('image/png')

  return { page, rectNorm, imageDataUrl }
}

watch(
  () => props.active,
  (active) => {
    if (active) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  },
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('mouseup', onUp)
})
</script>

<style scoped>
.selection-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  cursor: crosshair;
  background: rgba(0, 0, 0, 0.02);
}

.selection-rect {
  position: absolute;
  background: rgba(64, 128, 255, 0.18);
  border: 1.5px solid #2b7de9;
  border-radius: 2px;
  pointer-events: none;
}

.selection-hint {
  position: absolute;
  left: 50%;
  top: 12px;
  transform: translateX(-50%);
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.78);
  color: #fff;
  font-size: 13px;
  pointer-events: none;
}
</style>
