<template>
  <div
    ref="containerRef"
    class="pdf-viewer"
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
      class="page-wrap"
    >
      <canvas
        ref="canvasRef"
        class="pdf-canvas"
      />
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
 * 不能依赖 GlobalWorkerOptions.workerSrc——那会诱导 pdf.js 去 new Worker(file://)。
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
const canvasRef = ref<HTMLCanvasElement>()
// 必须用 shallowRef：pdf.js 文档对象含 class 私有字段（#pagesNumber 等），
// 若被 Vue 深度 reactive 代理，私有字段/WeakMap 身份校验会失败（报 Cannot read from private field）
const pdfDoc = shallowRef<pdfjsLib.PDFDocumentProxy | null>(null)
const loading = ref(false)
const error = ref('')

/** 当前页码与缩放（对外暴露，供工具栏双向操作） */
const pageNumber = ref(1)
const pageCount = ref(0)
const scale = ref(1)

let renderTask: pdfjsLib.RenderTask | null = null

/** 渲染当前页到 canvas，含 devicePixelRatio 缩放保证 Retina 清晰（由 pdf.js transform 参数处理） */
async function renderPage(): Promise<void> {
  if (!pdfDoc.value || !canvasRef.value) return
  const page = await pdfDoc.value.getPage(pageNumber.value)
  const viewport = page.getViewport({ scale: scale.value })
  const dpr = window.devicePixelRatio || 1

  const canvas = canvasRef.value
  canvas.width = Math.floor(viewport.width * dpr)
  canvas.height = Math.floor(viewport.height * dpr)
  canvas.style.width = `${Math.floor(viewport.width)}px`
  canvas.style.height = `${Math.floor(viewport.height)}px`

  renderTask?.cancel()
  renderTask = page.render({
    canvas,
    viewport,
    transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
  })
  await renderTask.promise
  renderTask = null
}

async function loadDoc(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    await ensureFakeWorker()
    pdfDoc.value = await pdfjsLib.getDocument({ url: props.src }).promise
    pageCount.value = pdfDoc.value.numPages
    pageNumber.value = Math.min(pageNumber.value, pageCount.value)
    emit('page-count', pageCount.value)
    // 等待 v-else 分支的 canvas 挂载完成后再渲染
    await nextTick()
    await renderPage()
  } catch (err) {
    console.error('[pdf] 加载失败:', err)
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

async function goToPage(n: number): Promise<void> {
  const target = Math.max(1, Math.min(n, pageCount.value || 1))
  if (target === pageNumber.value) return
  pageNumber.value = target
  emit('page-number', target)
  await renderPage()
}

async function nextPage(): Promise<void> {
  await goToPage(pageNumber.value + 1)
}

async function prevPage(): Promise<void> {
  await goToPage(pageNumber.value - 1)
}

/** 适配宽度：按容器宽度计算缩放 */
async function fitWidth(): Promise<void> {
  if (!pdfDoc.value || !containerRef.value) return
  const page = await pdfDoc.value.getPage(pageNumber.value)
  const viewport = page.getViewport({ scale: 1 })
  const containerWidth = containerRef.value.clientWidth
  if (containerWidth <= 0 || viewport.width <= 0) return
  scale.value = Math.max(0.2, Math.min(containerWidth / viewport.width, 5))
  await renderPage()
}

async function zoom(delta: number): Promise<void> {
  scale.value = Math.max(0.2, Math.min(scale.value + delta, 5))
  await renderPage()
}

watch(() => props.src, loadDoc)
onMounted(loadDoc)

onBeforeUnmount(() => {
  renderTask?.cancel()
  void pdfDoc.value?.destroy()
})

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

.page-wrap {
  display: flex;
  justify-content: center;
  padding: 16px 24px 32px;
}

.pdf-canvas {
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
}
</style>
