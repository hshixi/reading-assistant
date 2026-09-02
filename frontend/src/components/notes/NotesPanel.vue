<template>
  <div class="notes-panel">
    <!-- V2-F7：右键「笔记」带来的新建编辑态：原文只读引用块 + 空批注 textarea -->
    <div
      v-if="draft"
      class="note-composer"
    >
      <div class="composer-title">
        在原文下写批注
      </div>
      <div class="composer-quote">
        「{{ draft.text }}」
      </div>
      <el-input
        ref="contentRef"
        v-model="annotation"
        type="textarea"
        :rows="4"
        resize="none"
        maxlength="2000"
        show-word-limit
        placeholder="写下你的理解 / 批注…"
      />
      <div class="composer-actions">
        <el-button
          size="small"
          @click="emitDismiss"
        >
          取消
        </el-button>
        <el-button
          size="small"
          type="primary"
          :loading="saving"
          :disabled="!annotation.trim()"
          @click="save"
        >
          保存笔记
        </el-button>
      </div>
    </div>

    <div
      v-if="sortedNotes.length === 0"
      class="notes-empty"
    >
      <el-empty
        description="暂无笔记。选中原文右键「笔记」写批注，或在聊天输入「整理成笔记」由 AI 生成"
      />
    </div>
    <div
      v-else
      class="notes-list"
    >
      <NoteItem
        v-for="n in sortedNotes"
        :key="n.id"
        :note="n"
        @delete="remove"
        @jump="jump"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useNotesStore } from '@/stores/notes'
import NoteItem from './NoteItem.vue'
import type { NoteDraft } from './noteDraft'

const props = defineProps<{
  draft: NoteDraft | null
  /** 需要滚动定位到该笔记（闪烁提示）；消费后由父级清零 */
  focusId: number | null
}>()

const emit = defineEmits<{ jump: [page: number]; dismiss: []; focused: [id: number] }>()

const notesStore = useNotesStore()
/** ElInput 暴露的是 textarea（原生元素），非 textareaRef */
const contentRef = ref<{ textarea?: HTMLTextAreaElement } | null>(null)

const annotation = ref('')
const saving = ref(false)

/** 列表按创建时间倒序（最新在前；AI 生成与手写批注混排） */
const sortedNotes = computed(() =>
  [...notesStore.notes].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
)

const draftText = computed(() => props.draft?.text ?? '')

/** 新草稿到达 → 打开编辑态并聚焦批注框 */
watch(
  () => props.draft,
  async (d) => {
    if (d) {
      annotation.value = ''
      await nextTick()
      contentRef.value?.textarea?.focus?.()
    }
  },
  { immediate: true },
)

/** 需要定位某条笔记 → 滚动到视口中央 + 闪烁 1.5s */
watch(
  () => props.focusId,
  async (id) => {
    if (id == null) return
    await nextTick()
    const el = document.querySelector<HTMLElement>(`.note-item[data-note-id='${id}']`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('flash')
      setTimeout(() => el.classList.remove('flash'), 1500)
    }
    emit('focused', id)
  },
)

function emitDismiss(): void {
  annotation.value = ''
  emit('dismiss')
}

async function save(): Promise<void> {
  const d = props.draft
  if (!d) return
  const content = annotation.value.trim()
  if (!content) return
  saving.value = true
  try {
    await notesStore.create({
      content,
      excerptText: draftText.value,
      pageNumber: d.page,
      rects: d.rects,
    })
    ElMessage.success('笔记已保存，原文已加下划线')
    annotation.value = ''
    emit('dismiss')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    saving.value = false
  }
}

async function remove(id: number): Promise<void> {
  await notesStore.remove(id)
}

function jump(page: number): void {
  emit('jump', page)
}
</script>

<style scoped>
.notes-panel {
  height: 100%;
  overflow-y: auto;
  background: var(--el-fill-color-lighter, #f5f6f7);
}
.note-composer {
  margin: 10px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}
.composer-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}
.composer-quote {
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-left: 3px solid var(--el-color-warning);
  padding: 6px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 120px;
  overflow-y: auto;
}
.composer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.notes-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.notes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
}
</style>
