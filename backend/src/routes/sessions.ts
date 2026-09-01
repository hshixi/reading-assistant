/**
 * 会话与消息路由（M8）：
 *  - GET   /api/books/:bookId/sessions            会话列表（含消息数，updatedAt desc）
 *  - POST  /api/books/:bookId/sessions            新建会话
 *  - GET   /api/sessions/:id                      会话详情
 *  - PATCH /api/sessions/:id                      改标题
 *  - DELETE /api/sessions/:id                     删除（消息级联）
 *  - GET   /api/sessions/:id/messages?before=&limit=   分页消息（before 为 createdAt ISO，含 before 之前）
 *  - POST  /api/sessions/:id/messages             直接插入一条消息（测试/辅助用）
 */
import { Router, type Request, type Response, type NextFunction } from 'express'
import { LessThan } from 'typeorm'
import type { FindOptionsWhere, Repository } from 'typeorm'
import { ApiPaths } from '@reading/shared'
import type { ChatMessage as MessageDto, ChatSession as SessionDto } from '@reading/shared'
import { getRepository } from '../db'
import { ChatMessage, ChatSession } from '../db/entities'
import { ApiError } from '../middleware/error'
import type { AppContext } from '../app'

const MAX_PAGE = 50

function sessionToDto(session: ChatSession, messageCount?: number): SessionDto {
  return {
    id: session.id,
    bookId: session.bookId,
    title: session.title,
    messageCount,
    createdAt: (session.createdAt as Date).toISOString(),
    updatedAt: (session.updatedAt as Date).toISOString(),
  }
}

function messageToDto(m: ChatMessage): MessageDto {
  return {
    id: m.id,
    sessionId: m.sessionId,
    role: m.role,
    contentType: m.contentType,
    content: m.content ?? '',
    imageRelPath: m.imageRelPath,
    meta: m.meta,
    createdAt: (m.createdAt as Date).toISOString(),
  }
}

async function loadSessionOr404(repo: Repository<ChatSession>, id: number): Promise<ChatSession> {
  const session = await repo.findOneBy({ id })
  if (!session) throw new ApiError(404, 'SESSION_NOT_FOUND', '会话不存在')
  return session
}

export function createSessionsRouter(_context: AppContext): Router {
  const router = Router()

  // GET /api/books/:bookId/sessions
  router.get(
    ApiPaths.sessionsForBook(':bookId'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const bookId = Number(req.params.bookId)
        const sessions = await getRepository(ChatSession).find({
          where: { bookId },
          order: { updatedAt: 'DESC' },
        })
        const counts = await getRepository(ChatMessage)
          .createQueryBuilder('m')
          .select('m.session_id', 'sessionId')
          .addSelect('COUNT(*)', 'cnt')
          .where('m.session_id IN (:...ids)', { ids: sessions.map((s) => s.id) })
          .groupBy('m.session_id')
          .getRawMany<{ sessionId: number; cnt: string }>()
        const countMap = new Map(counts.map((c) => [Number(c.sessionId), Number(c.cnt)]))
        res.json(
          sessions.map((s) =>
            sessionToDto(s, countMap.get(s.id) ?? 0),
          ),
        )
      } catch (err) {
        next(err)
      }
    },
  )

  // POST /api/books/:bookId/sessions
  router.post(
    ApiPaths.sessionsForBook(':bookId'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const bookId = Number(req.params.bookId)
        const title =
          typeof req.body?.title === 'string' && req.body.title.trim()
            ? req.body.title.trim()
            : '新对话'
        const session = await getRepository(ChatSession).save(
          getRepository(ChatSession).create({ bookId, title }),
        )
        res.status(201).json(sessionToDto(session, 0))
      } catch (err) {
        next(err)
      }
    },
  )

  // GET /api/sessions/:id
  router.get(ApiPaths.session(':id'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await loadSessionOr404(getRepository(ChatSession), Number(req.params.id))
      res.json(sessionToDto(session))
    } catch (err) {
      next(err)
    }
  })

  // PATCH /api/sessions/:id
  router.patch(ApiPaths.session(':id'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repo = getRepository(ChatSession)
      const session = await loadSessionOr404(repo, Number(req.params.id))
      if (typeof req.body?.title === 'string' && req.body.title.trim()) {
        repo.merge(session, { title: req.body.title.trim() })
        await repo.save(session)
      }
      res.json(sessionToDto(session))
    } catch (err) {
      next(err)
    }
  })

  // DELETE /api/sessions/:id
  router.delete(
    ApiPaths.session(':id'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const repo = getRepository(ChatSession)
        await loadSessionOr404(repo, Number(req.params.id))
        await repo.delete({ id: Number(req.params.id) })
        res.status(204).end()
      } catch (err) {
        next(err)
      }
    },
  )

  // GET /api/sessions/:id/messages?before=&limit=
  router.get(
    ApiPaths.messages(':id'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionId = Number(req.params.id)
        await loadSessionOr404(getRepository(ChatSession), sessionId)
        const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), MAX_PAGE)
        const before = req.query.before
        const where: FindOptionsWhere<ChatMessage> = { sessionId }
        if (typeof before === 'string' && before) {
          // createdAt 列是 Date，用 Date 对象比较，避免 FindOperator<Date> 类型失配
          where.createdAt = LessThan(new Date(before))
        }
        const rows = await getRepository(ChatMessage).find({
          where,
          order: { createdAt: 'DESC' },
          take: limit,
        })
        // 返回升序（旧→新），便于前端直接渲染
        res.json(rows.reverse().map(messageToDto))
      } catch (err) {
        next(err)
      }
    },
  )

  // POST /api/sessions/:id/messages —— 直接插入一条消息（测试/快捷辅助用）
  router.post(
    ApiPaths.messages(':id'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const sessionId = Number(req.params.id)
        await loadSessionOr404(getRepository(ChatSession), sessionId)
        const { role, content, contentType, meta } = req.body ?? {}
        if (role !== 'user' && role !== 'assistant') {
          throw new ApiError(400, 'BAD_ROLE', 'role 必须为 user | assistant')
        }
        if (typeof content !== 'string') {
          throw new ApiError(400, 'BAD_CONTENT', 'content 必须为字符串')
        }
        const msg = await getRepository(ChatMessage).save(
          getRepository(ChatMessage).create({
            sessionId,
            role,
            content,
            contentType: contentType ?? 'text',
            meta: meta ?? null,
          }),
        )
        res.status(201).json(messageToDto(msg))
      } catch (err) {
        next(err)
      }
    },
  )

  return router
}
