/**
 * pdf.js WASM 解码器资源定位。
 *
 * 背景：pdf.js v5 的 JBIG2 / JPEG2000 / ICC(qcms) 解码依赖 .wasm 文件，渲染层以
 * `wasmUrl`（须带尾斜杠）拼文件名 fetch。本应用渲染层 origin 为 file://，直接 fetch
 * file:// 会被 Chromium 拦（webSecurity:true），因此统一改由后端经 http://127.0.0.1 提供
 * （后端已全局 CORS *），渲染层把 wasmUrl 指到 http://<backend>/pdfjs/wasm/。
 *
 * pdfjs-dist 位置：dev 由仓库根 node_modules 解析；打包后由 extraResources
 * Resources/backend/node_modules（release 脚本裁剪保留 pdf.worker.mjs + wasm/）提供。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(__filename)

/** 解析 pdfjs-dist 的 wasm 目录（内含 jbig2/openjpeg/qcms 的 .wasm 与 nowasm 兜底 js） */
export function resolvePdfjsWasmDir(): string {
  const pkgDir = path.dirname(require.resolve('pdfjs-dist/package.json'))
  return path.join(pkgDir, 'wasm')
}

/**
 * 校验并返回 wasm 目录内的目标文件绝对路径；非法名（目录穿越等）/不存在 → null。
 * pdf.js 只按固定文件名请求（jbig2.wasm、openjpeg.wasm、qcms_bg.wasm、*_nowasm_fallback.js）。
 */
export function safeWasmFile(name: string): string | null {
  if (!/^[\w.-]+$/.test(name)) return null
  const wasmDir = resolvePdfjsWasmDir()
  const filePath = path.join(wasmDir, name)
  if (!filePath.startsWith(wasmDir + path.sep)) return null
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null
  return filePath
}
