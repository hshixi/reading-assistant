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
            @click="viewerRef?.zoom(-0.1)"
          >
            -
          </el-button>
          <el-button
            size="small"
            @click="viewerRef?.fitWidth()"
          >
            适配宽度
          </el-button>
          <el-button
            size="small"
            @click="viewerRef?.zoom(0.1)"
          >
            +
          </el-button>
        </el-button-group>
      </div>
    </div>

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
      />
      <el-empty
        v-else
        description="无法加载书籍"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import PdfViewer from '@/components/reader/PdfViewer.vue'
import { getBook } from '@/api/books'
import { bookFileUrl } from '@/api/client'
import { useReaderStore } from '@/stores/reader'

const route = useRoute()
const readerStore = useReaderStore()

const bookId = computed(() => Number(route.params.bookId))
const viewerRef = ref<InstanceType<typeof PdfViewer> | null>(null)

const page = ref(1)
const pageCount = ref(0)
const src = ref('')
const loading = ref(false)
const loadError = ref('')

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
  try {
    const book = await getBook(bookId.value)
    readerStore.setBook(book)
    src.value = bookFileUrl(book.id)
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

watch(bookId, loadBook)
onMounted(loadBook)
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
}
.header-error {
  color: var(--el-color-danger);
  font-size: 13px;
  margin-left: auto;
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

.reader-main {
  flex: 1;
  min-height: 0;
}
</style>
