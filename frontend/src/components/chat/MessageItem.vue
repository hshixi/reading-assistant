<template>
  <!-- eslint-disable vue/no-v-html -- 仅一处在 v-html="rendered"，rendered 经 DOMPurify.sanitize（marked 输出） -->
  <div
    class="message"
    :class="msg.role"
  >
    <div class="bubble">
      <div
        v-if="msg.imageDataUrl"
        class="msg-img-wrap"
      >
        <img
          :src="msg.imageDataUrl"
          class="msg-img"
          alt="截图"
        >
      </div>
      <div
        v-if="msg.content"
        class="msg-text markdown-body"
        v-html="rendered"
      />
      <!-- V2.1-P2：用户消息若带选中原文，展示引用块（历史回看知道问的是哪段原文） -->
      <div
        v-if="msg.role === 'user' && msg.meta?.excerptText"
        class="msg-excerpt"
        :title="msg.meta.excerptText"
      >
        <div class="msg-excerpt-head">
          <span
            v-if="msg.meta.action"
            class="msg-excerpt-tag"
          >{{ actionLabel(msg.meta.action) }}</span>
          <span class="msg-excerpt-title">选中原文</span>
          <span
            v-if="msg.meta.page"
            class="msg-excerpt-page"
          >第 {{ msg.meta.page }} 页</span>
        </div>
        <div class="msg-excerpt-body">
          {{ msg.meta.excerptText }}
        </div>
      </div>
      <div
        v-if="msg.streaming && !msg.content"
        class="thinking"
      >
        思考中<span class="cursor">…</span>
      </div>
      <div
        v-else-if="msg.streaming && msg.content"
        class="streaming-cursor"
      />
      <div
        v-if="msg.error"
        class="msg-error"
      >
        ⚠️ {{ msg.error }}
      </div>
      <div
        v-if="msg.meta?.interrupted"
        class="msg-error"
      >
        （已中断）
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { ActionType } from '@reading/shared'
import type { LocalMessage } from '@/stores/chat'

const props = defineProps<{ msg: LocalMessage }>()

/** V2.1-P2：meta.action 枚举 → 人类可读小标签（引用块头部展示动作来源） */
const ACTION_LABELS: Record<ActionType, string> = {
  translate: '翻译',
  explain: '解释',
  note: '笔记',
  highlight: '高亮',
}

function actionLabel(a: ActionType): string {
  return ACTION_LABELS[a] ?? a
}

const rendered = computed(() => {
  const md = props.msg.content || ''
  try {
    return DOMPurify.sanitize(marked.parse(md) as string)
  } catch {
    return md
  }
})
</script>

<style scoped>
.message {
  display: flex;
  margin-bottom: 12px;
}
.message.user {
  justify-content: flex-end;
}
.message.assistant {
  justify-content: flex-start;
}
.bubble {
  max-width: 88%;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}
.message.user .bubble {
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-top-right-radius: 2px;
}
.message.assistant .bubble {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-top-left-radius: 2px;
}
.msg-img-wrap {
  margin-bottom: 6px;
}
.msg-img {
  max-width: 100%;
  max-height: 220px;
  border-radius: 6px;
  border: 1px solid var(--el-border-color-lighter);
  display: block;
}
.msg-text :deep(p) {
  margin: 0 0 8px;
}
.msg-text :deep(p:last-child) {
  margin-bottom: 0;
}
.msg-text :deep(pre) {
  background: var(--el-fill-color-lighter);
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 13px;
}
.msg-text :deep(code) {
  background: rgba(127, 127, 127, 0.12);
  padding: 1px 4px;
  border-radius: 3px;
}
.msg-text :deep(pre code) {
  background: none;
  padding: 0;
}
/* V2.1-P2：用户消息「选中原文」引用块 —— 历史回看能定位问的是哪段内容 */
.msg-excerpt {
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--el-fill-color);
  border: 1px solid var(--el-border-color-lighter);
  border-left: 3px solid var(--el-color-primary);
}
.msg-excerpt-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--el-text-color-secondary);
}
.msg-excerpt-tag {
  flex-shrink: 0;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 999px;
  padding: 0 7px;
  font-size: 11px;
}
.msg-excerpt-title {
  font-weight: 600;
}
.msg-excerpt-page {
  margin-left: auto;
  flex-shrink: 0;
}
.msg-excerpt-body {
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.thinking {
  color: var(--el-text-color-secondary);
}
.cursor {
  animation: blink 1s steps(1) infinite;
}
.streaming-cursor {
  display: inline-block;
  width: 8px;
  height: 14px;
  margin-left: 2px;
  vertical-align: -2px;
  background: var(--el-color-primary);
  animation: blink 1s steps(1) infinite;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}
.msg-error {
  margin-top: 6px;
  color: var(--el-color-danger);
  font-size: 13px;
}
</style>
