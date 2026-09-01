import path from 'node:path'
import { DataSource } from 'typeorm'
import type { AppConfig } from '../config'
import { entities } from './entities'

export type DbDriver = 'mysql' | 'sqlite'

/** 开发期用 synchronize 自动同步表结构；发布前冻结 schema 改用 bootstrap DDL + 版本管理。 */
const synchronize = process.env.DB_SYNCHRONIZE !== 'false'

/** MySQL DataSource（connectTimeout 短，保证 auto 探测时快速失败以触发降级） */
export function mysqlDataSource(config: AppConfig): DataSource {
  return new DataSource({
    type: 'mysql',
    host: config.dbHost,
    port: config.dbPort,
    username: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
    charset: 'utf8mb4',
    timezone: 'Z',
    connectTimeout: 3000,
    poolSize: 5,
    entities,
    synchronize,
  })
}

/** SQLite DataSource（数据库文件位于 dataDir/data/app.sqlite） */
export function sqliteDataSource(config: AppConfig): DataSource {
  return new DataSource({
    type: 'better-sqlite3',
    database: path.join(config.dataDir, 'data', 'app.sqlite'),
    entities,
    synchronize,
  })
}
