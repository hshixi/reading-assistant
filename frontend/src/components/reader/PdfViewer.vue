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
        <!-- .page-wrap 依当前缩放显式定尺寸（高亮/注释等覆盖层按百分比对齐，且 canvas 未就绪时页面框已占位） -->
        <div
          class="page-wrap"
          :style="wrapStyle(p.num)"
        >
          <canvas
            :ref="setCanvas(p.num)"
            :data-page="p.num"
            class="pdf-canvas"
          />
          <!-- V2-F6：原生文本选择层。canvas < 高亮(slot) < 文本层，保证文本可选中 -->
          <slot
            name="page"
            :num="p.num"
          />
          <div
            :ref="setTextContainer(p.num)"
            class="textLayer"
            :data-page-text="p.num"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import * as pdfjsLib from 'pdfjs-dist'
import type { TextContent } from 'pdfjs-dist/types/src/display/api'
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
const emit = defineEmits<{
  'page-count': [count: number]
  'page-number': [n: number]
  /** 文档加载并完成首屏布局/自适应（fitWidth 后）：宿主可安全 goToPage 恢复到上次阅读页 */
  loaded: []
}>()

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

/**
 * B1：可见窗口半径。比 V1 的 ±2 放宽到 ±4，让「刚从窗口底部进入」的新页
 * 有足够的异步渲染提前量，进入视口时通常已就绪，消除滚动闪白。
 */
const RENDER_MARGIN = 4

/**
 * B1：已渲染页面内容的离屏快照缓存（num + scale + dpr 为键）。
 * 页面滚出 DOM 窗口时 canvas 被卸载，但内容以快照保留；同缩放回看时
 * 直接整帧 blit 复用，跳过整次异步渲染 → 滚动上下往返不再闪白。
 */
const snapCache = new Map<string, HTMLCanvasElement>()
const SNAP_CAP = 40

function snapKey(num: number, scale: number, dpr: number): string {
  return `${num}@${Math.round(scale * 100)}@${dpr}`
}

function cacheSnap(key: string, canvas: HTMLCanvasElement): void {
  snapCache.set(key, canvas)
  if (snapCache.size > SNAP_CAP) {
    const oldest = snapCache.keys().next().value
    if (oldest !== undefined) snapCache.delete(oldest)
  }
}

function clearSnaps(): void {
  snapCache.clear()
}

/**
 * 把已渲染的离屏帧整帧写进目标 canvas（先定 bitmap 尺寸后一次性 drawImage，
 * 无中间空白帧）。canvas 的 CSS 尺寸由 .pdf-canvas 的 width/height:100% 跟随
 * .page-wrap（wrap 已按当前缩放定尺寸），因此这里只需设 bitmap 缓冲。
 */
function blitInto(target: HTMLCanvasElement, src: HTMLCanvasElement): void {
  if (target.width !== src.width) target.width = src.width
  if (target.height !== src.height) target.height = src.height
  const ctx = target.getContext('2d')
  ctx?.drawImage(src, 0, 0)
}

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

