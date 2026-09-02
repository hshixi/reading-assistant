<template>
  <div class="chat-input">
    <!-- 框选截图预览（vision 提问/翻译图） -->
    <div
      v-if="imageSel"
      class="selection-preview"
    >
      <img
        :src="imageSel.imageDataUrl"
        class="selection-thumb"
        alt="框选截图"
      >
      <div class="selection-info">
        <span>第 {{ imageSel.page }} 页区域</span>
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

    <!-- V1 快捷动作（V2 改为文本右键菜单触达；聊天提及 AI 整理走同一发送通道） -->
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
import { useReaderStore } from '@/stores/reader'

const store = useChatStore()
const readerStore = useReaderStore()

const text = ref('')
const attachImage = ref(true)

/** V2：本输入区只消费「框选截图」选区；文本选区走右键菜单/聊天提及，不经此处 */
const imageSel = computed(() =>
  readerStore.selection?.kind === 'image' ? readerStore.selection : null,
)

/** 动作是否需要选区（摘抄/高亮必须框选） */
const REQUIRES_SELECTION: Partial<Record<ActionType, boolean>> = {
  note: true,
  highlight: true,
}

const canSend = computed(() => text.value.trim().length > 0 || !!imageSel.value)

function toSharedSelection(): Selection | undefined {
  const s = imageSel.value
  if (!s) return undefined
  return { page: s.page, rects: [s.rect] }
}

function clearSelection(): void {
  readerStore.clearSelection()
}

async function sendAction(action: ActionType): Promise<void> {
  if (REQUIRES_SELECTION[action] && !imageSel.value) {
    ElMessage.warning('摘抄/高亮需要先框选页面区域')
    return
  }
  const sel = toSharedSelection()
  const imageDataUrl = sel && attachImage.value ? imageSel.value?.imageDataUrl : undefined
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
  if (action === 'highlight' && imageSel.value) {
    try {
      await readerStore.addHighlight({
        pageNumber: imageSel.value.page,
        rects: [imageSel.value.rect],
        color: 'yellow',
      })
      ElMessage.success(`已在第 ${imageSel.value.page} 页添加高亮`)
    } catch (err) {
      ElMessage.error(err instanceof Error ? err.message : String(err))
    }
  }

  await store.send(message, { action, imageDataUrl, selection: sel })
}

async function onSend(): Promise<void> {
  const typed = text.value.trim()
  const sel = toSharedSelection()
  const imageDataUrl = sel && attachImage.value ? imageSel.value?.imageDataUrl : undefined
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
