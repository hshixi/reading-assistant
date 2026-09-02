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
        class="chat-textarea"
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
import { ElMessage } from 'element-plus'
import { Camera, Close } from '@element-plus/icons-vue'
import type { ActionType, Selection } from '@reading/shared'
import { useChatStore } from '@/stores/chat'
import { useReaderStore } from '@/stores/reader'

/** N9-B3 + V2.1-P3：聊天内「提及动作词表」——命中后与右键菜单动作走同一通道并落库（B3）。
 *  V2.1-P3 扩展：补全动词短语（…记录成笔记 / …高亮记录一下 等句式也能命中），
 *  并新增仅针对 笔记/高亮 的句内兜底扫描（规则层）。 */
const MENTION_RULES: Array<{ pattern: RegExp; action: ActionType }> = [
  { pattern: /^(翻译|翻译一下|翻一下|翻译成|译一下|译成)/, action: 'translate' },
  { pattern: /^(解释|解释一下|讲解|讲讲|说明|说明一下)/, action: 'explain' },
  {
    pattern:
      /^(摘抄|整理|记笔记|做笔记|做个笔记|做成笔记|记录成笔记|记成笔记|整理成笔记|存成笔记|收录成笔记|记为笔记|记录为笔记|整理为笔记|作为笔记|记入笔记|收录进笔记|记一条笔记)/,
    action: 'note',
  },
  {
    pattern:
      /^(高亮|标注|标一下|标记|高亮一下|高亮标注|高亮标记|高亮记录|标成高亮|加高亮|加上高亮|设为高亮|标记高亮)/,
    action: 'highlight',
  },
]

/** 句首客套/对象助词（可叠加，逐段剥离直到命中动作词表）。
 *  V2.1-P3：剥离按最长前缀优先（排序兜底），避免「这段」先于「这段话」剥离导致残句漏判。 */
const GRACE_TOKENS = [
  '能不能', '可不可以', '你帮我', '麻烦你', '帮我一下', '请你',
  '下面这段', '上面这段', '这段内容', '这段文字', '这一段', '这一句',
  '这段话', '这句话', '那段话', '那句', '这一大段', '选中的文字', '选中的内容',
  '可以', '麻烦', '帮我', '希望', '请', '帮', '把', '将', '给', '对',
  '这段', '这句', '这些', '这些内容', '这个', '这部分', '选中文字', '选中内容', '下面', '上面的',
]

/**
 * 识别 typed 是否以动作命令开头（「什么是翻译」这类提问不算）。
 * 逐段剥离：命中动作词表即返回；否则剥一个最长匹配客套/对象助词；纯标点直接跳过。
 */
function detectMentionAction(typed: string): ActionType | null {
  let head = typed.trim()
  for (let guard = 0; guard < 20 && head; guard++) {
    const hit = MENTION_RULES.find((r) => r.pattern.test(head))
    if (hit) return hit.action
    const punct = head.match(/^[，。、；：,.;:！？!?、]+/)
    if (punct) {
      head = head.slice(punct[0].length).trim()
      continue
    }
    const matched = GRACE_TOKENS.filter((t) => head.startsWith(t))
    const tok = matched.sort((a, b) => b.length - a.length)[0]
    if (!tok) break
    head = head.slice(tok.length).trim()
  }
  return null
}

/** V2.1-P3：句内动作兜底扫描 —— 只覆盖 笔记/高亮 两类「落库型」动作（动词结构完整，误伤面小）。
 *  翻译/解释 不在此列：「翻译并解释这段话」这类自然请求仍按普通聊天+上下文处理，避免截胡。 */
const SCAN_RULES: Array<{ pattern: RegExp; action: ActionType }> = [
  {
    // 笔记：「(把/给/请/帮…) … 记/整理/收录/存 …(成|为|进|入)笔记」完整命令结构
    pattern:
      /(?:把|将|给|请|麻烦|帮|帮我|希望|想让).{0,18}?(?:记录|记|整理|收录|存|写)(?:成|为|进|入)笔记/,
    action: 'note',
  },
  {
    // 高亮：「(把/给/请/帮…) … (高亮/标注/标记) + 一下/这条/记录 等命令尾」，尾缀必选以排除名词用法
    pattern:
      /(?:把|将|给|请|麻烦|帮|帮我|希望).{0,12}?(?:高亮|标注|标记)(?:一下|起来|这条|这段|标注|记录|标记|处理)/,
    action: 'highlight',
  },
]

/** 句内动作兜底：head 链剥离未命中时的第二通道（只命中 笔记/高亮）。 */
function detectActionByScan(typed: string): ActionType | null {
  const hit = SCAN_RULES.find((r) => r.pattern.test(typed))
  return hit ? hit.action : null
}

/** 提及→动作统一入口：head 链优先，未命中再走句内兜底扫描。 */
function resolveChatAction(typed: string): ActionType | null {
  return detectMentionAction(typed) ?? detectActionByScan(typed)
}

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

/** 句子是否像「功能提问」而非动作命令（避免把「高亮是什么」误判成执行动作） */
function looksQuestionish(typed: string): boolean {
  return (
    /[？?]/.test(typed) ||
    /(是什么|什么是|怎么|如何|为啥|为什么|区别|用处|功能|在哪|能做什么|有啥用|干嘛用)/.test(typed)
  )
}

async function onSend(): Promise<void> {
  if (store.isStreaming) return
  const typed = text.value.trim()
  const imgUrl = attachedImageUrl()
  if (!typed && !imgUrl) return

  // N9-B3 + V2.1-P3：提及→动作。仅当存在「文本选区」时把 typed 命中的动作
  // 附加到本消息（同右键菜单动作通道，note/highlight 经后端解析 JSON 落库）。
  const t = textSel.value
  // 功能提问（含 什么/怎么/为什么…）不当作动作命令：如「笔记是什么」「高亮怎么用」
  const mentionAction = t && !looksQuestionish(typed) ? resolveChatAction(typed) : null
  // 无文本选区却明确提及「高亮/笔记」这类选区动作 → 提示先选文字（功能提问除外）
  if (!t && !looksQuestionish(typed)) {
    const a = resolveChatAction(typed)
    if (a === 'highlight' || a === 'note') {
      ElMessage.warning('请先拖动选中文字，再提及「高亮 / 笔记」动作')
      return
    }
  }

  // 文本原文随消息作为上下文（N9 提及动作在此同一通道上叠加 action）
  const txtSel: Selection | undefined = t
    ? { page: t.page, rects: t.rects }
    : undefined

  text.value = ''
  try {
    await store.send(typed, {
      imageDataUrl: imgUrl,
      action: mentionAction ?? undefined,
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
  /* V2.1-P1：输入区占聊天面板约 1/5 高、内部多行填满；消息列表 flex:1 自动吃剩余 4/5 */
  flex: 0 0 20%;
  min-height: 108px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 8px 10px;
  border-top: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
}
.pending-chips {
  flex-shrink: 0;
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
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 8px;
  align-items: stretch;
}
.side-btns {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-end;
  justify-content: flex-end;
  flex-shrink: 0;
}
.snap-btn {
  height: 32px;
}
.chat-textarea,
.chat-textarea :deep(.el-textarea) {
  flex: 1;
  height: 100%;
}
.chat-textarea :deep(.el-textarea__inner) {
  height: 100% !important;
  resize: none;
  overflow-y: auto;
}
</style>
