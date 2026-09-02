/**
 * 读取 PDF 页数。pdfjs-dist 渲染由前端（M5）完成；这里仅用 getDocument 元数据，
 * 不需要 canvas。该模块独立失败不致命 —— 调用方 catch 后保持 pageCount=null。
 *
 * Node 兼容：pdf.mjs 顶层 `new DOMMatrix()` 依赖 canvas 注入的全局类；正式依赖方
 * （仓库根 node_modules 含 @napi-rs/canvas）能满足，打包后的后端只随包 pdf.mjs +
 * pdf.worker.mjs，无 canvas —— 页数解析仅读文档结构、不触碰 DOMMatrix 的矩阵运算，
 * 因此在 import 前垫一个最小桩（构造不抛）即可避免整模块加载崩溃。
 */
import fs from 'node:fs'

if (!(globalThis as Record<string, unknown>).DOMMatrix) {
  ;(globalThis as Record<string, unknown>).DOMMatrix = class DOMMatrix {
    // 仅需支持无参构造（pdf.mjs 顶层 SCALE_MATRIX）；矩阵方法只被渲染路径使用
    constructor(_m?: any) {}
    translate(_x?: any, _y?: any): any {
      return new (globalThis as any).DOMMatrix()
    }
    scale(_x?: any, _y?: any): any {
      return new (globalThis as any).DOMMatrix()
    }
    rotate(_x?: any): any {
      return new (globalThis as any).DOMMatrix()
    }
    multiply(_m?: any): any {
      return new (globalThis as any).DOMMatrix()
    }
    static fromMatrix(m?: any): any {
      return new (globalThis as any).DOMMatrix(m)
    }
    static fromString(s?: any): any {
      return new (globalThis as any).DOMMatrix(s)
    }
  }
}

export async function countPdfPages(filePath: string): Promise<number> {
  const mod = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(fs.readFileSync(filePath))
  const doc = await mod.getDocument({ data, disableWorker: true }).promise
  try {
    return doc.numPages
  } finally {
    await doc.destroy()
  }
}
