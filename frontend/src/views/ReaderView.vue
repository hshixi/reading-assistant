<template>
  <div class="reader">
    <header class="reader-header">
      <el-button
        link
        @click="$router.push('/')"
      >
        <el-icon><ArrowLeft /></el-icon>
        <span>书架</span>
      </el-button>
      <span
        class="reader-title"
        :title="readerStore.book?.title"
      >
        {{ readerStore.book?.title ?? `书籍 #${bookId}` }}
      </span>
      <span
        v-if="loadError"
        class="header-error"
      >{{ loadError }}</span>
      <ThemeToggle class="header-theme" />
    </header>

    <div class="reader-toolbar">
      <el-button-group>
        <el-button
          size="small"
          :disabled="page <= 1"
          @click="goTo(page - 1)"
        >
          上一页
        </el-button>
        <el-button
          size="small"
          :disabled="page >= pageCount"
          @click="goTo(page + 1)"
        >
          下一页
        </el-button>
      </el-button-group>

      <div class="page-jump">
        <el-input-number
          v-model="page"
          size="small"
          :min="1"
          :max="Math.max(pageCount, 1)"
          controls-position="right"
          @change="(v: number | undefined) => goTo(v ?? 1)"
        />
        <span class="page-total">/ {{ pageCount || '…' }}</span>
      </div>

      <div class="zoom-group">
        <el-button-group>
          <el-button
            size="small"
            title="缩小"
            @click="viewerRef?.zoom(-0.1)"
          >
            -
          </el-button>
          <el-button
            size="small"
            title="放大"
            @click="viewerRef?.zoom(0.1)"
          >
            +
          </el-button>
        </el-button-group>
      </div>

      <el-button
        size="small"
        @click="toggleRight"
      >
        {{ showRight ? '收起侧栏' : '侧栏' }}
      </el-button>
    </div>

    <div
      ref="bodyRef"
      class="reader-body"
    >
      <main
        v-loading="loading"
        class="reader-main"
        @contextmenu="onPdfContextMenu"
        @pointerdown="onMainPointerDown"
        @pointerup="onMainPointerUp"
        @mousemove="onMainMove"
        @click="onMainClick"
      >
        <PdfViewer
          v-if="src && !loadError"
          ref="viewerRef"
          :src="src"
          @page-count="onPageCount"
          @page-number="page = $event"
          @loaded="onPdfLoaded"
        >
          <!-- M11：每页包裹层内渲染高亮覆盖层（slot 按页码传入，百分比定位随缩放自适应） -->
          <template #page="{ num }">
            <HighlightLayer :page="num" />
            <!-- V2-F7：笔记原文下划线层 -->
            <NoteMarkLayer :page="num" />
          </template>
        </PdfViewer>
        <el-empty
          v-else
          description="无法加载书籍"
        />
        <SelectionOverlay
          v-if="src && !loadError"
          :active="readerStore.selecting"
          @selection="onSelection"
          @cancel="readerStore.cancelSelect"
        />
      </main>

      <!-- V2-F2：PDF 区与聊天区的可拖分隔线 -->
      <div
        v-if="showRight"
        class="reader-splitter"
        :class="{ dragging: splitDragging }"
        title="拖拽调整面板宽度"
        @mousedown="startSplitDrag"
      />
      <!-- V2-F6：选文右键菜单（Teleport 到 body，位置由 selMenu 给定） -->
      <TextSelectionMenu
        :visible="!!selMenu"
        :x="selMenu?.x ?? 0"
        :y="selMenu?.y ?? 0"
        :payload="selMenu?.payload ?? null"
        @action="onMenuAction"
        @close="selMenu = null"
      />
      <!-- N6-F5：点击页面上已有高亮 → 小卡片（显示原文 / 删除高亮） -->
      <HighlightPopover
        :visible="hlPopId !== null"
        :x="hlPopX"
        :y="hlPopY"
        :highlight-id="hlPopId"
        @close="closeHlPopover"
      />
      <!-- V2-F7：悬停笔记下划线 → 批注浮窗（pointer-events:none，不挡阅读/拖选） -->
      <NoteHoverTooltip
        :visible="noteHover !== null"
        :x="noteHover?.x ?? 0"
        :y="noteHover?.y ?? 0"
        :note-id="noteHover?.noteId ?? null"
      />

      <aside
        v-if="showRight"
        class="reader-chat"
        :style="{ width: `${layout.readerChatWidth}px` }"
      >
        <div class="right-tabs">
          <button
            class="right-tab"
            :class="{ active: rightTab === 'chat' }"
            @click="rightTab = 'chat'"
          >
            聊天
          </button>
          <button
            class="right-tab"
            :class="{ active: rightTab === 'notes' }"
            @click="rightTab = 'notes'"
          >
            笔记
          </button>
          <button
            class="right-tab"
            :class="{ active: rightTab === 'highlights' }"
            @click="rightTab = 'highlights'"
          >
            高亮
          </button>
        </div>
        <div class="right-body">
          <ChatPanel v-show="rightTab === 'chat'" />
          <NotesPanel
            v-show="rightTab === 'notes'"
            :draft="noteDraft"
            :focus-id="noteFocusId"
            @jump="goTo"
            @dismiss="noteDraft = null"
            @focused="noteFocusId = null"
          />
          <HighlightsPanel
            v-show="rightTab === 'highlights'"
            @jump="goTo"
          />
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import PdfViewer from '@/components/reader/PdfViewer.vue'
import SelectionOverlay, {
  type SelectionResult,
} from '@/components/reader/SelectionOverlay.vue'
import HighlightLayer from '@/components/reader/HighlightLayer.vue'
import NoteMarkLayer from '@/components/reader/NoteMarkLayer.vue'
import NoteHoverTooltip from '@/components/reader/NoteHoverTooltip.vue'
import TextSelectionMenu, {
  type TextAction,
} from '@/components/reader/TextSelectionMenu.vue'
import HighlightPopover from '@/components/reader/HighlightPopover.vue'
import HighlightsPanel from '@/components/highlights/HighlightsPanel.vue'
import type { TextSelectionPayload } from '@/stores/reader'
import type { Book, Highlight, Rect, Note } from '@reading/shared'
import type { NoteDraft } from '@/components/notes/noteDraft'
import ChatPanel from '@/components/chat/ChatPanel.vue'
import NotesPanel from '@/components/notes/NotesPanel.vue'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import { getBook, updateBook } from '@/api/books'
import { bookFileUrl } from '@/api/client'
import { useReaderStore } from '@/stores/reader'
import { useChatStore } from '@/stores/chat'
import { useNotesStore } from '@/stores/notes'
import { useLayoutStore } from '@/stores/layout'

