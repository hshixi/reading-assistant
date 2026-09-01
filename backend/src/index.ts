/**
 * 后端入口：读取配置 → 初始化数据库(M3) → 监听端口。
 * 生产环境由 Electron 主进程以 ELECTRON_RUN_AS_NODE 拉起，监听动态端口（见 M13）。
 */
import { loadConfig } from './config'
import { createApp } from './app'

async function main(): Promise<void> {
  const config = loadConfig()
  const app = createApp(config)

  app.listen(config.port, config.host, () => {
    console.log(`[backend] listening on http://${config.host}:${config.port}`)
    console.log(`[backend] dbDriver=${config.dbDriver} dataDir=${config.dataDir}`)
  })
}

main().catch((err) => {
  console.error('[backend] fatal:', err)
  process.exit(1)
})