/** 单页 .page-wrap 尺寸（px，依当前缩放）；canvas 以 100% 填充，覆盖层按百分比对齐 */
function wrapStyle(num: number): Record<string, string> {
  const s = sizes[num - 1]
  if (!s) return {}
  return {
    width: `${Math.round(s.w * scale.value)}px`,
    height: `${Math.round(s.h * scale.value)}px`,
  }
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
  const start = Math.max(0, (first < 0 ? 0 : first) - RENDER_MARGIN)
  const end = Math.min(pageCount.value - 1, Math.max(first, last) + RENDER_MARGIN)
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

/**
 * 渲染单页到 canvas（Retina 由 transform 处理），非显渲染由 nonce 作废。
 * B1：离屏渲染到 tmp，完成后一次性 blit 上屏 + 存快照。
 *  - 命中同缩放快照 → 直接整帧复用（回看/往返滚动不再闪白）
 *  - 渲染期间不动目标 canvas（保留旧帧），完成后才定尺寸+drawImage → 无空白中间帧
 */
async function renderPageCanvas(num: number, canvas: HTMLCanvasElement, nonce: number): Promise<void> {
  const doc = pdfDoc.value
  if (!doc) return
  try {
    const page = await doc.getPage(num)
    if (nonce !== layoutNonce) return
    const dpr = window.devicePixelRatio || 1
    const key = snapKey(num, scale.value, dpr)
    const snap = snapCache.get(key)
    if (snap) {
      blitInto(canvas, snap)
      return
    }
    const vp = page.getViewport({ scale: scale.value })
    if (nonce !== layoutNonce) return
    const tmp = document.createElement('canvas')
    tmp.width = Math.floor(vp.width * dpr)
    tmp.height = Math.floor(vp.height * dpr)
    if (nonce !== layoutNonce) return
    const task = page.render({
      canvas: tmp,
      viewport: vp,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
    })
    renderTasks.set(num, task)
    try {
      await task.promise
    } catch {
      return // cancelled：丢弃离屏帧
    } finally {
      renderTasks.delete(num)
    }
    if (nonce !== layoutNonce) return
    cacheSnap(key, tmp)
    blitInto(canvas, tmp)
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

/* ---------- V2-F6：文本层（原生选区） ----------
 * 每可见页 .page-wrap 内挂透明 span，支持原生拖选文本。
 * pdf.js TextLayer 依赖宿主在容器上设 --total-scale-factor（= 当前 CSS 缩放），
 * 缩放变化时按页重建（TextContent 已缓存，重建轻量）。
 */

const textContainers = new Map<number, HTMLDivElement>()
const textLayers = new Map<number, pdfjsLib.TextLayer>()
/** 每页文本内容缓存（跨缩放复用，避免重复走 worker 提取） */
const textContents = new Map<number, TextContent>()
/** 每页已渲染的缩放值（避免同缩放重复 render） */
const renderedTextScale = new Map<number, number>()

function setTextContainer(num: number): (el: unknown) => void {
  return (el: unknown) => {
    if (el instanceof HTMLDivElement) textContainers.set(num, el)
    else textContainers.delete(num)
  }
}

async function renderPageText(num: number, nonce: number): Promise<void> {
  const doc = pdfDoc.value
  const container = textContainers.get(num)
  if (!doc || !container) return
  if (renderedTextScale.get(num) === scale.value) return
  const prev = textLayers.get(num)
  if (prev) {
    prev.cancel()
    textLayers.delete(num)
  }
  try {
    const page = await doc.getPage(num)
    if (nonce !== layoutNonce) return
    const viewport = page.getViewport({ scale: scale.value })
    let tc = textContents.get(num)
    if (!tc) {
      tc = await page.getTextContent()
      if (nonce !== layoutNonce) return
      textContents.set(num, tc)
    }
    if (nonce !== layoutNonce) return
    // pdf.js 依据这些 CSS 变量计算容器尺寸与字号
    container.replaceChildren()
    container.style.setProperty('--total-scale-factor', String(scale.value))
    container.style.setProperty('--scale-round-x', '1px')
    container.style.setProperty('--scale-round-y', '1px')
    const tl = new pdfjsLib.TextLayer({ textContentSource: tc, container, viewport })
    textLayers.set(num, tl)
    renderedTextScale.set(num, scale.value)
    await tl.render()
    if (nonce !== layoutNonce) textLayers.delete(num)
  } catch (err) {
    renderedTextScale.delete(num)
    if (nonce === layoutNonce) console.warn(`[pdf] 第 ${num} 页文本层失败:`, err)
  }
}

/** Vue patch 后为所有已挂载可见页补齐文本层（未以当前缩放渲染的才渲染） */
async function syncTextLayers(): Promise<void> {
  const nonce = layoutNonce
  await nextTick()
  if (nonce !== layoutNonce) return
  for (const p of visiblePages.value) {
    if (textContainers.has(p.num)) void renderPageText(p.num, nonce)
  }
}

/** 清空全部文本层（切文档/销毁） */
function clearTextLayers(): void {
  for (const tl of textLayers.values()) tl.cancel()
  textLayers.clear()
  textContainers.clear()
  textContents.clear()
  renderedTextScale.clear()
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
    void syncTextLayers()
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
  void syncTextLayers()
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
  void syncTextLayers()
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
  clearSnaps()
  clearTextLayers()
  layoutNonce++
  pageNumber.value = 1
  pageCount.value = 0
  sizes.length = 0
  offsets.length = 0
  cancelAllTasks()
  visiblePages.value = []
  try {
    await ensureFakeWorker()
    // V2.3：pdf.js v5 的 JBIG2/JPEG2000/ICC 解码需 .wasm（wasmUrl 必须带尾斜杠）。
    // 渲染层 file:// 无法 fetch file:// 资源，由后端经 http://127.0.0.1/pdfjs/wasm/ 提供。
    const wasmUrl = new URL(props.src, window.location.href).origin + '/pdfjs/wasm/'
    const doc = await pdfjsLib.getDocument({ url: props.src, wasmUrl }).promise
    pdfDoc.value = doc
    pageCount.value = doc.numPages
    emit('page-count', pageCount.value)
    await fetchAllSizes()
    computeOffsets()
    await fitWidth()
    updateVisible()
    await syncVisibleCanvases()
    void syncTextLayers()
    updateCurrentPage()
    emit('loaded')
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
  clearSnaps()
  clearTextLayers()
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
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
}
</style>

<!-- V2-F6：pdf.js TextLayer 所需最小样式（非 scoped，作用于文本容器）：
     span 透明文字只作选区命中区；::selection 用主题色保证浅/暗均可见。
     --total-scale-factor/--scale-round-x 等由 PdfViewer 渲染时在容器上设置。 -->
<style>
.textLayer {
  position: absolute;
  text-align: initial;
  inset: 0;
  overflow: hidden;
  opacity: 1;
  line-height: 1;
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
  transform-origin: 0 0;
  caret-color: CanvasText;
  z-index: 2;
  user-select: text;
}

.textLayer :is(span, br) {
  color: transparent;
  position: absolute;
  white-space: pre;
  cursor: text;
  transform-origin: 0% 0%;
}

.textLayer {
  --min-font-size: 1;
  --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
  --min-font-size-inv: calc(1 / var(--min-font-size));
}

.textLayer > :not(.markedContent),
.textLayer .markedContent span:not(.markedContent) {
  z-index: 1;
  --font-height: 0;
  font-size: calc(var(--text-scale-factor) * var(--font-height));
  --scale-x: 1;
  --rotate: 0deg;
  transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
}

.textLayer ::selection,
.textLayer ::-moz-selection {
  background: color-mix(in srgb, var(--el-color-primary, #409eff) 32%, transparent);
}

.textLayer .endOfContent {
  display: block;
  position: absolute;
  inset: 100% 0 0;
  z-index: 0;
  cursor: default;
  -webkit-user-select: none;
  user-select: none;
}
</style>