const route = useRoute()
const readerStore = useReaderStore()
const chatStore = useChatStore()
const notesStore = useNotesStore()
const layout = useLayoutStore()

const bookId = computed(() => Number(route.params.bookId))
const viewerRef = ref<InstanceType<typeof PdfViewer> | null>(null)

const page = ref(1)
const pageCount = ref(0)
const src = ref('')
const loading = ref(false)
const loadError = ref('')
const showRight = ref(true)
const rightTab = ref<'chat' | 'notes' | 'highlights'>('chat')

/* ---- V2-F6：选文右键菜单状态 ---- */
const selMenu = ref<{ x: number; y: number; payload: TextSelectionPayload } | null>(null)

/* ---- N6-F5：页面高亮点击 → 小卡片（显示原文 / 删除高亮） ---- */
const hlPopId = ref<number | null>(null)
const hlPopX = ref(0)
const hlPopY = ref(0)
/** main 上最近一次 pointerdown 记录：过滤拖拽选择后的 click */
let lastDown: { x: number; y: number; t: number; hadSel: boolean } | null = null
/** 延迟打开定时器：给双击选词留时间（新 pointerdown 即取消） */
let pendingPopTimer: ReturnType<typeof setTimeout> | null = null

/* ---- V2-F7：笔记 —— 右键写批注草稿 / 悬停浮窗 / 点击定位 ---- */
const noteDraft = ref<NoteDraft | null>(null)
const noteFocusId = ref<number | null>(null)
const noteHover = ref<{ x: number; y: number; noteId: number } | null>(null)
/** hover 命中重算节流 */
let lastHoverAt = 0

/* ---- V2-F2：可拖分隔线 ---- */
const bodyRef = ref<HTMLElement | null>(null)
const splitDragging = ref(false)

function startSplitDrag(e: MouseEvent): void {
  if (e.button !== 0) return
  e.preventDefault()
  splitDragging.value = true
  document.body.classList.add('resizing-cols')
  window.addEventListener('mousemove', onSplitMove)
  window.addEventListener('mouseup', endSplitDrag)
}

