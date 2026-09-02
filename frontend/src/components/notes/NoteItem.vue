<template>
  <div
    class="note-item"
    :data-note-id="note.id"
    @click="onJump"
  >
    <div class="note-head">
      <span
        v-if="note.pageNumber"
        class="note-page"
      >第 {{ note.pageNumber }} 页</span>
      <span
        v-else
        class="note-page muted"
      >未定位</span>
      <span class="note-time">{{ timeText }}</span>
      <el-button
        link
        type="danger"
        size="small"
        class="note-delete"
        @click.stop="onDelete"
      >
        删除
      </el-button>
    </div>
    <!-- V2-F7：原文摘录（引文样式）置顶 -->
    <div
      v-if="excerpt"
      class="note-excerpt"
      :title="excerpt"
    >
      {{ excerpt }}
    </div>
    <div
      class="note-content"
      :class="{ empty: !content }"
    >
      {{ content || '（无批注）' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import type { Note } from '@reading/shared'

const props = defineProps<{ note: Note }>()
const emit = defineEmits<{ delete: [id: number]; jump: [page: number] }>()

const timeText = computed(() => {
  const d = new Date(props.note.createdAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
})

/** 归一化显示原文：折叠空白便于展示 */
const excerpt = computed(() => (props.note.excerptText ?? '').trim())

/** 批注正文 */
const content = computed(() => (props.note.content ?? '').trim())

function onJump(): void {
  if (props.note.pageNumber != null) emit('jump', props.note.pageNumber)
}

async function onDelete(): Promise<void> {
  try {
    await ElMessageBox.confirm('删除这条笔记？', '确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  emit('delete', props.note.id)
}
</script>

<style scoped>
.note-item {
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, background-color 0.2s;
}
.note-item:hover {
  border-color: var(--el-color-primary);
}
/* V2-F7：定位到该条时 1.5s 淡入淡出的闪烁（ReaderView/NotesPanel 触发后加类再移除） */
.note-item.flash {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--el-color-primary) 30%, transparent);
  background: var(--el-color-primary-light-9);
  animation: note-flash 1.5s ease-out 1;
}
@keyframes note-flash {
  0% { background: var(--el-color-primary-light-5); }
  100% { background: var(--el-color-primary-light-9); }
}

.note-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.note-page {
  font-size: 12px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  padding: 1px 8px;
  border-radius: 999px;
}
.note-page.muted {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
}
.note-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.note-delete {
  margin-left: auto;
}
/* V2-F7：原文摘录引文样式（灰底 + 左竖线），同笔记的批注分开展示 */
.note-excerpt {
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-left: 3px solid var(--el-color-warning);
  padding: 6px 8px;
  border-radius: 4px;
  margin-bottom: 6px;
  white-space: pre-wrap;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.note-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-primary);
  white-space: pre-wrap;
  word-break: break-word;
}
.note-content.empty {
  color: var(--el-text-color-placeholder);
}
</style>
