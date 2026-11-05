/**
 * 后端入口：加载配置 → 初始化数据库（MySQL/SQLite + auto 降级）→ 建表/种子 → 监听端口。
 * 生产环境由 Electron 主进程以 ELECTRON_RUN_AS_NODE 拉起，监听动态端口（PORT=0），
 * 并把实际端口写入 {dataDir}/backend.port 供主进程握手（见 M13）。
 */
import 'reflect-metadata'
import fs from 'node:fs'
import path from 'node:path'
import { loadConfig } from './config'
import { initDatabase } from './db'
import { createApp } from './app'
import { redactError } from './utils/redact'

async function main(): Promise<void> {
  const config = loadConfig()

  const { dataSource, driver, fallback } = await initDatabase(config)
  console.log(`[db] driver=${driver}${fallback ? '（自动降级）' : ''}`)

  const app = createApp({ config, dataSource })
  const server = app.listen(config.port, config.host, () => {
    const address = server.address()
    const actualPort =
      address && typeof address === 'object' ? address.port : config.port
    // 动态端口握手：主进程读 backend.port 后轮询 /api/health
    try {
      fs.writeFileSync(path.join(config.dataDir, 'backend.port'), String(actualPort))
    } catch (err) {
      console.error('[backend] 写端口文件失败:', redactError(err))
    }
    console.log(`[backend] listening on http://${config.host}:${actualPort}`)
    console.log(`[backend] dataDir=${config.dataDir}`)
  })
}

main().catch((err) => {
  console.error('[backend] fatal:', redactError(err))
  process.exit(1)
})
