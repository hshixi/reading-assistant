<template>
  <div
    ref="scrollRef"
    class="message-list"
    @scroll="onScroll"
  >
    <div
      v-if="store.loadingHistory"
      class="list-hint"
    >
      加载中…
    </div>
    <el-button
      v-else-if="store.hasMore"
      link
      size="small"
      class="load-more"
      @click="loadMore"
    >
      加载更早的消息
    </el-button>

    <div
      v-if="store.messages.length === 0"
      class="empty-hint"
    >
      暂无消息。选中原文右键「翻译 / 解释 / 笔记 / 高亮」，或直接输入提问。
    </div>

    <MessageItem
      v-for="m in store.messages"
      :key="m.id"
      :msg="m"
    />
    <div ref="bottomRef" />
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import MessageItem from './MessageItem.vue'

const store = useChatStore()
const scrollRef = ref<HTMLDivElement>()
const bottomRef = ref<HTMLDivElement>()
let stickToBottom = true

function scrollToBottom(): void {
  void nextTick(() => {
    const el = scrollRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function onScroll(): void {
  const el = scrollRef.value
  if (!el) return
  const dist = el.scrollHeight - el.scrollTop - el.clientHeight
  stickToBottom = dist < 40
  // 顶部触发加载更多
  if (el.scrollTop < 30) void loadMore()
}

async function loadMore(): Promise<void> {
  const el = scrollRef.value
  const prevH = el ? el.scrollHeight : 0
  await store.loadMore()
  await nextTick()
  // 保持阅读位置（增量在顶部）
  if (el) el.scrollTop = el.scrollHeight - prevH
}

watch(
  // 消息数变化，或最后一条消息内容随流式 delta 增长时，都贴底滚动
  () => store.messages[store.messages.length - 1]?.content ?? store.messages.length,
  () => {
    if (stickToBottom) scrollToBottom()
  },
)

onMounted(scrollToBottom)
</script>

<style scoped>
.message-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 14px 8px;
  scrollbar-width: thin;
}
.load-more {
  display: block;
  margin: 0 auto 10px;
}
.list-hint,
.empty-hint {
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  padding: 20px 4px;
}
</style>
