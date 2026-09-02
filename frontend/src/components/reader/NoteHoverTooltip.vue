<template>
  <Teleport to="body">
    <div
      v-if="note"
      class="note-tt"
      :style="{ left: `${x}px`, top: `${y}px` }"
    >
      <div class="note-tt-page">
        第 {{ note.pageNumber }} 页笔记
      </div>
      <div class="note-tt-body">
        {{ body }}
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Note } from '@reading/shared'
import { useNotesStore } from '@/stores/notes'

const props = defineProps<{
  /** 是否展示 */
  visible: boolean
  x: number
  y: number
  /** 悬停命中的笔记 id */
  noteId: number | null
}>()

const notesStore = useNotesStore()

const note = computed<Note | null>(() => {
  if (!props.visible || props.noteId === null) return null
  return notesStore.notes.find((n) => n.id === props.noteId) ?? null
})

/** 悬浮窗正文：批注优先，无批注显示原文摘录 */
const body = computed(() => {
  const content = note.value?.content?.trim()
  const excerpt = note.value?.excerptText?.trim()
  if (content) return content
  if (excerpt) return excerpt
  return '（无内容）'
})
</script>

<style scoped>
.note-tt {
  position: fixed;
  z-index: 4000;
  max-width: 320px;
  max-height: 200px;
  overflow-y: auto;
  padding: 8px 10px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
  pointer-events: none;
  white-space: pre-wrap;
  word-break: break-word;
}
.note-tt-page {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}
.note-tt-body {
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-primary);
}
</style>
