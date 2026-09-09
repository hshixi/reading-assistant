/**
 * 书籍文件系统存储：文件本体一律在 dataDir/books/{id}/original.pdf，
 * DB 只存元数据 + 相对路径（ADR-002）。
 *
 * 删除顺序约定：先删 DB（级联子表），后删文件；残留目录由启动时清扫兜底（见 M13）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

export class BookStore {
  private readonly booksDir: string

  /** dataDir 为数据根目录，书籍文件统一放 dataDir/books/ 下（与 relPath 一致） */
  constructor(dataDir: string) {
    this.booksDir = path.join(dataDir, 'books')
    fs.mkdirSync(this.booksDir, { recursive: true })
    this.sweepTemp()
  }

  /** books/{id}/original.pdf */
  originalPath(id: number): string {
    return path.join(this.booksDir, String(id), 'original.pdf')
  }

  /** books/{id}/cover.png —— PDF 首页封面缩略图（懒生成，随书删除清理） */
  coverPath(id: number): string {
    return path.join(this.booksDir, String(id), 'cover.png')
  }

  /** books/{id}/region —— V2.4 区域截图目录（扫描版框选留档，随书删除清理） */
  regionDir(id: number): string {
    return path.join(this.booksDir, String(id), 'region')
  }

  /** DB 中存盘的相对路径（相对 dataDir） */
  relPath(id: number): string {
    return `books/${id}/original.pdf`
  }

  /** 流式计算 sha256 + 文件大小（避免一次性读入内存） */
  hashFile(filePath: string): Promise<{ sha256: string; size: number }> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256')
      let size = 0
      const rs = fs.createReadStream(filePath)
      rs.on('data', (chunk) => {
        size += chunk.length
        hash.update(chunk)
      })
      rs.on('end', () => resolve({ sha256: hash.digest('hex'), size }))
      rs.on('error', reject)
    })
  }

  /** 上传完成后临时文件 → 正式位置 */
  async commit(id: number, tempFile: string): Promise<void> {
    const dir = path.join(this.booksDir, String(id))
    fs.mkdirSync(dir, { recursive: true })
    await fs.promises.rename(tempFile, this.originalPath(id))
  }

  /** 删除整本书目录（DB 已删除后调用） */
  removeBook(id: number): void {
    fs.rmSync(path.join(this.booksDir, String(id)), { recursive: true, force: true })
  }

  /** 清理中断上传残留的临时文件 */
  private sweepTemp(): void {
    const dir = path.join(this.booksDir, '.tmp')
    if (!fs.existsSync(dir)) return
    for (const name of fs.readdirSync(dir)) {
      fs.rmSync(path.join(dir, name), { recursive: true, force: true })
    }
  }
}
