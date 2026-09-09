/**
 * 笔记 / 高亮 / 注释 CRUD（M11）。
 * 三张表结构对称，各一个 Router：
 *   GET/POST   /api/books/:bookId/{notes|highlights|annotations}
 *   GET/PATCH/DELETE /api/{notes|highlights|annotations}/:id
 * rect 为归一化矩形（0–1），前端框选精确给定；高亮/注释坐标不由模型生成。
 */
import { Router, type Request, type Response, type NextFunction } from 'express'
import { ApiPaths } from '@reading/shared'
import type {
  Annotation as AnnotationDto,
  Highlight as HighlightDto,
  Note as NoteDto,
  Rect,
} from '@reading/shared'
import { getRepository } from '../db'
import { Annotation, Book, Highlight, Note } from '../db/entities'
import { ApiError } from '../middleware/error'

/* ---------- DTO 转换 ---------- */

/**
 * V2：把 DB 里 `rect` 列读到任意形态的值归一化为行盒数组。
 * V1 存单对象 {x,y,width,height} → 包成单元素数组；已有数组直接过；null/undefined → 兜底。
 */
function normalizeRects(v: unknown, fallback: Rect[] | null = null): Rect[] | null {
  if (Array.isArray(v)) return v as Rect[]
  if (v && typeof v === 'object' && isRectLike(v)) return [v as Rect]
  return fallback
}

function isRectLike(v: unknown): boolean {
  const r = v as Record<string, unknown>
  return (
    typeof r.x === 'number' &&
    typeof r.y === 'number' &&
    typeof r.width === 'number' &&
    typeof r.height === 'number'
  )
}

function noteToDto(n: Note): NoteDto {
  return {
    id: n.id,
    bookId: n.bookId,
    sessionId: n.sessionId,
    content: n.content,
    excerptText: n.excerptText ?? null,
    pageNumber: n.pageNumber,
    rects: normalizeRects(n.rects),
    screenshotRelPath: n.screenshotRelPath,
    createdAt: (n.createdAt as Date).toISOString(),
    updatedAt: (n.updatedAt as Date).toISOString(),
  }
}

function highlightToDto(h: Highlight): HighlightDto {
  return {
    id: h.id,
    bookId: h.bookId,
    pageNumber: h.pageNumber,
    rects: normalizeRects(h.rects, []) ?? [],
    color: h.color,
    excerptText: h.excerptText,
    screenshotRelPath: h.screenshotRelPath,
    noteId: h.noteId,
    createdAt: (h.createdAt as Date).toISOString(),
  }
}

function annotationToDto(a: Annotation): AnnotationDto {
  return {
    id: a.id,
    bookId: a.bookId,
    pageNumber: a.pageNumber,
    rect: a.rect,
    text: a.text ?? '',
    annotationType: a.annotationType,
    createdAt: (a.createdAt as Date).toISOString(),
    updatedAt: (a.updatedAt as Date).toISOString(),
  }
}

/* ---------- 工具 ---------- */

