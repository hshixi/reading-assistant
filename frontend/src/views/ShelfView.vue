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
        <div class="book-meta">
          <div class="meta-row">
            <el-icon><Document /></el-icon>
            <span>{{ book.fileName }}</span>
          </div>
          <div class="meta-row">
            <el-icon><Files /></el-icon>
            <span>{{ book.pageCount ?? '解析中…' }} 页</span>
          </div>
          <div class="meta-row">
            <el-icon><Cpu /></el-icon>
            <span>{{ formatSize(book.fileSize) }}</span>
          </div>
          <div class="meta-row muted">
            {{ formatDate(book.createdAt) }}
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
import { Document, Files, Cpu } from '@element-plus/icons-vue'
import type { Book } from '@reading/shared'
import { useBookStore } from '@/stores/book'

const router = useRouter()
const store = useBookStore()
const fileInput = ref<HTMLInputElement>()
const uploading = ref(false)

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
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
.meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.meta-row.muted {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.book-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}
</style>
