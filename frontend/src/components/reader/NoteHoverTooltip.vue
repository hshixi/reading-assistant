<template>
  <!-- eslint-disable vue/no-v-html -- 仅一处在 v-html="renderedNote"，由 @/utils/markdown 生成（marked → KaTeX → DOMPurify） -->
  <Teleport to="body">
    <div
      v-if="note"
      class="note-tt"
      :style="{ left: `${x}px`, top: `${y}px` }"
    >
      <div class="note-tt-page">
        第 {{ note.pageNumber }} 页笔记
      </div>
      <div
        v-if="hasContent"
        class="note-tt-body markdown-body"
        v-html="renderedNote"
      />
      <div
        v-else
        class="note-tt-body"
      >
        {{ body }}
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Note } from '@reading/shared'
import { useNotesStore } from '@/stores/notes'
import { renderMarkdown } from '@/utils/markdown'

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

/** 有批注时按 markdown 渲染（与笔记面板一致）；无批注回退显示原文摘录（纯文本） */
const content = computed(() => note.value?.content?.trim() ?? '')
const hasContent = computed(() => content.value.length > 0)
const renderedNote = computed(() => renderMarkdown(content.value))

/** 悬浮窗正文：批注优先，无批注显示原文摘录 */
const body = computed(() => {
  if (content.value) return content.value
  const excerpt = note.value?.excerptText?.trim()
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
/* 外层 pre-wrap 是给摘录纯文本用的；markdown 渲染结果不能继承，否则标签间换行会变成空行 */
.note-tt-body.markdown-body {
  white-space: normal;
}
</style>