function numOr(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

/** 从请求体解析归一化矩形（注释仍用单 rect）；null=缺省、undefined=非法 */
function rectFromBody(v: unknown): Rect | null | undefined {
  if (v == null) return null
  const r = v as Partial<Rect>
  if (
    typeof r.x === 'number' &&
    typeof r.y === 'number' &&
    typeof r.width === 'number' &&
    typeof r.height === 'number'
  ) {
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  }
  return undefined
}

/**
 * V2：从请求体解析归一化行盒数组；null=缺省、undefined=非法。
 * 接受数组，也兼容单个对象（V1 客户端）→ 包成单元素数组。
 */
function rectsFromBody(v: unknown): Rect[] | null | undefined {
  if (v == null) return null
  const arr = Array.isArray(v) ? v : [v]
  const out: Rect[] = []
  for (const item of arr) {
    const r = item as Partial<Rect>
    if (
      typeof r.x !== 'number' ||
      typeof r.y !== 'number' ||
      typeof r.width !== 'number' ||
      typeof r.height !== 'number'
    ) {
      return undefined
    }
    out.push({ x: r.x, y: r.y, width: r.width, height: r.height })
  }
  return out
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** 校验 bookId 对应书籍存在 */
async function assertBook(bookId: number): Promise<void> {
  const book = await getRepository(Book).findOneBy({ id: bookId })
  if (!book) throw new ApiError(404, 'BOOK_NOT_FOUND', '书籍不存在')
}

/* ---------- 笔记 ---------- */

export function createNotesRouter(): Router {
  const router = Router()

  router.get(
    ApiPaths.notesForBook(':bookId'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const bookId = numOr(req.params.bookId, 0)
        const rows = await getRepository(Note).find({
          where: { bookId },
          order: { createdAt: 'DESC' },
        })
        res.json(rows.map(noteToDto))
      } catch (err) {
        next(err)
      }
    },
  )

  router.post(
    ApiPaths.notesForBook(':bookId'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const bookId = numOr(req.params.bookId, 0)
        await assertBook(bookId)
        const content = strOrNull(req.body?.content)
        if (!content) throw new ApiError(400, 'BAD_NOTE', '笔记内容不能为空')
        const rects = rectsFromBody(req.body?.rects)
        if (rects === undefined) throw new ApiError(400, 'BAD_RECT', 'rects 格式非法')
        const note = await getRepository(Note).save(
          getRepository(Note).create({
            bookId,
            sessionId: req.body?.sessionId != null ? numOr(req.body.sessionId, 0) : null,
            content,
            excerptText: strOrNull(req.body?.excerptText),
            pageNumber: req.body?.pageNumber != null ? numOr(req.body.pageNumber, 0) : null,
            rects,
            screenshotRelPath: strOrNull(req.body?.screenshotRelPath),
          }),
        )
        res.status(201).json(noteToDto(note))
      } catch (err) {
        next(err)
      }
    },
  )

  router.get(ApiPaths.note(':id'), async (req, res, next) => {
    try {
      const note = await getRepository(Note).findOneBy({ id: numOr(req.params.id, 0) })
      if (!note) throw new ApiError(404, 'NOTE_NOT_FOUND', '笔记不存在')
      res.json(noteToDto(note))
    } catch (err) {
      next(err)
    }
  })

  router.patch(ApiPaths.note(':id'), async (req, res, next) => {
    try {
      const repo = getRepository(Note)
      const note = await repo.findOneBy({ id: numOr(req.params.id, 0) })
      if (!note) throw new ApiError(404, 'NOTE_NOT_FOUND', '笔记不存在')
      const patch: Partial<Note> = {}
      const content = strOrNull(req.body?.content)
      if (content) patch.content = content
      if (req.body?.pageNumber != null) patch.pageNumber = numOr(req.body.pageNumber, 0)
      const excerpt = strOrNull(req.body?.excerptText)
      if (req.body?.excerptText !== undefined) patch.excerptText = excerpt
      const rects = rectsFromBody(req.body?.rects)
      if (rects === undefined) throw new ApiError(400, 'BAD_RECT', 'rects 格式非法')
      if (rects !== null) patch.rects = rects
      repo.merge(note, patch)
      await repo.save(note)
      res.json(noteToDto(note))
    } catch (err) {
      next(err)
    }
  })

  router.delete(ApiPaths.note(':id'), async (req, res, next) => {
    try {
      const repo = getRepository(Note)
      const note = await repo.findOneBy({ id: numOr(req.params.id, 0) })
      if (!note) throw new ApiError(404, 'NOTE_NOT_FOUND', '笔记不存在')
      await repo.delete(note.id)
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  })

  return router
}

/* ---------- 高亮 ---------- */

export function createHighlightsRouter(): Router {
  const router = Router()

  router.get(
    ApiPaths.highlightsForBook(':bookId'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const bookId = numOr(req.params.bookId, 0)
        const rows = await getRepository(Highlight).find({
          where: { bookId },
          order: { pageNumber: 'ASC', id: 'ASC' },
        })
        res.json(rows.map(highlightToDto))
      } catch (err) {
        next(err)
      }
    },
  )

  router.post(
    ApiPaths.highlightsForBook(':bookId'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const bookId = numOr(req.params.bookId, 0)
        await assertBook(bookId)
        const rects = rectsFromBody(req.body?.rects)
        if (rects === undefined || !rects || rects.length === 0) {
          throw new ApiError(400, 'BAD_RECT', '高亮需要合法的 rects 行盒数组')
        }
        const pageNumber = numOr(req.body?.pageNumber, 0)
        if (pageNumber < 1) throw new ApiError(400, 'BAD_PAGE', 'pageNumber 必须为正整数')
        const highlight = await getRepository(Highlight).save(
          getRepository(Highlight).create({
            bookId,
            pageNumber,
            rects,
            color: typeof req.body?.color === 'string' ? req.body.color : 'yellow',
            excerptText: strOrNull(req.body?.excerptText),
            screenshotRelPath: strOrNull(req.body?.screenshotRelPath),
            noteId: req.body?.noteId != null ? numOr(req.body.noteId, 0) : null,
          }),
        )
        res.status(201).json(highlightToDto(highlight))
      } catch (err) {
        next(err)
      }
    },
  )

  router.get(ApiPaths.highlight(':id'), async (req, res, next) => {
    try {
      const h = await getRepository(Highlight).findOneBy({ id: numOr(req.params.id, 0) })
      if (!h) throw new ApiError(404, 'HIGHLIGHT_NOT_FOUND', '高亮不存在')
      res.json(highlightToDto(h))
    } catch (err) {
      next(err)
    }
  })

  router.patch(ApiPaths.highlight(':id'), async (req, res, next) => {
    try {
      const repo = getRepository(Highlight)
      const h = await repo.findOneBy({ id: numOr(req.params.id, 0) })
      if (!h) throw new ApiError(404, 'HIGHLIGHT_NOT_FOUND', '高亮不存在')
      const patch: Partial<Highlight> = {}
      if (req.body?.color != null) patch.color = String(req.body.color)
      const excerpt = strOrNull(req.body?.excerptText)
      if (req.body?.excerptText !== undefined) patch.excerptText = excerpt
      if (req.body?.screenshotRelPath !== undefined) {
        patch.screenshotRelPath = strOrNull(req.body.screenshotRelPath)
      }
      if (req.body?.pageNumber != null) patch.pageNumber = numOr(req.body.pageNumber, 0)
      const rects = rectsFromBody(req.body?.rects)
      if (rects === undefined) throw new ApiError(400, 'BAD_RECT', 'rects 格式非法')
      if (rects !== null) patch.rects = rects
      repo.merge(h, patch)
      await repo.save(h)
      res.json(highlightToDto(h))
    } catch (err) {
      next(err)
    }
  })

  router.delete(ApiPaths.highlight(':id'), async (req, res, next) => {
    try {
      const repo = getRepository(Highlight)
      const h = await repo.findOneBy({ id: numOr(req.params.id, 0) })
      if (!h) throw new ApiError(404, 'HIGHLIGHT_NOT_FOUND', '高亮不存在')
      await repo.delete(h.id)
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  })

  return router
}

