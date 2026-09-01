<template>
  <div
    ref="containerRef"
    class="pdf-viewer"
    @scroll.passive="onScroll"
  >
    <div
      v-if="!pdfDoc"
      class="viewer-state"
    >
      <div
        v-if="loading"
        class="loading-text"
      >
        正在加载文档…
      </div>
      <el-empty
        v-else-if="error"
        :description="error"
      >
        <el-button
          type="primary"
          size="small"
          @click="loadDoc"
        >
          重试
        </el-button>
      </el-empty>
    </div>

    <div
      v-else
      class="pages-column"
      :style="{ height: `${totalHeight}px` }"
    >
      <!-- 虚拟化：只挂载视口 ±2 页的 canvas，其余以绝对定位占位 -->
      <div
        v-for="p in visiblePages"
        :key="p.num"
        class="page-item"
        :style="{ top: `${p.top}px` }"
      >
        <!-- .page-wrap 与 canvas 同尺寸（相对定位），供高亮/注释等覆盖层按百分比对齐 -->
        <div class="page-wrap">
          <canvas
            :ref="setCanvas(p.num)"
            :data-page="p.num"
            class="pdf-canvas"
          />
          <slot
            name="page"
            :num="p.num"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
// ?url 让 Vite 原样拷贝 worker 文件（不经 esbuild 重打包，否则 pdf.js 私有字段被破坏）
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

/**
 * 让 pdf.js 走「主线程 fake worker」：在主线程 import 一次 worker 模块，
 * 触发其顶部的 `globalThis.pdfjsWorker = { WorkerMessageHandler }`。
 * pdf.js 的 PDFWorker 检测到该全局对象后就不再创建真实 Worker，
 * 从而绕开 file:// 下 Chromium 禁止加载模块 Worker 的问题（已实测 onerror: undefined）。
 */
let fakeWorkerReady: Promise<void> | null = null
async function ensureFakeWorker(): Promise<void> {
  if (!fakeWorkerReady) {
    fakeWorkerReady = import(/* @vite-ignore */ workerUrl)
      .then((mod) => {
        ;(globalThis as Record<string, unknown>).pdfjsWorker = mod
      })
      .catch((err) => {
        console.error('[pdf] fake worker 加载失败:', err)
        fakeWorkerReady = null
        throw err
      })
  }
  return fakeWorkerReady
}

const props = defineProps<{ src: string }>()
const emit = defineEmits<{ 'page-count': [count: number]; 'page-number': [n: number] }>()

const containerRef = ref<HTMLDivElement>()
// 必须用 shallowRef：pdf.js 文档对象含 class 私有字段，Vue 深度 reactive 代理会破坏其身份
const pdfDoc = shallowRef<pdfjsLib.PDFDocumentProxy | null>(null)
const loading = ref(false)
const error = ref('')

const pageNumber = ref(1)
const pageCount = ref(0)
const scale = ref(1)

/** 连续滚动布局常量 */
const GAP = 16
const PAD_TOP = 16
const PAD_BOTTOM = 24

interface PageSize {
  w: number
  h: number
}
/** 每页基准尺寸（scale=1），index = 页码-1；一次取全量，offets 即可纯同步推算 */
const sizes: PageSize[] = []
/** 每页在当前 scale 下的顶部偏移（px） */
const offsets: number[] = []
const totalHeight = ref(0)

/** 视口内 ±2 页的可见页（页码 1 起），驱动 v-for 挂载 canvas */
const visiblePages = ref<{ num: number; top: number }[]>([])

const canvasEls = new Map<number, HTMLCanvasElement>()
const renderTasks = new Map<number, pdfjsLib.RenderTask>()

/** 布局/渲染版本号：任何一次重排递增，旧的非显式渲染即作废 */
let layoutNonce = 0
let scrollRaf = 0

/* ---------- 工具函数 ---------- */

/** 返回包含 y 坐标的页索引（二分，最大满足 offsets[i] <= y） */
function pageIndexAt(y: number): number {
  let lo = 0
  let hi = offsets.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (offsets[mid] <= y) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans
}

