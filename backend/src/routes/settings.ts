/**
 * 设置路由（M12）：AI 配置读写 + 持久化到 app_settings。
 * 每次读写在 DB 实时进行，改配置后下一次聊天立即生效（无需重启）。
 *
 * 安全约束：API key 绝不下发渲染层 —— GET 只返回「是否已配置」；
 * PUT 时空 key 视为「保持不变」，避免覆盖已保存的 key。
 */
import { Router, type Request, type Response, type NextFunction } from 'express'
import { ApiPaths, SETTINGS_KEYS } from '@reading/shared'
import type { SettingsDto } from '@reading/shared'
import { getRepository } from '../db'
import { AppSetting } from '../db/entities'
import { ApiError } from '../middleware/error'
import type { AppContext } from '../app'

async function readSettingsMap(): Promise<Map<string, string>> {
  const rows = await getRepository(AppSetting).find()
  return new Map(rows.map((r) => [r.key, r.value]))
}

async function upsertSetting(key: string, value: string): Promise<void> {
  const repo = getRepository(AppSetting)
  const row = await repo.findOneBy({ key })
  if (row) {
    row.value = value
    await repo.save(row)
  } else {
    await repo.save(repo.create({ key, value }))
  }
}

async function buildDto(context: AppContext): Promise<SettingsDto> {
  const map = await readSettingsMap()
  const str = (key: string, fallback: string): string => map.get(key) ?? fallback
  return {
    aiBaseUrl: str(SETTINGS_KEYS.AI_BASE_URL, context.config.aiBaseUrl),
    aiModel: str(SETTINGS_KEYS.AI_MODEL, context.config.aiModel),
    aiMaxTokens: Number(str(SETTINGS_KEYS.AI_MAX_TOKENS, String(context.config.aiMaxTokens))),
    aiTemperature: Number(str(SETTINGS_KEYS.AI_TEMPERATURE, String(context.config.aiTemperature))),
    // 只暴露「是否已配置」，明文 key 永不进入响应
    aiApiKeySet: Boolean(map.get(SETTINGS_KEYS.AI_API_KEY)),
    dbMode: str(SETTINGS_KEYS.DB_MODE, context.config.dbDriver),
    schemaVersion: str(SETTINGS_KEYS.SCHEMA_VERSION, '1'),
  }
}

export function createSettingsRouter(context: AppContext): Router {
  const router = Router()

  router.get(ApiPaths.settings, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await buildDto(context))
    } catch (err) {
      next(err)
    }
  })

  router.put(ApiPaths.settings, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>
      const patches: Array<[string, string]> = []

      if (typeof body.aiBaseUrl === 'string' && body.aiBaseUrl.trim()) {
        patches.push([SETTINGS_KEYS.AI_BASE_URL, body.aiBaseUrl.trim()])
      }
      if (typeof body.aiModel === 'string' && body.aiModel.trim()) {
        patches.push([SETTINGS_KEYS.AI_MODEL, body.aiModel.trim()])
      }
      if (body.aiMaxTokens != null) {
        const n = Number(body.aiMaxTokens)
        if (!Number.isFinite(n) || n < 1 || n > 65536) {
          throw new ApiError(400, 'BAD_MAX_TOKENS', 'maxTokens 需为 1–65536 的整数')
        }
        patches.push([SETTINGS_KEYS.AI_MAX_TOKENS, String(Math.floor(n))])
      }
      if (body.aiTemperature != null) {
        const t = Number(body.aiTemperature)
        if (!Number.isFinite(t) || t < 0 || t > 2) {
          throw new ApiError(400, 'BAD_TEMPERATURE', 'temperature 需为 0–2 的数值')
        }
        patches.push([SETTINGS_KEYS.AI_TEMPERATURE, String(t)])
      }
      // key：非空才写入（空 = 保持不变）
      if (typeof body.aiApiKey === 'string' && body.aiApiKey.trim()) {
        patches.push([SETTINGS_KEYS.AI_API_KEY, body.aiApiKey.trim()])
      }

      for (const [key, value] of patches) await upsertSetting(key, value)

      res.json(await buildDto(context))
    } catch (err) {
      next(err)
    }
  })

  return router
}
