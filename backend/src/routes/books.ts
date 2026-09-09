/**
 * 书籍模块路由（M4）：
 *  - POST   /api/books                     multipart 上传 PDF（流式落盘 + sha256）
 *  - GET    /api/books                     列表（createdAt desc）
 *  - GET    /api/books/:id                 详情
 *  - GET    /api/books/:id/file            Range 流式下载（206，pdf.js 按需加载必需）
 *  - GET    /api/books/:id/cover           PDF 首页封面 PNG（懒生成 + 磁盘缓存）
 *  - PATCH  /api/books/:id                 改标题/作者/阅读进度(lastPage)/总页数(pageCount)
 *  - DELETE /api/books/:id                 删除（DB 级联 → 文件目录清理）
 */
import { Router, type Request, type Response, type NextFunction } from 'express'
import multer from 'multer'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { Repository } from 'typeorm'
import { ApiPaths } from '@reading/shared'
import type { Book as BookDto } from '@reading/shared'
import { getRepository } from '../db'
import { Book, Note } from '../db/entities'
import { BookStore } from '../services/book-store'
import { countPdfPages } from '../services/page-count'
import { renderPdfCover } from '../services/cover'
import { ApiError } from '../middleware/error'
import type { AppContext } from '../app'

/** 实体 → DTO（日期统一 ISO 字符串；日期可能来自 Date 或字符串，兼容双驱动） */
function bookToDto(book: Book): BookDto {
  const iso = (v: Date | string | null | undefined): string | null =>
    v == null ? null : v instanceof Date ? v.toISOString() : String(v)
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    fileName: book.fileName,
    fileSize: Number(book.fileSize),
    mimeType: book.mimeType,
    pageCount: book.pageCount,
    sha256: book.sha256,
    lastPage: book.lastPage == null ? null : Number(book.lastPage),
    lastOpenedAt: iso(book.lastOpenedAt),
    createdAt: iso(book.createdAt)!,
    updatedAt: iso(book.updatedAt)!,
  }
}

/** V2.5：统计每本书的笔记条数（书架卡片展示）。notes.book_id 有索引，量小两查无碍；
 * COUNT(*) 跨驱动（SQLite/MySQL）读回可能是字符串或数字，统一 Number() 兜底。 */
async function noteCountsByBook(bookIds: number[]): Promise<Map<number, number>> {
  const counts = new Map<number, number>()
  if (bookIds.length === 0) return counts
  const rows = await getRepository(Note)
    .createQueryBuilder('n')
    .select('n.bookId', 'book_id')
    .addSelect('COUNT(*)', 'cnt')
    .where('n.bookId IN (:...ids)', { ids: bookIds })
    .groupBy('n.bookId')
    .getRawMany<{ book_id: number | string; cnt: string | number }>()
  for (const row of rows) counts.set(Number(row.book_id), Number(row.cnt))
  return counts
}

async function loadBookOr404(repo: Repository<Book>, id: number): Promise<Book> {
  const book = await repo.findOneBy({ id })
  if (!book) throw new ApiError(404, 'BOOK_NOT_FOUND', '书籍不存在')
  return book
}

