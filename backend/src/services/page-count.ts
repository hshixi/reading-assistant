/**
 * 读取 PDF 页数。pdfjs-dist 渲染由前端（M5）完成；这里仅用 getDocument 元数据，
 * 不需要 canvas。该模块独立失败不致命 —— 调用方 catch 后保持 pageCount=null。
 */
import fs from 'node:fs'

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
