<template>
  <div
    class="note-item"
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
    <div class="note-content">
      {{ note.content }}
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
  transition: border-color 0.15s;
}
.note-item:hover {
  border-color: var(--el-color-primary);
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
.note-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-primary);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
