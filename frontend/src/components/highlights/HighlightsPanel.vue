<template>
  <div class="highlights-panel">
    <div
      v-if="highlights.length === 0"
      class="highlights-empty"
    >
      <el-empty description="暂无高亮。拖动选中文字后右键「高亮」，即可标在原文上" />
    </div>
    <div
      v-else
      class="highlights-list"
    >
      <div
        v-for="h in sortedHighlights"
        :key="h.id"
        class="hl-card"
      >
        <div
          class="hl-main"
          @click="jump(h.pageNumber)"
        >
          <div class="hl-head">
            <span class="hl-page">第 {{ h.pageNumber }} 页</span>
            <span
              class="hl-color-dot"
              :style="{ background: h.color || 'yellow' }"
            />
            <span class="hl-time">{{ timeText(h.createdAt) }}</span>
          </div>
          <div class="hl-excerpt">
            {{ h.excerptText || `第 ${h.pageNumber} 页区域（无原文摘录）` }}
          </div>
        </div>
        <el-popconfirm
          title="删除这条高亮？"
          confirm-button-text="删除"
          cancel-button-text="取消"
          width="180"
          @confirm="remove(h.id)"
        >
          <template #reference>
            <el-button
              link
              type="danger"
              size="small"
              class="hl-delete"
            >
              删除
            </el-button>
          </template>
        </el-popconfirm>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useReaderStore } from '@/stores/reader'

const emit = defineEmits<{ jump: [page: number] }>()

const readerStore = useReaderStore()

const highlights = computed(() => readerStore.highlights)

/** 按创建时间倒序（最新在前） */
const sortedHighlights = computed(() =>
  [...highlights.value].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
)

function timeText(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function jump(page: number): void {
  emit('jump', page)
}

async function remove(id: number): Promise<void> {
  try {
    await readerStore.removeHighlight(id)
    ElMessage.success('已删除高亮')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  }
}
</script>

<style scoped>
.highlights-panel {
  height: 100%;
  overflow-y: auto;
  background: var(--el-fill-color-lighter, #f5f6f7);
}
.highlights-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.highlights-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
}
.hl-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
  overflow: hidden;
}
.hl-main {
  padding: 10px 12px;
  cursor: pointer;
}
.hl-main:hover {
  background: var(--el-fill-color-light);
}
.hl-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.hl-page {
  font-size: 12px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  padding: 1px 8px;
  border-radius: 999px;
}
.hl-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  display: inline-block;
}
.hl-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.hl-excerpt {
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-primary);
  white-space: pre-wrap;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.hl-delete {
  margin: 0 8px 8px auto;
  display: block;
  width: fit-content;
}
</style>
