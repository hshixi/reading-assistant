<template>
  <div
    v-if="active"
    ref="overlayRef"
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
      按住拖拽框选区域（Esc 取消）
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Rect as SharedRect } from '@reading/shared'

/** V2 框选截图结果：归一化矩形（shared Rect）+ PNG dataURL + mouseup 视口坐标（定位迷你菜单用） */
export interface SelectionResult {
  page: number
  rect: SharedRect
  imageDataUrl: string
  /** V2.4：mouseup 视口坐标（Teleport 菜单锚点） */
  vx: number
  vy: number
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

const overlayRef = ref<HTMLElement | null>(null)
const start = ref<{ x: number; y: number } | null>(null)
/** 选区坐标。语义：**视口坐标**（captureSelection 按视口坐标对 canvas rect 求交，勿改） */
const rect = ref<Rect | null>(null)
/** overlay 相对视口原点的偏移（视觉矩形 = 视口坐标 - 此偏移） */
const origin = ref<{ left: number; top: number }>({ left: 0, top: 0 })
/** 起始点所在页（overlay 本地坐标），用于把拖拽视觉夹取在该页内 */
const pageBox = ref<Rect | null>(null)

/** overlay 本地坐标的视觉矩形（B2 修复：不能再把 clientX/Y 直接当本地坐标） */
const rectStyle = computed(() => {
  const r = rect.value
  if (!r) return {}
  return {
    left: `${r.x - origin.value.left}px`,
    top: `${r.y - origin.value.top}px`,
    width: `${r.w}px`,
    height: `${r.h}px`,
  }
})

/** 求某视口坐标点命中的页面区域（相对 overlay 的本地坐标）；无命中返回 null */
function pageBoxAt(x: number, y: number): Rect | null {
  const canvases = document.querySelectorAll<HTMLCanvasElement>('.pdf-canvas')
  for (const c of canvases) {
    const cr = c.getBoundingClientRect()
    if (x >= cr.left && x <= cr.right && y >= cr.top && y <= cr.bottom) {
      return {
        x: cr.left - origin.value.left,
        y: cr.top - origin.value.top,
        w: cr.width,
        h: cr.height,
      }
    }
  }
  return null
}

function onDown(e: MouseEvent): void {
  if (e.button !== 0) return
  const ov = overlayRef.value?.getBoundingClientRect()
  origin.value = ov ? { left: ov.left, top: ov.top } : { left: 0, top: 0 }
  pageBox.value = pageBoxAt(e.clientX, e.clientY)
  start.value = { x: e.clientX, y: e.clientY }
  rect.value = { x: e.clientX, y: e.clientY, w: 0, h: 0 }
  window.addEventListener('mouseup', onUp)
  e.preventDefault()
}

function onMove(e: MouseEvent): void {
  if (!start.value || !rect.value) return
  // 原始拖拽矩形（视口坐标）
  const vx = Math.min(start.value.x, e.clientX)
  const vy = Math.min(start.value.y, e.clientY)
  const vw = Math.abs(e.clientX - start.value.x)
  const vh = Math.abs(e.clientY - start.value.y)
  // 视觉夹取到起始页内（视口坐标表示），避免跨页/出页虚影
  const pb = pageBox.value
  if (pb) {
    const L = Math.max(vx, pb.x + origin.value.left)
    const T = Math.max(vy, pb.y + origin.value.top)
    const R = Math.min(vx + vw, pb.x + pb.w + origin.value.left)
    const B = Math.min(vy + vh, pb.y + pb.h + origin.value.top)
    if (R > L && B > T) {
      rect.value = { x: L, y: T, w: R - L, h: B - T }
      return
    }
  }
  rect.value = { x: vx, y: vy, w: vw, h: vh }
}

function onUp(e: MouseEvent): void {
  window.removeEventListener('mouseup', onUp)
  if (!start.value || !rect.value) return
  const r = rect.value
  start.value = null
  rect.value = null
  pageBox.value = null
  if (r.w < 4 || r.h < 4) return
  const sel = captureSelection(r)
  // V2.4：附上 mouseup 视口坐标，ReaderView 据此把迷你菜单锚在选区旁
  if (sel) emit('selection', { ...sel, vx: e.clientX, vy: e.clientY })
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    start.value = null
    rect.value = null
    emit('cancel')
  }
}

/** captureSelection 产出不含锚点坐标（mouseup 后由 onUp 补 vx/vy） */
type CapturedSelection = Omit<SelectionResult, 'vx' | 'vy'>

/**
 * 把视口坐标选区换算到命中的页（选区与页边界求交），
 * 并按物理像素从源 canvas 截图，保证 Retina 2x 下与选区无偏移。
 */
function captureSelection(sel: Rect): CapturedSelection | null {
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
  const rect: SharedRect = {
    x: (l - bestRect.left) / cw,
    y: (t - bestRect.top) / ch,
    width: lw / cw,
    height: lh / ch,
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

  return { page, rect, imageDataUrl }
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