function onSplitMove(e: MouseEvent): void {
  if (!splitDragging.value || !bodyRef.value) return
  // 聊天面板右侧贴 body 右缘：宽度 = body 右缘 - 光标 x
  const body = bodyRef.value.getBoundingClientRect()
  layout.setReaderChatWidth(body.right - e.clientX)
}

function endSplitDrag(): void {
  if (!splitDragging.value) return
  splitDragging.value = false
  document.body.classList.remove('resizing-cols')
  window.removeEventListener('mousemove', onSplitMove)
  window.removeEventListener('mouseup', endSplitDrag)
  // 面板宽度变化 → PDF 区重新适配宽度
  void refitViewer()
}

/** 侧栏收起/展开后，PDF 区宽度变化 → 重新适配 */
function toggleRight(): void {
  showRight.value = !showRight.value
  void refitViewer()
}

/** 等 DOM 稳定后让 PdfViewer 适配当前宽度 */
async function refitViewer(): Promise<void> {
  await nextTick()
  if (viewerRef.value) await viewerRef.value.fitWidth()
}

/** 框选完成：存入 store 供聊天发送时读取，并退出截图模式 */
function onSelection(sel: SelectionResult): void {
  readerStore.setSelection({
    kind: 'image',
    page: sel.page,
    rect: sel.rect,
    imageDataUrl: sel.imageDataUrl,
  })
  readerStore.cancelSelect()
  ElMessage.success(`已框选第 ${sel.page} 页区域，可发送给 AI`)
  // 测试/调试钩子：harness 通过 window.__readerSelection 读取断言
  ;(window as unknown as Record<string, unknown>).__readerSelection = sel
}

function onPageCount(count: number): void {
  pageCount.value = count
  readerStore.pageCount = count
  // 后端异步解析失败/未完成时（DB pageCount 仍 null），用阅读器实测 numPages 回填，
  // 让书架「解析中…」能落成真实页数（旧书打开一次即自愈）
  const book = readerStore.book
  if (book && !book.pageCount && count >= 1) {
    void updateBook(book.id, { pageCount: count })
      .then((updated) => {
        if (readerStore.book?.id === book.id) readerStore.book = updated
      })
      .catch((err) => console.warn('[reader] 回填总页数失败:', err instanceof Error ? err.message : err))
  }
}

/* ---- V2-F6：PDF 页内右键 → 若命中「文本选区」则弹自定义菜单 ---- */

function onPdfContextMenu(e: MouseEvent): void {
  // 框选截图模式下不弹文本菜单（交给框选交互处理）
  if (readerStore.selecting) return
  const hit = e.target as HTMLElement | null
  if (!hit || !hit.closest('.page-wrap')) return // 页面外不拦截（如边距空白）
  // 没有活跃的文本选区则不拦截：让系统默认行为（本 app 无默认菜单，等于无事发生）
  const selObj = window.getSelection()
  if (!selObj || selObj.isCollapsed) return
  e.preventDefault()
  const payload = readerStore.captureTextSelection()
  if (readerStore.crossPageSelection) {
    ElMessage.warning('请在同一页内选择文字（当前选区跨页）')
    return
  }
  if (!payload) return
  // 视口内钳制菜单位置（估算宽 240 / 高 190）
  const M_W = 240
  const M_H = 190
  const x = Math.max(8, Math.min(e.clientX, window.innerWidth - M_W - 8))
  const y = Math.max(8, Math.min(e.clientY, window.innerHeight - M_H - 8))
  selMenu.value = { x, y, payload }
  // 测试/调试钩子：harness 通过 window.__readerTextSelection 读取断言
  ;(window as unknown as Record<string, unknown>).__readerTextSelection = payload
}

