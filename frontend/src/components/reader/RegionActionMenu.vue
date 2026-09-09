<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="ram-overlay"
      @mousedown.prevent="emit('close')"
      @contextmenu.prevent="emit('close')"
      @mousewheel="emit('close')"
    >
      <!-- V2.4：框选区域后的小工具条（笔记 / 高亮 / 发聊天）。宽 ~230，需在可视区内钳制 -->
      <div
        class="ram"
        :style="{ left: `${x}px`, top: `${y}px` }"
        @mousedown.stop
      >
        <div class="ram-title">
          把框选区域
        </div>
        <div class="ram-sub">
          小字先放大再框选，识别更准
        </div>
        <button
          class="ram-item accent-note"
          @click="choose('note')"
        >
          <span class="ram-name">存为笔记</span>
          <span class="ram-hint">AI 转写原文 → 笔记</span>
        </button>
        <button
          class="ram-item accent"
          @click="choose('highlight')"
        >
          <span class="ram-name">存为高亮</span>
          <span class="ram-hint">AI 转写原文 → 高亮</span>
        </button>
        <button
          class="ram-item"
          @click="choose('chat')"
        >
          <span class="ram-name">发聊天</span>
          <span class="ram-hint">把截图发给 AI 提问</span>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

/** V2.4：框选区域可做的动作 —— note/highlight 走聊天 OCR 转写落库，chat 交给聊天 */
export type RegionAction = 'note' | 'highlight' | 'chat'

defineProps<{
  visible: boolean
  x: number
  y: number
}>()

const emit = defineEmits<{
  action: [action: RegionAction]
  close: []
}>()

function choose(action: RegionAction): void {
  emit('action', action)
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.ram-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
}

.ram {
  position: fixed;
  width: 230px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  overflow: hidden;
  padding: 6px;
}

.ram-title {
  padding: 4px 10px 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.ram-sub {
  padding: 0 10px 6px;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}

.ram-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--el-text-color-primary);
  cursor: pointer;
  border-radius: 6px;
  text-align: left;
}
.ram-item:hover {
  background: var(--el-color-primary-light-9);
}
.ram-item.accent {
  color: var(--el-color-warning);
}
.ram-item.accent:hover {
  background: var(--el-color-warning-light-9);
}
.ram-item.accent-note {
  color: var(--el-color-danger);
}
.ram-item.accent-note:hover {
  background: var(--el-color-danger-light-9);
}

.ram-hint {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
