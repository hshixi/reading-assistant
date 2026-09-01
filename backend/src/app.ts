/**
 * Express 应用组装：中间件 + 路由挂载。
 * 各资源路由在对应里程碑逐个接入，路由文件挂到 /api 前缀下。
 */
import express from 'express'
import cors from 'cors'
import { API_PREFIX, ApiPaths } from '@reading/shared'
import { errorHandler, notFound } from './middleware/error'
import type { AppConfig } from './config'

export function createApp(_config: AppConfig): express.Express {
  const app = express()

  app.disable('x-powered-by')
  app.use(cors({ origin: '*' }))
  app.use(express.json({ limit: '1mb' }))

  const api = express.Router()

  // 健康检查（Electron 主进程启动时轮询探测）
  api.get(ApiPaths.health, (_req, res) => {
    res.json({ ok: true, name: 'reading-assistant-backend', time: Date.now() })
  })

  // 后续里程碑在此挂载资源路由：api.use(booksRouter) 等

  app.use(API_PREFIX, api)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
