<template>
  <div class="session-list">
    <div
      v-for="s in store.sessions"
      :key="s.id"
      class="session-item"
      :class="{ active: s.id === store.activeSessionId }"
      @click="store.openSession(s.id)"
    >
      <div class="session-title">{{ s.title || '新对话' }}</div>
      <div class="session-meta">{{ s.messageCount ?? 0 }} 条消息</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useChatStore } from '@/stores/chat'

const store = useChatStore()
</script>

<style scoped>
.session-list {
  padding: 4px;
  min-width: 180px;
}
.session-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.session-item:hover {
  background: var(--el-fill-color-light);
}
.session-item.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.session-title {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.session-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
</style>
