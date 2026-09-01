<template>
  <div class="chat-input">
    <!-- 框选预览：有选区时可选择附带截图发送 -->
    <div
      v-if="selection"
      class="selection-preview"
    >
      <img
        :src="selection.imageDataUrl"
        class="selection-thumb"
        alt="框选截图"
      >
      <div class="selection-info">
        <span>第 {{ selection.page }} 页区域</span>
        <el-checkbox
          v-model="attachImage"
          size="small"
        >
          附带截图
        </el-checkbox>
      </div>
      <el-button
        link
        size="small"
        @click="clearSelection"
      >
        清除
      </el-button>
    </div>

    <!-- 快捷动作 -->
    <div class="quick-actions">
      <el-button
        size="small"
        @click="sendAction('translate')"
      >
        翻译
      </el-button>
      <el-button
        size="small"
        @click="sendAction('explain')"
      >
        解释
      </el-button>
      <el-button
        size="small"
        @click="sendAction('note')"
      >
        摘抄
      </el-button>
      <el-button
        size="small"
        @click="sendAction('highlight')"
      >
        高亮
      </el-button>
    </div>

    <div class="input-row">
      <el-input
        v-model="text"
        type="textarea"
        :autosize="{ minRows: 1, maxRows: 5 }"
        placeholder="输入问题，Enter 发送，Shift+Enter 换行"
        resize="none"
        @keydown.enter.exact.prevent="onSend"
      />
      <el-button
        v-if="store.isStreaming"
        class="send-btn"
        type="danger"
        @click="store.stop()"
      >
        停止
      </el-button>
      <el-button
        v-else
        class="send-btn"
        type="primary"
        :disabled="!canSend"
        @click="onSend"
      >
        发送
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { ActionType, Selection } from '@reading/shared'
import { useChatStore } from '@/stores/chat'
import { toRect, useReaderStore } from '@/stores/reader'

const store = useChatStore()
const readerStore = useReaderStore()

const text = ref('')
const attachImage = ref(true)

const selection = computed(() => readerStore.selection)

/** 动作是否需要选区（摘抄/高亮必须框选） */
const REQUIRES_SELECTION: Partial<Record<ActionType, boolean>> = {
  note: true,
  highlight: true,
}

const canSend = computed(() => text.value.trim().length > 0 || !!selection.value)

function toSharedSelection(): Selection | undefined {
  const s = selection.value
  if (!s) return undefined
  return {
    page: s.page,
    rect: {
      x: s.rectNorm.x,
      y: s.rectNorm.y,
      width: s.rectNorm.w,
      height: s.rectNorm.h,
    },
  }
}

function clearSelection(): void {
  readerStore.clearSelection()
}

async function sendAction(action: ActionType): Promise<void> {
  if (REQUIRES_SELECTION[action] && !selection.value) {
    ElMessage.warning('摘抄/高亮需要先框选页面区域')
    return
  }
  const sel = toSharedSelection()
  const imageDataUrl = sel && attachImage.value ? selection.value?.imageDataUrl : undefined
  const typed = text.value.trim()
  const message =
    typed ||
    (action === 'translate'
      ? '翻译所选内容'
      : action === 'explain'
        ? '解释所选内容'
        : action === 'note'
          ? '把所选内容整理成笔记'
          : '提取所选内容的高亮摘要')
  text.value = ''

  // M11 高亮：先把框选直接落库上页（不依赖 AI 回复，立即上页），
  // 再发聊天让 AI 提炼摘录（回复仅作文本展示）。
  if (action === 'highlight' && selection.value) {
    try {
      await readerStore.addHighlight({
        pageNumber: selection.value.page,
        rect: toRect(selection.value),
        color: 'yellow',
      })
      ElMessage.success(`已在第 ${selection.value.page} 页添加高亮`)
    } catch (err) {
      ElMessage.error(err instanceof Error ? err.message : String(err))
    }
  }

  await store.send(message, { action, imageDataUrl, selection: sel })
}

async function onSend(): Promise<void> {
  const typed = text.value.trim()
  const sel = toSharedSelection()
  const imageDataUrl = sel && attachImage.value ? selection.value?.imageDataUrl : undefined
  if (!typed && !imageDataUrl) return
  text.value = ''
  await store.send(typed, { imageDataUrl, selection: sel })
}
</script>

<style scoped>
.chat-input {
  padding: 10px 12px;
  border-top: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
}
.selection-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  margin-bottom: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}
.selection-thumb {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--el-border-color);
}
.selection-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.quick-actions {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}
.send-btn {
  flex-shrink: 0;
}
</style>