async function onMenuAction(payload: TextSelectionPayload, action: TextAction): Promise<void> {
  selMenu.value = null
  // 选区已消费：若恰好残留的是本次文本选择，清掉（不影响聊天区待发的框选截图）
  if (readerStore.selection?.kind === 'text') readerStore.clearSelection()

  if (action === 'highlight') {
    // 高亮直接上页，无 AI（F5 语义：所见即所得）
    try {
      await readerStore.addHighlight({
        pageNumber: payload.page,
        rects: payload.rects,
        color: 'yellow',
        excerptText: payload.text,
      })
      ElMessage.success(`已在第 ${payload.page} 页高亮所选文字`)
    } catch (err) {
      ElMessage.error(err instanceof Error ? err.message : String(err))
    }
  } else if (action === 'note') {
    // V2-F7：笔记 = 记录原文 + 打开笔记面板写批注（本地，无 AI）
    showRight.value = true
    rightTab.value = 'notes'
    noteDraft.value = { page: payload.page, rects: payload.rects, text: payload.text }
    closeHlPopover()
  } else {
    // 翻译/解释复用聊天流式：右侧切到聊天并立即发送短指令 + 选中原文（原文由后端注入 AI prompt）
    if (chatStore.isStreaming) {
      ElMessage.warning('上一条回复仍在生成，请稍后再试')
      return
    }
    showRight.value = true
    rightTab.value = 'chat'
    const instruction = action === 'translate' ? '翻译选中内容' : '解释选中内容'
    await chatStore.send(instruction, {
      action,
      selection: { page: payload.page, rects: payload.rects },
      excerptText: payload.text,
    })
  }
  // 原文已被某动作消费（翻译/解释进聊天、笔记/高亮落库）→ 清掉待发送的文本选区
  if (readerStore.selection?.kind === 'text') readerStore.clearSelection()
  clearNativeSelection()
}

function clearNativeSelection(): void {
  window.getSelection()?.removeAllRanges()
}

/* ---- N6-F5：点击页面上已有高亮 → 弹小卡片 ---- */

function cancelPendingPop(): void {
  if (pendingPopTimer !== null) {
    clearTimeout(pendingPopTimer)
    pendingPopTimer = null
  }
}

function closeHlPopover(): void {
  cancelPendingPop()
  hlPopId.value = null
}

function onMainPointerDown(e: PointerEvent): void {
  // 任何新按下都取消待开的卡片：避免双击选词/拖选后误弹
  cancelPendingPop()
  const sel = window.getSelection()
  lastDown = {
    x: e.clientX,
    y: e.clientY,
    t: Date.now(),
    hadSel: !!(sel && !sel.isCollapsed && sel.rangeCount > 0),
  }
}

/** V2-F4：拖选结束（松开鼠标）时若有原生文本选区 → 捕获为待发送原文。
 *  这样用户不经过右键菜单也能在聊天输入区看到「原文 chip」，
 *  可键入问题把它作为上下文发给 AI（N9 的提及动作也依赖它）。 */
function onMainPointerUp(e: PointerEvent): void {
  if (readerStore.selecting) return // 截图框选由 SelectionOverlay 处理
  const hit = e.target as HTMLElement | null
  if (!hit?.closest?.('.page-wrap')) return // 只在页内文字上拖选结束才捕获
  const selObj = window.getSelection()
  if (!selObj || selObj.isCollapsed || selObj.rangeCount === 0) return
  readerStore.captureTextSelection()
}

function onMainClick(e: MouseEvent): void {
  if (readerStore.selecting) return // 截图框选模式不处理
  const d = lastDown
  // 必须是紧跟在 main 内 pointerdown 的点击（此前被 popover 遮罩吞掉的 click 不会带最近 down）
  if (!d || Date.now() - d.t > 500) return
  if (Math.abs(e.clientX - d.x) > 4 || Math.abs(e.clientY - d.y) > 4) return
  if (d.hadSel) return // 按下时仍有选区 → 意在取消选词，不弹卡片

  // V2-F7：点中笔记下划线 → 跳到笔记 Tab 并定位该条（优先于高亮小卡片）
  const noteHit = noteAtScreenPoint(e.clientX, e.clientY)
  if (noteHit) {
    lastDown = null
    cancelPendingPop()
    closeHlPopover()
    noteHover.value = null
    showRight.value = true
    rightTab.value = 'notes'
    noteFocusId.value = noteHit.id
    return
  }

  const hit = highlightAtScreenPoint(e.clientX, e.clientY)
  if (!hit) return // 空白/普通文字：交给默认行为
  lastDown = null
  const pos = clampPopoverPos(e.clientX, e.clientY)
  // 延迟 200ms 打开：若紧接着是双击选词（新一轮 pointerdown），先取消
  pendingPopTimer = setTimeout(() => {
    pendingPopTimer = null
    hlPopId.value = hit.id
    hlPopX.value = pos.x
    hlPopY.value = pos.y
  }, 200)
}

