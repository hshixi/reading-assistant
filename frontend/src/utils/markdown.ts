/**
 * Markdown + LaTeX 渲染（聊天消息 / 笔记正文共用）。
 *
 * 模型（DeepSeek 等）输出的公式常见写法，全都要认：
 *   块级：$$...$$   \[...\]   \begin{aligned}...\end{aligned}
 *   行内：$...$     \(...\)
 * 其中 `\(` / `\[` 若交给 marked 默认处理会被当成「转义括号」吃掉反斜杠，
 * 因此在 marked 的 inline/block tokenizer 扩展里先于 escape 规则捕获。
 * 渲染结果与 markdown 一样经 DOMPurify 清洗后进 v-html。
 */
import { marked, type TokenizerAndRendererExtension, type Tokens } from 'marked'
import katex from 'katex'
import DOMPurify from 'dompurify'

interface MathToken extends Tokens.Generic {
  text: string
  displayMode: boolean
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      default: return '&#39;'
    }
  })
}

/**
 * 公式渲染结果缓存：流式回答每来一个 delta 都会整段重新解析，
 * 已渲染过的公式（TeX → HTML）没必要再算一遍。
 * 上限保护：流式过程中的半截公式会产生大量一次性 key，满了整体清空。
 */
const mathCache = new Map<string, string>()
const MATH_CACHE_LIMIT = 300

/** KaTeX 渲染；公式本身写错时不抛错（红字提示），彻底失败则退化为等宽原文 */
function renderMath(tex: string, displayMode: boolean): string {
  const key = `${displayMode ? 'D' : 'I'}${tex}`
  const cached = mathCache.get(key)
  if (cached !== undefined) return cached

  let html: string
  try {
    html = katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
    })
  } catch {
    html = `<code class="math-fallback">${escapeHtml(tex)}</code>`
  }
  if (mathCache.size >= MATH_CACHE_LIMIT) mathCache.clear()
  mathCache.set(key, html)
  return html
}

const blockMath: TokenizerAndRendererExtension = {
  name: 'blockMath',
  level: 'block',
  start(src: string) {
    const i = src.search(/^\$\$|^\\\[|^\\begin\{/m)
    return i < 0 ? undefined : i
  },
  tokenizer(src: string) {
    let m = /^\$\$([\s\S]*?)\$\$(?:[ \t]*\n)?/.exec(src)
    if (m) return { type: 'blockMath', raw: m[0], text: m[1], displayMode: true } as MathToken
    m = /^\\\[([\s\S]*?)\\\](?:[ \t]*\n)?/.exec(src)
    if (m) return { type: 'blockMath', raw: m[0], text: m[1], displayMode: true } as MathToken
    // 裸 \begin{env}...\end{env}（模型偶尔省略 $$ 包裹）
    m = /^\\begin\{([a-zA-Z]+\*?)\}[\s\S]*?\\end\{\1\}/.exec(src)
    if (m) return { type: 'blockMath', raw: m[0], text: m[0], displayMode: true } as MathToken
    return undefined
  },
  renderer(token) {
    const t = token as MathToken
    return `<div class="math-block">${renderMath(t.text, t.displayMode)}</div>\n`
  },
}

const inlineMath: TokenizerAndRendererExtension = {
  name: 'inlineMath',
  level: 'inline',
  start(src: string) {
    const i = src.search(/\$|\\\(|\\\[/)
    return i < 0 ? undefined : i
  },
  tokenizer(src: string) {
    let m = /^\\\(([\s\S]*?)\\\)/.exec(src)
    if (m) return { type: 'inlineMath', raw: m[0], text: m[1], displayMode: false } as MathToken
    m = /^\\\[([\s\S]*?)\\\]/.exec(src)
    if (m) return { type: 'inlineMath', raw: m[0], text: m[1], displayMode: true } as MathToken
    // 段落中出现的 $$...$$（块级扩展没吃到的场景）：按独立公式渲染
    m = /^\$\$([\s\S]*?)\$\$/.exec(src)
    if (m) return { type: 'inlineMath', raw: m[0], text: m[1], displayMode: true } as MathToken
    // $...$：排除 $$、排除紧贴空格的写法，且在 $ 后跟数字时不吃（避免把「$5 和 $10」当公式）
    m = /^\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/.exec(src)
    if (m) return { type: 'inlineMath', raw: m[0], text: m[1], displayMode: false } as MathToken
    return undefined
  },
  renderer(token) {
    const t = token as MathToken
    return renderMath(t.text, t.displayMode)
  },
}

marked.use({
  // 单换行即换行：模型回答里的分行是有意义的
  breaks: true,
  extensions: [blockMath, inlineMath],
})

// 外链在新窗口/系统浏览器打开（Electron 主进程的 setWindowOpenHandler 会接管转发）
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    const href = node.getAttribute('href') ?? ''
    if (/^https?:\/\//i.test(href)) {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
  }
})

/**
 * markdown → 可 v-html 的安全 HTML（公式已由 KaTeX 渲染）。
 * ADD_TAGS：KaTeX 的 MathML 里 semantics / annotation 在 DOMPurify 默认黑名单中，
 * 不补回会把公式 TeX 源码变成 <math> 里的裸文本（读屏/复制都会重复一遍）。
 */
export function renderMarkdown(md: string): string {
  try {
    return DOMPurify.sanitize(marked.parse(md) as string, {
      ADD_TAGS: ['semantics', 'annotation'],
    })
  } catch {
    // 渲染失败时退化为纯文本，绝不把原始 md 当 HTML 注入
    return escapeHtml(md).replace(/\n/g, '<br>')
  }
}
