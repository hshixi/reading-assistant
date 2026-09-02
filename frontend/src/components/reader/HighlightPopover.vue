<template>
  <Teleport to="body">
    <div
      v-if="highlight"
      class="hl-pop-overlay"
      @mousedown="onBackdropDown"
      @mousewheel.prevent="emit('close')"
    >
      <!-- N6-F5：点击页面上的高亮 → 小卡片：显示原文 / 删除高亮 -->
      <div
        class="hl-pop"
        :style="{ left: `${x}px`, top: `${y}px` }"
        @mousedown.stop
      >
        <div class="hl-pop-head">
          <span
            class="hl-pop-dot"
            :style="{ background: highlight.color || 'yellow' }"
          />
          <span class="hl-pop-page">第 {{ highlight.pageNumber }} 页高亮</span>
          <span class="hl-pop-time">{{ timeText(highlight.createdAt) }}</span>
        </div>
        <div
          class="hl-pop-text"
          :class="{ expanded }"
          :title="highlight.excerptText || ''"
        >
          {{ highlight.excerptText || '（无原文摘录）' }}
        </div>
        <div class="hl-pop-actions">
          <button
            class="hl-pop-btn text"
            @click="expanded = !expanded"
          >
            <span v-if="highlight.excerptText">{{ expanded ? '收起原文' : '显示原文' }}</span>
            <span v-else>无原文</span>
          </button>

          <el-popconfirm
            title="删除这条高亮？"
            confirm-button-text="删除"
            cancel-button-text="取消"
            width="180"
            @confirm="onDelete"
          >
            <template #reference>
              <button class="hl-pop-btn danger">
                删除高亮
              </button>
            </template>
          </el-popconfirm>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { Highlight } from '@reading/shared'
import { useReaderStore } from '@/stores/reader'

const props = defineProps<{
  /** 是否展示 */
  visible: boolean
  /** 页面点击位置（已由调用方钳制） */
  x: number
  y: number
  /** 命中高亮 id */
  highlightId: number | null
}>()

const emit = defineEmits<{ close: [] }>()

const readerStore = useReaderStore()

/** 从 store 按 id 取最新数据：被删除/换书后自动消失 */
const highlight = computed<Highlight | null>(() => {
  if (!props.visible || props.highlightId === null) return null
  return readerStore.highlights.find((h) => h.id === props.highlightId) ?? null
})

const expanded = ref(false)

watch(() => props.highlightId, () => {
  expanded.value = false
})

function timeText(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function onBackdropDown(e: MouseEvent): void {
  // 点在高亮卡上由 mousedown.stop 拦住；其余位置视为关闭
  void e
  emit('close')
}

async function onDelete(): Promise<void> {
  const id = props.highlightId
  emit('close')
  if (id === null) return
  try {
    await readerStore.removeHighlight(id)
    ElMessage.success('已删除高亮')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  }
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.hl-pop-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
}

.hl-pop {
  position: fixed;
  width: 280px;
  max-width: calc(100vw - 16px);
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  padding: 10px 12px;
}

.hl-pop-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.hl-pop-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}
.hl-pop-page {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.hl-pop-time {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-left: auto;
}

.hl-pop-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 120px;
  overflow-y: auto;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
}
.hl-pop-text.expanded {
  display: block;
  max-height: 220px;
}

.hl-pop-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.hl-pop-btn {
  border: none;
  background: transparent;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}
.hl-pop-btn:hover {
  background: var(--el-fill-color-light);
}
.hl-pop-btn.text {
  color: var(--el-color-primary);
}
.hl-pop-btn.text:hover {
  background: var(--el-color-primary-light-9);
}
.hl-pop-btn.danger {
  color: var(--el-color-danger);
}
.hl-pop-btn.danger:hover {
  background: var(--el-color-danger-light-9);
}
</style>