/** 节流后的 mousemove：命中笔记下划线 → 显示批注浮窗（按住拖选时不打扰） */
function onMainMove(e: MouseEvent): void {
  if (readerStore.selecting) return
  if (e.buttons !== 0) {
    if (noteHover.value) noteHover.value = null
    return
  }
  const now = Date.now()
  if (now - lastHoverAt < 30) return
  lastHoverAt = now
  const loc = locatePoint(e.clientX, e.clientY)
  if (!loc) {
    if (noteHover.value) noteHover.value = null
    return
  }
  const note = notesStore.notes.find(
    (n) => n.pageNumber === loc.page && noteRectHit(n, loc.nx, loc.ny),
  )
  if (note) noteHover.value = { x: e.clientX + 14, y: e.clientY + 12, noteId: note.id }
  else if (noteHover.value) noteHover.value = null
}

/** 读行盒；对 V1 遗留单 rect 防御兜底（与 HighlightLayer 同一约定） */
function rectsOf(h: Highlight): Rect[] {
  if (Array.isArray(h.rects)) return h.rects
  const legacy = (h as unknown as { rect?: Rect }).rect
  return legacy ? [legacy] : []
}

/** 屏幕坐标 → 命中所在页，并换算为该页归一化坐标（高亮/笔记命中共用） */
function locatePoint(
  cx: number,
  cy: number,
): { page: number; nx: number; ny: number } | null {
  const el = document.elementFromPoint(cx, cy) as HTMLElement | null
  const wrap = el?.closest?.('.page-wrap') as HTMLElement | null
  if (!wrap) return null
  const textEl = wrap.querySelector('[data-page-text]') as HTMLElement | null
  const page = Number(textEl?.dataset?.pageText ?? 0)
  if (!page) return null
  const wr = wrap.getBoundingClientRect()
  if (wr.width <= 0 || wr.height <= 0) return null
  const nx = Math.max(0, Math.min(1, (cx - wr.left) / wr.width))
  const ny = Math.max(0, Math.min(1, (cy - wr.top) / wr.height))
  return { page, nx, ny }
}

/** 归一化点是否落在某笔记任一行盒内 */
function noteRectHit(n: Note, nx: number, ny: number): boolean {
  const rects = Array.isArray(n.rects) && n.rects.length ? n.rects : []
  for (const r of rects) {
    if (nx >= r.x && nx <= r.x + r.width && ny >= r.y && ny <= r.y + r.height) return true
  }
  return false
}

/** 屏幕坐标 → 命中当前页某条笔记（含某一行盒）则返回之 */
function noteAtScreenPoint(cx: number, cy: number): Note | null {
  const loc = locatePoint(cx, cy)
  if (!loc) return null
  return notesStore.notes.find((n) => n.pageNumber === loc.page && noteRectHit(n, loc.nx, loc.ny)) ?? null
}

/** 屏幕坐标 → 命中当前页某条高亮（含某一行盒）则返回之 */
function highlightAtScreenPoint(cx: number, cy: number): Highlight | null {
  const loc = locatePoint(cx, cy)
  if (!loc) return null
  for (const h of readerStore.highlights) {
    if (h.pageNumber !== loc.page) continue
    for (const r of rectsOf(h)) {
      if (loc.nx >= r.x && loc.nx <= r.x + r.width && loc.ny >= r.y && loc.ny <= r.y + r.height) {
        return h
      }
    }
  }
  return null
}

/** 视口内钳制卡片位置（宽 280 / 估高 170；靠底则翻到上方） */
function clampPopoverPos(x: number, y: number): { x: number; y: number } {
  const POP_W = 280
  const POP_H = 170
  const nx = Math.max(8, Math.min(x, window.innerWidth - POP_W - 8))
  let ny = y + 12
  if (ny + POP_H > window.innerHeight - 8) ny = Math.max(8, y - POP_H - 8)
  return { x: nx, y: ny }
}

async function goTo(n: number): Promise<void> {
  closeHlPopover()
  page.value = Math.max(1, Math.min(n, pageCount.value || 1))
  await viewerRef.value?.goToPage(page.value)
}

/* ---- V2.2：阅读进度记忆 —— 退出记住 lastPage，重开自动定位上次阅读页 ---- */

