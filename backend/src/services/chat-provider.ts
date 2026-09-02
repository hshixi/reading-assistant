/**
 * AI 回复流式来源（M8 为 mock 打字机；M9 换成真实 DeepSeek vision）。
 * 约定：返回 AsyncGenerator，逐段产出文本 chunk；异常时 throw，由路由转为 SSE error。
 */
import type { ActionType, Selection } from '@reading/shared'

export interface AiStreamInput {
  message: string
  action?: ActionType
  selection?: Selection
  /** PNG dataURL，M9 vision 用 */
  imageDataUrl?: string
  /** 选中原文（文本动作经后端注入 AI prompt） */
  excerptText?: string
}

const CHUNK_DELAY_MS = 24

/** mock：把固定回复按 2 字切块 + 轻微延迟，模拟流式打字机 */
export async function* streamAiChunks(input: AiStreamInput): AsyncGenerator<string> {
  const actionHint = input.action ? `【快捷动作 ${input.action}】` : ''
  const selectHint = input.selection ? `【已框选第 ${input.selection.page} 页区域】` : ''
  const imageHint = input.imageDataUrl ? '【已附带截图】' : ''
  const excerpt = (input.excerptText || '').replace(/\s+/g, ' ').trim()
  const excerptHint = excerpt ? `【原文节选】${excerpt.slice(0, 40)}…` : ''
  const parts = [
    `已收到你的问题${imageHint}${selectHint}：${input.message}`,
    excerptHint || null,
    `（这是 M8 阶段的模拟回复，${actionHint} M9 将接入真实 DeepSeek 视觉模型。）`,
    '页面内容越具体，AI 的回答越精准；看不懂的段落可以直接框选后提问。',
  ]
  const reply = parts.filter(Boolean).join('\n\n') + '\n'
  for (let i = 0; i < reply.length; i += 2) {
    await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS))
    yield reply.slice(i, i + 2)
  }
}
