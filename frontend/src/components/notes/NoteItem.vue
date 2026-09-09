<template>
  <div
    class="note-item"
    :data-note-id="note.id"
    @click="onJump"
  >
    <div class="note-head">
      <span
        v-if="note.pageNumber"
        class="note-page"
      >第 {{ note.pageNumber }} 页</span>
      <span
        v-else
        class="note-page muted"
      >未定位</span>
      <!-- V2.4：扫描区域笔记 → 截图留档徽标 -->
      <span
        v-if="note.screenshotRelPath"
        class="note-badge"
      >区域截图</span>
      <span class="note-time">{{ timeText }}</span>
      <span class="note-actions">
        <el-button
          link
          type="primary"
          size="small"
          title="编辑批注"
          @click.stop="startEdit"
        >
          <el-icon><EditPen /></el-icon>
        </el-button>
        <el-button
          link
          type="danger"
          size="small"
          class="note-delete"
          @click.stop="onDelete"
        >
          删除
        </el-button>
      </span>
    </div>
    <!-- V2-F7：原文摘录（引文样式）置顶 -->
    <div
      v-if="excerpt"
      class="note-excerpt"
      :title="excerpt"
    >
      {{ excerpt }}
    </div>
    <!-- V2.4：扫描区域笔记 → 框选截图缩略图（经后端路由加载；失效兜底文字） -->
    <div
      v-if="regionThumbUrl"
      class="note-region-thumb"
    >
      <img
        :src="regionThumbUrl"
        alt="框选截图"
        loading="lazy"
        @error="regionThumbUrl = null"
      >
    </div>

    <!-- V2.4：行内批注编辑态 -->
    <div v-if="editing">
      <el-input
        ref="editInputRef"
        v-model="draftContent"
        type="textarea"
        :rows="3"
        resize="none"
        maxlength="2000"
        placeholder="写下你的理解 / 批注…"
      />
      <div class="note-edit-actions">
        <el-button
          size="small"
          @click="cancelEdit"
        >
          取消
        </el-button>
        <el-button
          size="small"
          type="primary"
          :loading="saving"
          :disabled="!draftContent.trim()"
          @click="saveEdit"
        >
          保存批注
        </el-button>
      </div>
    </div>
    <div
      v-else
      class="note-content"
      :class="{ empty: !content }"
    >
      {{ content || '（无批注）' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { EditPen } from '@element-plus/icons-vue'
import type { Note } from '@reading/shared'
import { bookRegionUrl } from '@/api/client'
import { useNotesStore } from '@/stores/notes'

const props = defineProps<{ note: Note }>()
const emit = defineEmits<{ delete: [id: number]; jump: [page: number] }>()

const notesStore = useNotesStore()

const timeText = computed(() => {
  const d = new Date(props.note.createdAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
})

/** 归一化显示原文：折叠空白便于展示 */
const excerpt = computed(() => (props.note.excerptText ?? '').trim())

/** 批注正文 */
const content = computed(() => (props.note.content ?? '').trim())

/* ---- V2.4：区域笔记截图缩略图（非截图记录为 null） ---- */
const regionThumbUrl = ref<string | null>(
  props.note.screenshotRelPath ? bookRegionUrl(props.note.bookId, props.note.screenshotRelPath) : null,
)

/* ---- V2.4：行内批注编辑（AI 转写原文 → 用户补批注），PATCH content 后原位替换 ---- */
const editing = ref(false)
const saving = ref(false)
const draftContent = ref('')
const editInputRef = ref<{ textarea?: HTMLTextAreaElement } | null>(null)

function startEdit(): void {
  draftContent.value = props.note.content ?? ''
  editing.value = true
  void nextTick().then(() => editInputRef.value?.textarea?.focus?.())
}

function cancelEdit(): void {
  editing.value = false
  draftContent.value = ''
}

async function saveEdit(): Promise<void> {
  const c = draftContent.value.trim()
  if (!c) return
  saving.value = true
  try {
    await notesStore.update(props.note.id, c)
    editing.value = false
    ElMessage.success('批注已更新')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    saving.value = false
  }
}

function onJump(): void {
  if (props.note.pageNumber != null) emit('jump', props.note.pageNumber)
}

async function onDelete(): Promise<void> {
  try {
    await ElMessageBox.confirm('删除这条笔记？', '确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  emit('delete', props.note.id)
}
</script>

<style scoped>
.note-item {
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, background-color 0.2s;
}
.note-item:hover {
  border-color: var(--el-color-primary);
}
/* V2-F7：定位到该条时 1.5s 淡入淡出的闪烁（ReaderView/NotesPanel 触发后加类再移除） */
.note-item.flash {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--el-color-primary) 30%, transparent);
  background: var(--el-color-primary-light-9);
  animation: note-flash 1.5s ease-out 1;
}
@keyframes note-flash {
  0% { background: var(--el-color-primary-light-5); }
  100% { background: var(--el-color-primary-light-9); }
}

.note-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.note-page {
  font-size: 12px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  padding: 1px 8px;
  border-radius: 999px;
}
.note-page.muted {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
}
/* V2.4：区域笔记徽标（截图留档标识） */
.note-badge {
  font-size: 11px;
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
  padding: 1px 8px;
  border-radius: 999px;
}
.note-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.note-actions {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
}
/* V2.4：区域截图缩略图（与 excerpt 同宽整张展示） */
.note-region-thumb {
  margin-bottom: 8px;
}
.note-region-thumb img {
  display: block;
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}
.note-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
/* V2-F7：原文摘录引文样式（灰底 + 左竖线），同笔记的批注分开展示 */
.note-excerpt {
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-left: 3px solid var(--el-color-warning);
  padding: 6px 8px;
  border-radius: 4px;
  margin-bottom: 6px;
  white-space: pre-wrap;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.note-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-primary);
  white-space: pre-wrap;
  word-break: break-word;
}
.note-content.empty {
  color: var(--el-text-color-placeholder);
}
</style>
