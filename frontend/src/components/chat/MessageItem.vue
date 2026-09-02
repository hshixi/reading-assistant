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
import type { LocalMessage } from '@/stores/chat'

const props = defineProps<{ msg: LocalMessage }>()

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
