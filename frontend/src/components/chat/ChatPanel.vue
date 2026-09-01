<template>
  <div class="chat-panel">
    <div class="chat-header">
      <el-dropdown
        trigger="click"
        @command="onSessionCommand"
      >
        <div class="session-current">
          <span class="session-current-title">{{ currentTitle }}</span>
          <el-icon><ArrowDown /></el-icon>
        </div>
        <template #dropdown>
          <SessionList />
        </template>
      </el-dropdown>
      <el-button
        link
        size="small"
        @click="newSession"
      >
        <el-icon><Plus /></el-icon>
        <span>新对话</span>
      </el-button>
    </div>

    <MessageList />

    <ChatInput />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ArrowDown, Plus } from '@element-plus/icons-vue'
import { useChatStore } from '@/stores/chat'
import SessionList from './SessionList.vue'
import MessageList from './MessageList.vue'
import ChatInput from './ChatInput.vue'

const store = useChatStore()

const currentTitle = computed(() => {
  const s = store.sessions.find((x) => x.id === store.activeSessionId)
  return s?.title || '新对话'
})

function onSessionCommand(id: unknown): void {
  if (typeof id === 'number') void store.openSession(id)
}

async function newSession(): Promise<void> {
  await store.newSession()
}
</script>

<style scoped>
.chat-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--el-border-color-light);
  flex-shrink: 0;
}
.session-current {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 600;
  max-width: 240px;
}
.session-current-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