const SAVE_DEBOUNCE_MS = 1200
let saveTimer: ReturnType<typeof setTimeout> | undefined

/** 把某书当前页写入后端（钳制到 [1, pageCount]）；失败仅告警不打断阅读 */
function savePosition(book: Book | null, n: number): void {
  if (!book || !src.value || loadError.value) return
  if (!pageCount.value) return // 文档页数未知前不落库（初始 page=1 不代表已定位到首屏）
  const target = Math.max(1, Math.min(Math.round(n) || 1, pageCount.value))
  void updateBook(book.id, { lastPage: target })
    .then((updated) => {
      if (readerStore.book?.id === book.id) readerStore.book = updated
    })
    .catch((err) => console.warn('[reader] 保存阅读进度失败:', err instanceof Error ? err.message : err))
}

/** 页码变化防抖落库（滚动翻页不每页都打 PATCH，停顿后才写） */
function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = undefined
    savePosition(readerStore.book, page.value)
  }, SAVE_DEBOUNCE_MS)
}

/** 退出阅读器/切书前立即落库（清掉未到期的防抖，避免延迟回写因卸载而丢失） */
function flushSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = undefined
  }
  if (readerStore.book) savePosition(readerStore.book, page.value)
}

/** PdfViewer 完成首屏布局（@loaded）→ 恢复到上次阅读页码；无进度则停在首页 */
function onPdfLoaded(): void {
  const last = readerStore.book?.lastPage
  if (last && last >= 1 && pageCount.value) {
    void goTo(Math.min(last, pageCount.value))
  }
}

async function loadBook(): Promise<void> {
  flushSave() // 离开当前书前先把此前的阅读页码落库（含路由直接切到另一本书）
  loading.value = true
  loadError.value = ''
  chatStore.reset()
  try {
    const book = await getBook(bookId.value)
    readerStore.setBook(book)
    src.value = bookFileUrl(book.id)
    // 重开同一本书：恢复该书的会话与历史消息
    await chatStore.loadSessions(book.id)
    // M11：恢复该书的高亮与笔记
    await readerStore.loadHighlights()
    await notesStore.load(book.id)
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

watch(bookId, loadBook)
watch(page, scheduleSave)
onMounted(loadBook)

onBeforeUnmount(() => {
  flushSave() // 阅读器关闭：立即落库当前页码（不依赖防抖延迟）
  window.removeEventListener('mousemove', onSplitMove)
  window.removeEventListener('mouseup', endSplitDrag)
  document.body.classList.remove('resizing-cols')
  cancelPendingPop()
})
</script>

<style scoped>
.reader {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.reader-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  height: 48px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
  flex-shrink: 0;
}
.reader-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.header-error {
  color: var(--el-color-danger);
  font-size: 13px;
}
.header-theme {
  flex-shrink: 0;
  margin-left: 8px;
}

.reader-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
  flex-shrink: 0;
}

.page-jump {
  display: flex;
  align-items: center;
  gap: 8px;
}
.page-total {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.zoom-group {
  margin-left: auto;
}

.reader-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.reader-main {
  flex: 1;
  min-height: 0;
  position: relative;
  min-width: 0;
}

.reader-splitter {
  width: 6px;
  flex-shrink: 0;
  cursor: col-resize;
  background: var(--el-border-color-lighter);
  transition: background-color 0.15s;
}
.reader-splitter:hover {
  background: var(--el-color-primary-light-5);
}
.reader-splitter.dragging {
  background: var(--el-color-primary);
}

.reader-chat {
  width: 380px; /* store 默认值；实际宽度由 inline style 覆盖 */
  flex-shrink: 0;
  border-left: 1px solid var(--el-border-color-light);
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.right-tabs {
  display: flex;
  flex-shrink: 0;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
}

.right-tab {
  flex: 1;
  padding: 9px 0;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  position: relative;
  transition: color 0.15s;
}

.right-tab.active {
  color: var(--el-color-primary);
  font-weight: 600;
}

.right-tab.active::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  width: 32px;
  height: 2px;
  border-radius: 1px;
  background: var(--el-color-primary);
}

.right-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.right-body > * {
  flex: 1;
  min-height: 0;
}

:global(body.resizing-cols) {
  cursor: col-resize;
  user-select: none;
}
</style>
