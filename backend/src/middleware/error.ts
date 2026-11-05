/**
 * 统一错误处理中间件。错误响应格式：{ error: { code, message } }
 */
import type { NextFunction, Request, Response } from 'express'
import type { ApiErrorBody } from '@reading/shared'
import { redactError } from '../utils/redact'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function notFound(_req: Request, res: Response): void {
  const body: ApiErrorBody = { error: { code: 'NOT_FOUND', message: '资源不存在' } }
  res.status(404).json(body)
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    const body: ApiErrorBody = { error: { code: err.code, message: err.message } }
    res.status(err.status).json(body)
    return
  }

  // Express body-parser 语法错误等
  const anyErr = err as { status?: number; type?: string; message?: string } | null
  if (anyErr?.type === 'entity.parse.failed') {
    const body: ApiErrorBody = { error: { code: 'BAD_JSON', message: '请求体不是合法 JSON' } }
    res.status(400).json(body)
    return
  }

  console.error('[error]', redactError(err))
  const body: ApiErrorBody = { error: { code: 'INTERNAL', message: '服务器内部错误' } }
  res.status(500).json(body)
}