/** 依当前 scale 与 sizes 重算偏移与总高 */
function computeOffsets(): void {
  offsets.length = 0
  let y = PAD_TOP
  for (const s of sizes) {
    offsets.push(y)
    y += s.h * scale.value + GAP
  }
  totalHeight.value = Math.max(0, y - GAP + PAD_BOTTOM)
}

/** 依滚动位置计算可见范围（±2 页）并重建 visiblePages */
function updateVisible(): void {
  const el = containerRef.value
  if (!el || !pdfDoc.value || offsets.length === 0) {
    visiblePages.value = []
    return
  }
  const st = el.scrollTop
  const vh = el.clientHeight
  const first = pageIndexAt(st)
  const last = pageIndexAt(st + vh)
  const start = Math.max(0, (first < 0 ? 0 : first) - 2)
  const end = Math.min(pageCount.value - 1, Math.max(first, last) + 2)
  const pages: { num: number; top: number }[] = []
  for (let i = start; i <= end; i++) {
    pages.push({ num: i + 1, top: offsets[i] })
  }
  visiblePages.value = pages
  cancelTasksOutOfRange()
}

function cancelTasksOutOfRange(): void {
  const inRange = new Set(visiblePages.value.map((p) => p.num))
  for (const [num, task] of renderTasks) {
    if (!inRange.has(num)) {
      task.cancel()
      renderTasks.delete(num)
    }
  }
}

function cancelAllTasks(): void {
  for (const task of renderTasks.values()) task.cancel()
  renderTasks.clear()
}

/** 渲染单页到 canvas（Retina 由 transform 处理），非显渲染由 nonce 作废 */
async function renderPageCanvas(num: number, canvas: HTMLCanvasElement, nonce: number): Promise<void> {
  const doc = pdfDoc.value
  if (!doc) return
  try {
    const page = await doc.getPage(num)
    if (nonce !== layoutNonce) return
    const vp = page.getViewport({ scale: scale.value })
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(vp.width * dpr)
    canvas.height = Math.floor(vp.height * dpr)
    canvas.style.width = `${Math.floor(vp.width)}px`
    canvas.style.height = `${Math.floor(vp.height)}px`
    if (nonce !== layoutNonce) return
    const task = page.render({
      canvas,
      viewport: vp,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
    })
    renderTasks.set(num, task)
    try {
      await task.promise
    } catch {
      /* cancelled */
    } finally {
      renderTasks.delete(num)
    }
  } catch (err) {
    if (nonce === layoutNonce) console.error(`[pdf] 第 ${num} 页渲染失败:`, err)
  }
}

/** Vue patch 后补齐可见页的 canvas 渲染（未渲染的才渲染） */
async function syncVisibleCanvases(): Promise<void> {
  const nonce = layoutNonce
  await nextTick()
  if (nonce !== layoutNonce) return
  for (const p of visiblePages.value) {
    const canvas = canvasEls.get(p.num)
    if (canvas && !renderTasks.has(p.num)) {
      void renderPageCanvas(p.num, canvas, nonce)
    }
  }
}

/** 依视口中心更新「当前页」并 emit（工具栏/书签联动） */
function updateCurrentPage(): void {
  const el = containerRef.value
  if (!el || offsets.length === 0) return
  const idx = pageIndexAt(el.scrollTop + el.clientHeight / 2)
  const n = idx + 1
  if (idx >= 0 && n !== pageNumber.value) {
    pageNumber.value = n
    emit('page-number', n)
  }
}

function onScroll(): void {
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    updateVisible()
    void syncVisibleCanvases()
    updateCurrentPage()
  })
}

/* ---------- 布局与缩放 ---------- */

/** 一次取全量页面基准尺寸（顺带预热 page cache），此后布局同步推算 */
async function fetchAllSizes(): Promise<void> {
  const doc = pdfDoc.value
  if (!doc) return
  sizes.length = 0
  await Promise.all(
    Array.from({ length: pageCount.value }, (_, i) =>
      doc.getPage(i + 1).then((page) => {
        const vp = page.getViewport({ scale: 1 })
        sizes[i] = { w: vp.width, h: vp.height }
      }),
    ),
  )
}

