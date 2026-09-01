/**
 * AI 配置解析：app_settings 表优先，未配置时回退到 env / config 默认值。
 * 每次请求实时读取，因此设置页（M12）修改后可立即生效，无需重启。
 * 注意：API key 仅在后端使用，绝不进入日志或下发给渲染层。
 */
import type { DataSource } from 'typeorm'
import { SETTINGS_KEYS } from '@reading/shared'
import type { AppConfig } from '../config'
import { AppSetting } from '../db/entities'

export interface ResolvedAiSettings {
  baseUrl: string
  apiKey: string
  model: string
  maxTokens: number
  temperature: number
}

export async function getAiSettings(
  dataSource: DataSource,
  config: AppConfig,
): Promise<ResolvedAiSettings> {
  const repo = dataSource.getRepository(AppSetting)
  const rows = await repo.find()
  const map = new Map<string, string>(rows.map((r) => [r.key, r.value]))
  const get = (key: string, fallback: string): string => map.get(key) ?? fallback

  return {
    baseUrl: get(SETTINGS_KEYS.AI_BASE_URL, config.aiBaseUrl),
    apiKey: get(SETTINGS_KEYS.AI_API_KEY, config.aiApiKey),
    model: get(SETTINGS_KEYS.AI_MODEL, config.aiModel),
    maxTokens: Number(get(SETTINGS_KEYS.AI_MAX_TOKENS, String(config.aiMaxTokens))),
    temperature: Number(get(SETTINGS_KEYS.AI_TEMPERATURE, String(config.aiTemperature))),
  }
}