/* ---------- 注释 ---------- */

export function createAnnotationsRouter(): Router {
  const router = Router()

  router.get(
    ApiPaths.annotationsForBook(':bookId'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const bookId = numOr(req.params.bookId, 0)
        const rows = await getRepository(Annotation).find({
          where: { bookId },
          order: { pageNumber: 'ASC', id: 'ASC' },
        })
        res.json(rows.map(annotationToDto))
      } catch (err) {
        next(err)
      }
    },
  )

  router.post(
    ApiPaths.annotationsForBook(':bookId'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const bookId = numOr(req.params.bookId, 0)
        await assertBook(bookId)
        const rect = rectFromBody(req.body?.rect)
        if (rect === undefined) throw new ApiError(400, 'BAD_RECT', 'rect 格式非法')
        const annotation = await getRepository(Annotation).save(
          getRepository(Annotation).create({
            bookId,
            pageNumber: numOr(req.body?.pageNumber, 0),
            rect,
            text: strOrNull(req.body?.text),
            annotationType: strOrNull(req.body?.annotationType) ?? 'sticky',
          }),
        )
        res.status(201).json(annotationToDto(annotation))
      } catch (err) {
        next(err)
      }
    },
  )

  router.get(ApiPaths.annotation(':id'), async (req, res, next) => {
    try {
      const a = await getRepository(Annotation).findOneBy({ id: numOr(req.params.id, 0) })
      if (!a) throw new ApiError(404, 'ANNOTATION_NOT_FOUND', '注释不存在')
      res.json(annotationToDto(a))
    } catch (err) {
      next(err)
    }
  })

  router.patch(ApiPaths.annotation(':id'), async (req, res, next) => {
    try {
      const repo = getRepository(Annotation)
      const a = await repo.findOneBy({ id: numOr(req.params.id, 0) })
      if (!a) throw new ApiError(404, 'ANNOTATION_NOT_FOUND', '注释不存在')
      const patch: Partial<Annotation> = {}
      if (req.body?.text !== undefined) patch.text = strOrNull(req.body.text)
      if (req.body?.annotationType != null) patch.annotationType = String(req.body.annotationType)
      const rect = rectFromBody(req.body?.rect)
      if (rect === undefined) throw new ApiError(400, 'BAD_RECT', 'rect 格式非法')
      if (rect !== null) patch.rect = rect
      repo.merge(a, patch)
      await repo.save(a)
      res.json(annotationToDto(a))
    } catch (err) {
      next(err)
    }
  })

  router.delete(ApiPaths.annotation(':id'), async (req, res, next) => {
    try {
      const repo = getRepository(Annotation)
      const a = await repo.findOneBy({ id: numOr(req.params.id, 0) })
      if (!a) throw new ApiError(404, 'ANNOTATION_NOT_FOUND', '注释不存在')
      await repo.delete(a.id)
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  })

  return router
}
