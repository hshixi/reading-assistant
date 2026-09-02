<template>
  <Teleport to="body">
    <div
      v-if="visible && payload"
      class="tsm-overlay"
      @mousedown.prevent="emit('close')"
      @contextmenu.prevent="emit('close')"
      @mousewheel="onWheel"
    >
      <!-- V2-F6：选文右键菜单。宽 240，需在可视区内钳制（含预览区高 ~180） -->
      <div
        class="tsm"
        :style="{ left: `${x}px`, top: `${y}px` }"
        @mousedown.stop
      >
        <div
          class="tsm-source"
          :title="payload.text"
        >
          「{{ snippet }}」
        </div>
        <button
          class="tsm-item"
          @click="choose('translate')"
        >
          <span class="tsm-name">翻译</span>
          <span class="tsm-hint">→ 聊天</span>
        </button>
        <button
          class="tsm-item"
          @click="choose('explain')"
        >
          <span class="tsm-name">解释</span>
          <span class="tsm-hint">→ 聊天</span>
        </button>
        <button
          class="tsm-item accent-note"
          @click="choose('note')"
        >
          <span class="tsm-name">笔记</span>
          <span class="tsm-hint">→ 写批注</span>
        </button>
        <button
          class="tsm-item accent"
          @click="choose('highlight')"
        >
          <span class="tsm-name">高亮</span>
          <span class="tsm-hint">上页标记</span>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import type { TextSelectionPayload } from '@/stores/reader'

export type TextAction = 'translate' | 'explain' | 'note' | 'highlight'

const props = defineProps<{
  visible: boolean
  x: number
  y: number
  payload: TextSelectionPayload | null
}>()

const emit = defineEmits<{
  action: [payload: TextSelectionPayload, action: TextAction]
  close: []
}>()

/** 预览区只展示前几行原文，太长省略 */
const snippet = computed(() => {
  const t = props.payload?.text ?? ''
  const flat = t.replace(/\s+/g, ' ').trim()
  return flat.length > 46 ? `${flat.slice(0, 46)}…` : flat
})

function choose(action: TextAction): void {
  if (props.payload) emit('action', props.payload, action)
}

/** 滚轮关闭（避免菜单挡住翻页/滚动体验） */
function onWheel(): void {
  emit('close')
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.tsm-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
}

.tsm {
  position: fixed;
  width: 240px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  overflow: hidden;
  padding: 4px;
}

.tsm-source {
  padding: 8px 10px;
  margin-bottom: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-radius: 6px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-all;
}

.tsm-item {
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
.tsm-item:hover {
  background: var(--el-color-primary-light-9);
}
.tsm-item.accent {
  color: var(--el-color-warning);
}
.tsm-item.accent:hover {
  background: var(--el-color-warning-light-9);
}
.tsm-item.accent-note {
  color: var(--el-color-danger);
}
.tsm-item.accent-note:hover {
  background: var(--el-color-danger-light-9);
}

.tsm-hint {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
