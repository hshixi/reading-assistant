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
        :type="selActive ? 'primary' : 'default'"
        @click="selActive = !selActive"
      >
        {{ selActive ? '取消框选' : '框选' }}
      </el-button>

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
      >
        <PdfViewer
          v-if="src && !loadError"
          ref="viewerRef"
          :src="src"
          @page-count="onPageCount"
          @page-number="page = $event"
        >
          <!-- M11：每页包裹层内渲染高亮覆盖层（slot 按页码传入，百分比定位随缩放自适应） -->
          <template #page="{ num }">
            <HighlightLayer :page="num" />
          </template>
        </PdfViewer>
        <el-empty
          v-else
          description="无法加载书籍"
        />
        <SelectionOverlay
          v-if="src && !loadError"
          :active="selActive"
          @selection="onSelection"
          @cancel="selActive = false"
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
        </div>
        <div class="right-body">
          <ChatPanel v-show="rightTab === 'chat'" />
          <NotesPanel
            v-show="rightTab === 'notes'"
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
import ChatPanel from '@/components/chat/ChatPanel.vue'
import NotesPanel from '@/components/notes/NotesPanel.vue'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import { getBook } from '@/api/books'
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
const selActive = ref(false)
const showRight = ref(true)
const rightTab = ref<'chat' | 'notes'>('chat')

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
  readerStore.setSelection(sel)
  selActive.value = false
  ElMessage.success(`已框选第 ${sel.page} 页区域，可发送给 AI`)
  // 测试/调试钩子：harness 通过 window.__readerSelection 读取断言
  ;(window as unknown as Record<string, unknown>).__readerSelection = sel
}

function onPageCount(count: number): void {
  pageCount.value = count
  readerStore.pageCount = count
}

async function goTo(n: number): Promise<void> {
  page.value = Math.max(1, Math.min(n, pageCount.value || 1))
  await viewerRef.value?.goToPage(page.value)
}

async function loadBook(): Promise<void> {
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
onMounted(loadBook)

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onSplitMove)
  window.removeEventListener('mouseup', endSplitDrag)
  document.body.classList.remove('resizing-cols')
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
