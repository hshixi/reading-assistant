<template>
  <div class="notes-panel">
    <div
      v-if="notesStore.notes.length === 0"
      class="notes-empty"
    >
      <el-empty description="暂无笔记。框选内容点「摘抄」，AI 会自动保存到这里" />
    </div>
    <div
      v-else
      class="notes-list"
    >
      <NoteItem
        v-for="n in notesStore.notes"
        :key="n.id"
        :note="n"
        @delete="remove"
        @jump="jump"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useNotesStore } from '@/stores/notes'
import NoteItem from './NoteItem.vue'

const emit = defineEmits<{ jump: [page: number] }>()

const notesStore = useNotesStore()

async function remove(id: number): Promise<void> {
  await notesStore.remove(id)
}

function jump(page: number): void {
  emit('jump', page)
}
</script>

<style scoped>
.notes-panel {
  height: 100%;
  overflow-y: auto;
  background: var(--el-fill-color-lighter, #f5f6f7);
}
.notes-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.notes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
}
</style>
