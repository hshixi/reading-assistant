/**
 * 日志脱敏：错误对象可能携带数据库绑定参数/上游响应，禁止把 API key 等敏感值写进日志。
 * 只输出 name/message/stack 的文本形式，不展开 query/parameters 等字段。
 */
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bsk-[A-Za-z0-9_-]{8,}\b/g, 'sk-***'],
  [/\b(Bearer\s+)[A-Za-z0-9._-]{16,}\b/g, '$1***'],
]

export function redactError(err: unknown): string {
  const text = err instanceof Error ? err.stack ?? `${err.name}: ${err.message}` : String(err)
  return SECRET_PATTERNS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text)
}
