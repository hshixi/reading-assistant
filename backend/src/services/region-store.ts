/**
 * 区域截图落盘（V2.4）。扫描版 PDF 无文字层，用户框选区域 → 前端给 PNG dataURL，
 * 这里把 dataURL 解码落盘到 books/{bookId}/region/{name}.png（随书目录删除自动清理）。
 *
 * DB 只存文件名（screenshot_rel_path 列）；静态资源由
 * GET /api/books/:bookId/region/:file 白名单提供（见 books.ts）。
 * 返回文件名而非绝对/相对路径，避免库内混入用户目录信息。
 */
import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

/** 解码上限：JSON body 本身受 express.json 1mb 限制，这里再兜一道防异常大图 */
const MAX_BYTES = 3 * 1024 * 1024

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function regionDir(dataDir: string, bookId: number): string {
  return path.join(dataDir, 'books', String(bookId), 'region')
}

/**
 * 保存一张区域截图。
 * @returns 存盘文件名（如 `1725...-a1b2c3.png`），供 DB screenshot_rel_path 使用
 * @throws 非法 dataURL / 非 PNG / 超尺寸
 */
export async function saveRegionPng(
  dataDir: string,
  bookId: number,
  imageDataUrl: string,
): Promise<string> {
  if (!Number.isInteger(bookId) || bookId < 1) throw new Error('bookId 非法')
  const prefix = 'data:image/png;base64,'
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith(prefix)) {
    throw new Error('区域截图格式非法：需要 image/png 的 dataURL')
  }

  let buf: Buffer
  try {
    buf = Buffer.from(imageDataUrl.slice(prefix.length), 'base64')
  } catch {
    throw new Error('区域截图 base64 解码失败')
  }
  if (buf.length === 0) throw new Error('区域截图内容为空')
  if (buf.length > MAX_BYTES) throw new Error('区域截图过大')
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('区域截图不是 PNG 文件')

  const dir = regionDir(dataDir, bookId)
  await fs.promises.mkdir(dir, { recursive: true })
  const name = `${Date.now()}-${randomBytes(6).toString('hex')}.png`
  // 原子写：先落 tmp 再 rename，避免读取到半截文件
  const tmp = path.join(dir, `.${name}.tmp`)
  await fs.promises.writeFile(tmp, buf)
  try {
    await fs.promises.rename(tmp, path.join(dir, name))
  } catch (err) {
    await fs.promises.rm(tmp, { force: true }).catch(() => undefined)
    throw err
  }
  return name
}
