<template>
  <div class="chat-input">
    <!-- V2-F4：待发送选区（原文拖选 或 框选截图）作为 chip 预览；随消息发送后自动清除 -->
    <div
      v-if="textSel || imageSel"
      class="pending-chips"
    >
      <!-- 原文拖选 chip：提示将作为下一条消息的原文上下文（右键菜单已消费的场景会清除） -->
      <div
        v-if="textSel"
        class="chip chip-text"
        :title="textSel.text"
      >
        <span class="chip-label">原文</span>
        <span class="chip-body">{{ textSnippet }}</span>
        <span class="chip-page">第 {{ textSel.page }} 页</span>
        <el-button
          link
          size="small"
          class="chip-x"
          title="清除该原文选区"
          @click="readerStore.clearSelection()"
        >
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
      <!-- 框选截图 chip：带缩略图 + 是否附带截图开关 -->
      <div
        v-else-if="imageSel"
        class="chip chip-image"
      >
        <img
          :src="imageSel.imageDataUrl"
          class="chip-thumb"
          alt="框选截图"
        >
        <span class="chip-body">第 {{ imageSel.page }} 页区域截图</span>
        <el-checkbox
          v-model="attachImage"
          size="small"
        >
          附带
        </el-checkbox>
        <el-button
          link
          size="small"
          class="chip-x"
          title="清除该截图"
          @click="readerStore.clearSelection()"
        >
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="input-row">
      <el-input
        v-model="text"
        type="textarea"
        :autosize="{ minRows: 1, maxRows: 6 }"
        placeholder="提问，Enter 发送，Shift+Enter 换行"
        resize="none"
        @keydown.enter.exact.prevent="onSend"
      />
      <div class="side-btns">
        <!-- V2-F3：框选截图收进输入区小图标（替代原快捷动作行 + 工具栏「框选」按钮） -->
        <el-button
          class="snap-btn"
          :class="{ active: readerStore.selecting }"
          :type="readerStore.selecting ? 'primary' : 'default'"
          size="small"
          title="框选截图发给 AI"
          @click="toggleSelect"
        >
          <el-icon><Camera /></el-icon>
        </el-button>
        <el-button
          v-if="store.isStreaming"
          class="send-btn"
          size="small"
          type="danger"
          @click="store.stop()"
        >
          停止
        </el-button>
        <el-button
          v-else
          class="send-btn"
          size="small"
          type="primary"
          :disabled="!canSend"
          @click="onSend"
        >
          发送
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Camera, Close } from '@element-plus/icons-vue'
import type { Selection } from '@reading/shared'
import { useChatStore } from '@/stores/chat'
import { useReaderStore } from '@/stores/reader'

const store = useChatStore()
const readerStore = useReaderStore()

const text = ref('')
const attachImage = ref(true)

/** V2-F4：本输入区同时消费两类选区（互斥）—— 截图或原文。 */
const imageSel = computed(() =>
  readerStore.selection?.kind === 'image' ? readerStore.selection : null,
)
const textSel = computed(() =>
  readerStore.selection?.kind === 'text' ? readerStore.selection : null,
)

const canSend = computed(() => text.value.trim().length > 0 || !!imageSel.value)

/** 原文 chip 展示：折叠空白，过长省略 */
const textSnippet = computed(() => {
  const t = textSel.value?.text ?? ''
  const flat = t.replace(/\s+/g, ' ').trim()
  return flat.length > 40 ? `${flat.slice(0, 40)}…` : flat
})

/** 当前截图是否附带（attached） */
function attachedImageUrl(): string | undefined {
  return imageSel.value && attachImage.value ? imageSel.value.imageDataUrl : undefined
}

function toggleSelect(): void {
  if (readerStore.selecting) readerStore.cancelSelect()
  else readerStore.beginSelect()
}

async function onSend(): Promise<void> {
  if (store.isStreaming) return
  const typed = text.value.trim()
  const imgUrl = attachedImageUrl()
  if (!typed && !imgUrl) return

  // 文本原文随消息作为上下文（N9 提及动作在此同一通道上叠加 action）
  const t = textSel.value
  const txtSel: Selection | undefined = t
    ? { page: t.page, rects: t.rects }
    : undefined

  text.value = ''
  try {
    await store.send(typed, {
      imageDataUrl: imgUrl,
      selection: txtSel,
      excerptText: t?.text,
    })
  } finally {
    // V2-F4 自动清除：发送成功/失败后，被本次消费的选区都不该滞留（防重复误发）
    if (imgUrl || t) readerStore.clearSelection()
  }
}
</script>

<style scoped>
.chat-input {
  padding: 8px 10px;
  border-top: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
}
.pending-chips {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}
.chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
  font-size: 12px;
  color: var(--el-text-color-regular);
}
.chip-label {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 999px;
  padding: 1px 8px;
}
.chip-body {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chip-page {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
}
.chip-thumb {
  width: 36px;
  height: 36px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--el-border-color);
  flex-shrink: 0;
}
.chip-x {
  flex-shrink: 0;
  margin-left: auto;
}
.input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}
.side-btns {
  display: flex;
  gap: 6px;
  align-items: flex-end;
  flex-shrink: 0;
}
.snap-btn {
  height: 32px;
}
</style>