export function createBooksRouter(context: AppContext): Router {
  const router = Router()
  const store = new BookStore(context.config.dataDir)
  const uploadDir = path.join(context.config.dataDir, 'books', '.tmp')

  // 上传流式落盘到临时目录；入库拿到 id 后 rename 到 books/{id}/original.pdf
  const upload = multer({
    // V2.1-P4：busboy 默认 defParamCharset=latin1，会把 UTF-8 的 filename 解成乱码
    // （「机器学习.pdf」→「æºå¨å¦ä¹ .pdf」）。显式 UTF-8 使 title/fileName 落库正确。
    defParamCharset: 'utf8',
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        fs.mkdirSync(uploadDir, { recursive: true })
        cb(null, uploadDir)
      },
      filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.pdf`),
    }),
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB 上限
    fileFilter: (_req, file, cb) => {
      if (/\.pdf$/i.test(file.originalname) || file.mimetype === 'application/pdf') {
        cb(null, true)
      } else {
        cb(new ApiError(400, 'INVALID_FILE_TYPE', '仅支持 PDF 文件'))
      }
    },
  })

  // POST /api/books —— 上传
  router.post(ApiPaths.books, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file
      if (!file) throw new ApiError(400, 'MISSING_FILE', '缺少文件字段 file')

      const { sha256, size } = await store.hashFile(file.path)
      const repo = getRepository(Book)
      const book = repo.create({
        title: file.originalname.replace(/\.pdf$/i, '') || '未命名书籍',
        fileName: file.originalname,
        fileRelPath: store.relPath(0), // 占位，拿到 id 后回写
        fileSize: size,
        mimeType: file.mimetype || 'application/pdf',
        pageCount: null,
        sha256,
      })
      const saved = await repo.save(book)
      saved.fileRelPath = store.relPath(saved.id)
      await repo.save(saved)

      // 正式落盘：临时文件 → books/{id}/original.pdf
      await store.commit(saved.id, file.path)

      // 后台解析页数（不阻塞上传响应；失败仅告警，pageCount 保持 null）
      void countPdfPages(store.originalPath(saved.id))
        .then((pageCount) => repo.update(saved.id, { pageCount }))
        .catch((err) => console.warn('[books] page-count 解析失败：', err instanceof Error ? err.message : err))

      res.status(201).json(bookToDto(saved))
    } catch (err) {
      next(err)
    }
  })

  // GET /api/books —— 列表（V2.5：附带每本笔记数 noteCount）
  router.get(ApiPaths.books, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const books = await getRepository(Book).find({ order: { createdAt: 'DESC' } })
      const counts = await noteCountsByBook(books.map((b) => b.id))
      res.json(books.map((b) => ({ ...bookToDto(b), noteCount: counts.get(b.id) ?? 0 })))
    } catch (err) {
      next(err)
    }
  })

  // GET /api/books/:id —— 详情（V2.5：附带笔记数，书架 ensurePageCount 轮询会整体替换列表项）
  router.get(ApiPaths.book(':id'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const book = await loadBookOr404(getRepository(Book), Number(req.params.id))
      const counts = await noteCountsByBook([book.id])
      res.json({ ...bookToDto(book), noteCount: counts.get(book.id) ?? 0 })
    } catch (err) {
      next(err)
    }
  })

  // GET /api/books/:id/file —— Range 流式下载
  router.get(ApiPaths.bookFile(':id'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const book = await loadBookOr404(getRepository(Book), Number(req.params.id))
      const filePath = store.originalPath(book.id)
      if (!fs.existsSync(filePath)) throw new ApiError(404, 'FILE_MISSING', '文件缺失')

      const stat = await fs.promises.stat(filePath)
      res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader('Content-Type', book.mimeType ?? 'application/pdf')

      const range = req.headers.range
      if (range) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(range)
        if (m && (m[1] || m[2])) {
          const size = stat.size
          const start = m[1] ? Number(m[1]) : 0
          let end = m[2] ? Number(m[2]) : size - 1
          if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
            res.setHeader('Content-Range', `bytes */${size}`)
            res.status(416).end()
            return
          }
          end = Math.min(end, size - 1)
          res.status(206)
          res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
          res.setHeader('Content-Length', String(end - start + 1))
          fs.createReadStream(filePath, { start, end }).pipe(res)
          return
        }
      }

      res.setHeader('Content-Length', String(stat.size))
      fs.createReadStream(filePath).pipe(res)
    } catch (err) {
      next(err)
    }
  })

  // GET /api/books/:id/cover —— PDF 首页封面（懒生成 + 磁盘缓存；失败写哨兵防反复重试）
  router.get(ApiPaths.bookCover(':id'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repo = getRepository(Book)
      const book = await loadBookOr404(repo, Number(req.params.id))
      const coverPath = store.coverPath(book.id)
      const sentinel = `${coverPath}.failed`
      if (!fs.existsSync(coverPath) && !fs.existsSync(sentinel)) {
        const original = store.originalPath(book.id)
        if (!fs.existsSync(original)) throw new ApiError(404, 'FILE_MISSING', '文件缺失')
        try {
          await renderPdfCover(original, coverPath)
          fs.rmSync(sentinel, { force: true })
        } catch (err) {
          fs.writeFileSync(sentinel, String(Date.now()))
          console.warn(
            '[books] 封面生成失败 book=' + book.id + ':',
            err instanceof Error ? err.message : err,
          )
          throw new ApiError(422, 'COVER_GEN_FAILED', '封面生成失败')
        }
      }
      if (!fs.existsSync(coverPath)) {
        // 存在失败哨兵或封面仍缺失 → 前端占位图标（避免每次开书架反复尝试损坏文件）
        throw new ApiError(404, 'COVER_UNAVAILABLE', '封面不可用')
      }
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'public, max-age=86400')
      fs.createReadStream(coverPath).pipe(res)
    } catch (err) {
      next(err)
    }
  })

  // PATCH /api/books/:id —— 改标题/作者/阅读进度
  router.patch(ApiPaths.book(':id'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repo = getRepository(Book)
      const book = await loadBookOr404(repo, Number(req.params.id))
      const patch: Partial<Book> = {}
      if (typeof req.body?.title === 'string' && req.body.title.trim()) patch.title = req.body.title.trim()
      if ('author' in (req.body ?? {})) {
        patch.author = req.body.author === null ? null : String(req.body.author).trim()
      }
      // 阅读进度页：整数 ≥1 才写入；null 清除（前端退出/切书时调用）
      if ('lastPage' in (req.body ?? {})) {
        const v = req.body.lastPage
        patch.lastPage = v == null ? null : Number.isInteger(v) && v >= 1 ? Math.min(v, 100_000) : book.lastPage
      }
      // 总页数回填：阅读器读到 numPages 且 DB 仍 null 时写回；整数 ≥1 才写入
      if ('pageCount' in (req.body ?? {})) {
        const v = req.body.pageCount
        patch.pageCount = v == null ? null : Number.isInteger(v) && v >= 1 ? Math.min(v, 100_000) : book.pageCount
      }
      if (Object.keys(patch).length > 0) {
        repo.merge(book, patch)
        await repo.save(book)
      }
      res.json(bookToDto(book))
    } catch (err) {
      next(err)
    }
  })

  // DELETE /api/books/:id —— 删除（DB 级联 → 文件目录）
  router.delete(ApiPaths.book(':id'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repo = getRepository(Book)
      await loadBookOr404(repo, Number(req.params.id))
      await repo.delete({ id: Number(req.params.id) }) // chat_sessions/messages/notes/highlights/annotations 级联删除
      try {
        store.removeBook(Number(req.params.id))
      } catch (err) {
        // 文件残留由启动清扫兜底，不阻断删除
        console.warn('[books] 删除文件目录失败：', err instanceof Error ? err.message : err)
      }
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  })

  return router
}
