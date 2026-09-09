<template>
  <div class="shelf">
    <header class="shelf-header">
      <h1>Reading Assistant</h1>
      <div class="actions">
        <el-button
          type="primary"
          :loading="uploading"
          @click="pickFile"
        >
          {{ uploading ? '上传中…' : '导入 PDF' }}
        </el-button>
        <el-button
          data-test="settings-btn"
          @click="$router.push('/settings')"
        >
          <el-icon><Setting /></el-icon>
          <span>设置</span>
        </el-button>
        <ThemeToggle />
      </div>
      <input
        ref="fileInput"
        type="file"
        accept=".pdf,application/pdf"
        class="hidden-input"
        @change="onFileChange"
      >
    </header>

    <el-alert
      v-if="store.error"
      :title="store.error"
      type="error"
      show-icon
      class="shelf-alert"
    />

    <main
      v-loading="store.loading"
      class="book-grid"
    >
      <el-empty
        v-if="!store.loading && store.books.length === 0"
        description="还没有书籍，点击右上角导入 PDF"
      />
      <el-card
        v-for="book in store.books"
        :key="book.id"
        class="book-card"
        shadow="hover"
        @click="openReader(book.id)"
      >
        <template #header>
          <div
            class="book-title"
            :title="book.title"
          >
            {{ book.title }}
          </div>
        </template>
        <!-- V2.1-F：卡片内嵌 PDF 首页封面预览，标题 + 封面一眼认出是哪个文件 -->
        <!-- V2.5：progress 传阅读进度百分比（pageCount 未知为 null → 不渲染底部条） -->
        <BookCover
          :book-id="book.id"
          :title="book.title"
          :progress="progressOf(book)"
        />
        <!-- V2.5：meta 精简两行 —— 行1 文件名 + 右对齐笔记数；行2 页数 · 阅读进度 -->
        <div class="book-meta">
          <div class="meta-line">
            <el-icon class="meta-icon">
              <Document />
            </el-icon>
            <span
              class="meta-file"
              :title="`${book.fileName} · ${formatSize(book.fileSize)}`"
            >{{ book.fileName }}</span>
            <span class="meta-notes">
              <el-icon><Notebook /></el-icon>
              <span>{{ book.noteCount ?? 0 }}</span>
            </span>
          </div>
          <div class="meta-line muted">
            <el-icon class="meta-icon">
              <Files />
            </el-icon>
            <span v-if="book.pageCount != null">{{ book.pageCount }} 页 · 阅读 {{ progressText(book) }}%</span>
            <span v-else>解析中…</span>
          </div>
        </div>
        <div
          class="book-actions"
          @click.stop
        >
          <el-button
            size="small"
            type="primary"
            plain
            @click="openReader(book.id)"
          >
            打开
          </el-button>
          <el-button
            size="small"
            type="danger"
            plain
            @click="onDelete(book)"
          >
            删除
          </el-button>
        </div>
      </el-card>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Files, Notebook, Setting } from '@element-plus/icons-vue'
import type { Book } from '@reading/shared'
import { useBookStore } from '@/stores/book'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import BookCover from '@/components/common/BookCover.vue'

const router = useRouter()
const store = useBookStore()
const fileInput = ref<HTMLInputElement>()
const uploading = ref(false)

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * V2.5：阅读进度百分比（0–100）。
 * pageCount 未知（解析中/失败）→ null（调用方不渲染条、显示「解析中…」）；
 * 已知但从未读过（lastPage null/0）→ 0（未开始，条空、显示 0.00%）。
 */
function progressOf(book: Book): number | null {
  const total = book.pageCount
  if (total == null || total <= 0) return null
  if (book.lastPage == null || book.lastPage <= 0) return 0
  // lastPage 偶发大于 pageCount（回填前后不一致）时封顶，避免进度溢出
  return Math.min(100, (book.lastPage / total) * 100)
}

function progressText(book: Book): string {
  return (progressOf(book) ?? 0).toFixed(2)
}

function pickFile(): void {
  fileInput.value?.click()
}

async function onFileChange(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = '' // 允许重复选择同一文件
  uploading.value = true
  try {
    const book = await store.upload(file)
    ElMessage.success(`已导入《${book.title}》`)
    // 后台等待后端异步页数解析完成并刷新卡片（解析中… → N 页）
    void store.ensurePageCount(book.id)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    uploading.value = false
  }
}

function openReader(id: number): void {
  router.push(`/reader/${id}`)
}

async function onDelete(book: Book): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除《${book.title}》？将同时删除其聊天记录、笔记与高亮。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return // 用户取消
  }
  try {
    await store.remove(book.id)
    ElMessage.success('已删除')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  }
}

onMounted(() => store.fetchBooks())
</script>

<style scoped>
.shelf {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px 24px;
  box-sizing: border-box;
  overflow: hidden;
}

.shelf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.shelf-header h1 {
  font-size: 22px;
  margin: 0;
  color: var(--el-text-color-primary);
}

.hidden-input {
  display: none;
}

.shelf-alert {
  margin-bottom: 12px;
}

.book-grid {
  flex: 1;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  align-content: start;
  padding-bottom: 16px;
}

.book-card {
  cursor: pointer;
}
.book-card :deep(.el-card__header) {
  padding: 12px 16px;
}
.book-title {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--el-text-color-regular);
  font-size: 13px;
}
.meta-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.meta-line.muted {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.meta-icon {
  flex: none;
}
.meta-file {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta-notes {
  margin-left: auto;
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.book-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}
</style>
