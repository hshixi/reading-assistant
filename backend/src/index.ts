/**
 * 后端入口：加载配置 → 初始化数据库（MySQL/SQLite + auto 降级）→ 建表/种子 → 监听端口。
 * 生产环境由 Electron 主进程以 ELECTRON_RUN_AS_NODE 拉起，监听动态端口（见 M13）。
 */
import 'reflect-metadata'
import { loadConfig } from './config'
import { initDatabase } from './db'
import { createApp } from './app'

async function main(): Promise<void> {
  const config = loadConfig()

  const { dataSource, driver, fallback } = await initDatabase(config)
  console.log(`[db] driver=${driver}${fallback ? '（自动降级）' : ''}`)

  const app = createApp({ config, dataSource })
  app.listen(config.port, config.host, () => {
    console.log(`[backend] listening on http://${config.host}:${config.port}`)
    console.log(`[backend] dataDir=${config.dataDir}`)
  })
}

main().catch((err) => {
  console.error('[backend] fatal:', err)
  process.exit(1)
})
