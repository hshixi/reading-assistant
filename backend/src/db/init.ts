import type { DataSource } from 'typeorm'
import type { AppConfig } from '../config'
import { bootstrapDb, ensureDataDirs } from './bootstrap'
import { mysqlDataSource, sqliteDataSource, type DbDriver } from './data-source'

export interface DbInitResult {
  dataSource: DataSource
  driver: DbDriver
  /** mysql 不可用时自动降级 sqlite */
  fallback: boolean
}

let _dataSource: DataSource | null = null
let _driver: DbDriver = 'sqlite'
let _fallback = false

export function getDataSource(): DataSource {
  if (!_dataSource) throw new Error('数据库尚未初始化')
  return _dataSource
}

export function getDbDriver(): DbDriver {
  return _driver
}

export function isFallback(): boolean {
  return _fallback
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * 初始化数据库：
 * - driver=sqlite：直接 SQLite
 * - driver=mysql：连接 MySQL，失败则报错
 * - driver=auto：先试 MySQL，失败自动降级 SQLite（写降级标记）
 */
export async function initDatabase(config: AppConfig): Promise<DbInitResult> {
  ensureDataDirs(config.dataDir)

  if (config.dbDriver === 'mysql' || config.dbDriver === 'auto') {
    try {
      const ds = mysqlDataSource(config)
      await ds.initialize()
      _dataSource = ds
      _driver = 'mysql'
      _fallback = false
    } catch (err) {
      if (config.dbDriver === 'mysql') {
        throw new Error(`MySQL 连接失败：${errMessage(err)}（请检查连接配置，或改用 DATABASE_DRIVER=sqlite）`)
      }
      // auto 模式降级
      console.warn(`[db] MySQL 不可用（${errMessage(err)}），自动降级为 SQLite`)
      const ds = sqliteDataSource(config)
      await ds.initialize()
      _dataSource = ds
      _driver = 'sqlite'
      _fallback = true
    }
  } else {
    const ds = sqliteDataSource(config)
    await ds.initialize()
    _dataSource = ds
    _driver = 'sqlite'
    _fallback = false
  }

  await bootstrapDb(_dataSource, _driver)
  return { dataSource: _dataSource, driver: _driver, fallback: _fallback }
}
