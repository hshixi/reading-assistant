/**
 * Express 应用组装：中间件 + 路由挂载。
 * 各资源路由在对应里程碑逐个接入，路由文件挂到 /api 前缀下。
 */
import express from 'express'
import cors from 'cors'
import fs from 'node:fs'
import path from 'node:path'
import type { DataSource } from 'typeorm'
import { API_PREFIX, ApiPaths } from '@reading/shared'
import { errorHandler, notFound } from './middleware/error'
import { safeWasmFile } from './services/pdfjs-assets'
import { createBooksRouter } from './routes/books'
import { createSessionsRouter } from './routes/sessions'
import { createChatRouter } from './routes/chat'
import { createAnnotationsRouter, createHighlightsRouter, createNotesRouter } from './routes/marks'
import { createSettingsRouter } from './routes/settings'
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

  // M11: 笔记 / 高亮 / 注释
  api.use(createNotesRouter())
  api.use(createHighlightsRouter())
  api.use(createAnnotationsRouter())

  // M12: 设置（AI 配置读写，DB 实时生效）
  api.use(createSettingsRouter(context))

  app.use(API_PREFIX, api)

  // 渲染层 pdf.js wasm 解码器资源（JBIG2/JPEG2000/ICC）。渲染层 origin 为 file://，
  // 无法直接 fetch file://，统一经 http://127.0.0.1 提供；CORS 已在顶部放开。
  // 路径形如 GET /pdfjs/wasm/jbig2.wasm（pdf.js 用 wasmUrl 拼文件名请求）。
  app.get('/pdfjs/wasm/:file', (req, res, next) => {
    try {
      const fp = safeWasmFile(req.params.file ?? '')
      if (!fp) {
        res.status(404).json({ error: { code: 'WASM_NOT_FOUND', message: '资源不存在' } })
        return
      }
      const ext = path.extname(fp).toLowerCase()
      res.setHeader(
        'Content-Type',
        ext === '.wasm' ? 'application/wasm' : ext === '.js' ? 'text/javascript' : 'application/octet-stream',
      )
      res.setHeader('Cache-Control', 'public, max-age=86400')
      fs.createReadStream(fp).pipe(res)
    } catch (err) {
      next(err)
    }
  })

  app.use(notFound)
  app.use(errorHandler)

  return app
}
