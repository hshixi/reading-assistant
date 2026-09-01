/**
 * pdfjs-dist legacy 构建为 ESM（.mjs），后端是 CJS，运行时用动态 import()。
 * 这里声明所需的最小类型（仅页面计数用，渲染在 M5 前端完成）。
 */
declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export interface PdfDocumentProxy {
    numPages: number
    destroy(): Promise<void>
  }
  export interface PdfLoadingTask {
    promise: Promise<PdfDocumentProxy>
  }
  export function getDocument(src: unknown): PdfLoadingTask
}
