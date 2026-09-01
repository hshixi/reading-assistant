import fs from 'node:fs'
import path from 'node:path'
import type { DataSource } from 'typeorm'
import { DEFAULT_AI_SETTINGS, SETTINGS_KEYS } from '@reading/shared'
import type { DbDriver } from './data-source'
import { AppSetting } from './entities'

/** 确保数据根目录存在（sqlite 文件、books、media、logs） */
export function ensureDataDirs(dataDir: string): void {
  for (const sub of ['', 'data', 'books', 'media', 'logs']) {
    fs.mkdirSync(path.join(dataDir, sub), { recursive: true })
  }
}

/**
 * 启动引导：SQLite 开启外键 → 种子默认配置。
 * 表结构由 synchronize（开发期）或发布前的 bootstrap DDL（M13+）创建。
 */
export async function bootstrapDb(dataSource: DataSource, driver: DbDriver): Promise<void> {
  if (driver === 'sqlite') {
    // SQLite 外键默认关闭，需每连接开启，否则 ON DELETE CASCADE 不生效
    await dataSource.query('PRAGMA foreign_keys = ON')
  }
  await seedDefaultSettings(dataSource, driver)
}

async function seedDefaultSettings(dataSource: DataSource, driver: DbDriver): Promise<void> {
  const repo = dataSource.getRepository(AppSetting)
  const defaults: Array<[string, string]> = [
    [SETTINGS_KEYS.AI_BASE_URL, DEFAULT_AI_SETTINGS.aiBaseUrl],
    [SETTINGS_KEYS.AI_MODEL, DEFAULT_AI_SETTINGS.aiModel],
    [SETTINGS_KEYS.AI_MAX_TOKENS, DEFAULT_AI_SETTINGS.aiMaxTokens],
    [SETTINGS_KEYS.AI_TEMPERATURE, DEFAULT_AI_SETTINGS.aiTemperature],
    [SETTINGS_KEYS.DB_MODE, driver],
    [SETTINGS_KEYS.SCHEMA_VERSION, '1'],
  ]
  for (const [key, value] of defaults) {
    const exists = await repo.findOneBy({ key })
    if (!exists) {
      const row = repo.create({ key, value })
      await repo.save(row)
    }
  }
}
