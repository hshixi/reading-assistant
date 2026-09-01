/**
 * Express 应用组装：中间件 + 路由挂载。
 * 各资源路由在对应里程碑逐个接入，路由文件挂到 /api 前缀下。
 */
import express from 'express'
import cors from 'cors'
import type { DataSource } from 'typeorm'
import { API_PREFIX, ApiPaths } from '@reading/shared'
import { errorHandler, notFound } from './middleware/error'
import { createBooksRouter } from './routes/books'
import { createSessionsRouter } from './routes/sessions'
import { createChatRouter } from './routes/chat'
import type { AppConfig } from './config'

export interface AppContext {
  config: AppConfig
  dataSource: DataSource
}

export function createApp(context: AppContext): express.Express {
  const { dataSource } = context
  const app = express()

  app.disable('x-powered-by')
  // prod 下渲染层为 file://，pdf.js 跨源拉书需读 Range/Content-Range 等响应头
  app.use(
    cors({
      origin: '*',
      exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Disposition'],
    }),
  )
  app.use(express.json({ limit: '1mb' }))

  // 供路由按需取 DataSource / Repository，避免循环依赖
  app.locals.db = dataSource
  app.locals.config = context.config

  const api = express.Router()

  // 健康检查（Electron 主进程启动时轮询探测）
  api.get(ApiPaths.health, (_req, res) => {
    res.json({ ok: true, name: 'reading-assistant-backend', time: Date.now() })
  })

  // M4: 书籍模块
  api.use(createBooksRouter(context))

  // M8: 会话与消息 + 聊天流式
  api.use(createSessionsRouter(context))
  api.use(createChatRouter(context))

  app.use(API_PREFIX, api)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