/** 应用缩放：以「视口顶端所在的页」为锚，缩放后回到该页顶部，避免视图跳变 */
async function applyScale(newScale: number): Promise<void> {
  const el = containerRef.value
  const anchorIdx = el ? pageIndexAt(el.scrollTop) : -1
  scale.value = newScale
  layoutNonce++
  computeOffsets()
  cancelAllTasks()
  updateVisible()
  await syncVisibleCanvases()
  if (el && anchorIdx >= 0) {
    el.scrollTop = Math.max(0, offsets[anchorIdx] ?? 0)
    updateVisible()
    updateCurrentPage()
  }
}

async function fitWidth(): Promise<void> {
  const el = containerRef.value
  if (!el || sizes.length === 0) return
  const cw = el.clientWidth
  const base = sizes[0].w
  if (cw <= 0 || base <= 0) return
  await applyScale(Math.max(0.2, Math.min(cw / base, 5)))
}

async function zoom(delta: number): Promise<void> {
  const s = Math.max(0.2, Math.min(scale.value + delta, 5))
  if (s !== scale.value) await applyScale(s)
}

async function goToPage(n: number): Promise<void> {
  const target = Math.max(1, Math.min(n, pageCount.value || 1))
  const el = containerRef.value
  if (!el) {
    pageNumber.value = target
    emit('page-number', target)
    return
  }
  if (offsets.length > 0) {
    el.scrollTop = Math.max(0, offsets[target - 1] - 8)
  }
  pageNumber.value = target
  emit('page-number', target)
  updateVisible()
  await syncVisibleCanvases()
}

async function nextPage(): Promise<void> {
  await goToPage(pageNumber.value + 1)
}

async function prevPage(): Promise<void> {
  await goToPage(pageNumber.value - 1)
}

/* ---------- 生命周期 ---------- */

async function loadDoc(): Promise<void> {
  loading.value = true
  error.value = ''
  layoutNonce++
  pageNumber.value = 1
  pageCount.value = 0
  sizes.length = 0
  offsets.length = 0
  cancelAllTasks()
  visiblePages.value = []
  try {
    await ensureFakeWorker()
    const doc = await pdfjsLib.getDocument({ url: props.src }).promise
    pdfDoc.value = doc
    pageCount.value = doc.numPages
    emit('page-count', pageCount.value)
    await fetchAllSizes()
    computeOffsets()
    await fitWidth()
    updateVisible()
    await syncVisibleCanvases()
    updateCurrentPage()
  } catch (err) {
    console.error('[pdf] 加载失败:', err)
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

function destroy(): void {
  layoutNonce++
  cancelAllTasks()
  void pdfDoc.value?.destroy()
  pdfDoc.value = null
}

function setCanvas(num: number): (el: unknown) => void {
  return (el: unknown) => {
    if (el instanceof HTMLCanvasElement) canvasEls.set(num, el)
    else canvasEls.delete(num)
  }
}

watch(() => props.src, loadDoc)
onMounted(loadDoc)
onBeforeUnmount(destroy)

defineExpose({ pageNumber, pageCount, scale, goToPage, nextPage, prevPage, fitWidth, zoom })
</script>

<style scoped>
.pdf-viewer {
  height: 100%;
  overflow: auto;
  background: var(--el-fill-color-lighter, #f0f1f3);
  scrollbar-width: thin;
}

.viewer-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  padding: 24px;
}

.loading-text {
  color: var(--el-text-color-secondary);
}

.pages-column {
  position: relative;
  width: 100%;
}

.page-item {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
}

/* 包裹 canvas，尺寸即内容尺寸；覆盖层（高亮）absolute 相对它定位 */
.page-wrap {
  position: relative;
}

.pdf-canvas {
  display: block;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
}
</style>
