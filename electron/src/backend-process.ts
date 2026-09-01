/**
 * 后端子进程管理（M13）：prod 模式下由主进程拉起、握手动态端口、退出清理。
 *
 * 运行时选择：后端用「真实 node 二进制」启动，而非 Electron 自带 node
 * （ELECTRON_RUN_AS_NODE）。原因：better-sqlite3 原生模块按系统 Node ABI 构建
 * （prebuilt），换 Electron ABI 需要能编译 Node24 头文件（C++20）的较新工具链，
 * 本机 clang14 无法编译。统一走 node 二进制即无 ABI 摩擦。
 *
 * node 解析顺序：
 *  0. 随 app 捆绑的 node（打包后位于 Resources/backend/node，extraResources）
 *  1. READING_APP_NODE_BIN 环境变量（显式覆盖）
 *  2. PATH 上的系统 node
 *  3. 兜底：process.execPath + ELECTRON_RUN_AS_NODE（需要 Electron ABI 原生模块，
 *     仅在无 node 且原生模块已按 Electron ABI 构建时可用）
 *
 * 流程：
 *  1. 清掉残留 backend.port 文件，spawn(nodeBin, [server.js], { PORT:0 })
 *  2. 后端监听 PORT=0 动态端口并写 {READING_APP_DATA_DIR}/backend.port
 *  3. 主进程轮询端口文件 → 轮询 /api/health → 就绪后经 IPC 提供给渲染层
 *  4. before-quit 时 SIGTERM 清理子进程
 *
 * 开发模式（bundle 不存在）：后端由 scripts/dev.mjs 外部启动（固定 8787），直接返回该端口。
 */
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { backendPortFile, userDataDir } from './paths'

const READY_TIMEOUT_MS = 20_000
const POLL_INTERVAL_MS = 100

let child: ChildProcess | null = null
let port: number | null = null
let readyPromise: Promise<number> | null = null

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** 打包后的后端单文件；开发模式下不存在 */
function backendBundlePath(): string | null {
  // 打包后：Resources/backend/server.js（extraResources，放在 asar 之外）
  const packaged = path.join(process.resourcesPath, 'backend', 'server.js')
  if (fs.existsSync(packaged)) return packaged
  // 源码级 prod 验证：electron/dist-backend/server.js
  const p = path.join(__dirname, '..', 'dist-backend', 'server.js')
  return fs.existsSync(p) ? p : null
}

/** 在 PATH 中查找可执行文件，找不到返回 null */
function findOnPath(name: string): string | null {
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', ''] : ['']
  for (const dir of dirs) {
    for (const ext of exts) {
      const p = path.join(dir, name + ext)
      if (fs.existsSync(p)) return p
    }
  }
  return null
}

async function waitForPortFile(): Promise<number> {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const text = fs.readFileSync(backendPortFile(), 'utf8').trim()
      const n = Number(text)
      if (Number.isInteger(n) && n > 0) return n
    } catch {
      /* 文件尚未写入 */
    }
    await sleep(POLL_INTERVAL_MS)
  }
  throw new Error('等待后端端口文件超时')
}

async function waitForHealth(p: number): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${p}/api/health`)
      if (res.ok) return
    } catch {
      /* 未就绪 */
    }
    await sleep(POLL_INTERVAL_MS)
  }
  throw new Error(`后端健康检查超时（端口 ${p}）`)
}

/** 解析启动后端的 node 命令与环境。 */
function resolveNodeLauncher(bundle: string): {
  cmd: string
  args: string[]
  env: NodeJS.ProcessEnv
} {
  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    READING_APP_DATA_DIR: userDataDir(),
    PORT: '0',
    HOST: '127.0.0.1',
    // 有 MySQL 用 MySQL，没有则自动降级 SQLite（init.ts 的 auto 逻辑，秒级快速失败）
    DATABASE_DRIVER: 'auto',
  }

  // 0) 随 app 捆绑的 node（打包后 Resources/backend/node）
  const bundledNode = path.join(process.resourcesPath, 'backend', 'node')
  if (fs.existsSync(bundledNode)) {
    return { cmd: bundledNode, args: [bundle], env: baseEnv }
  }

  // 1) 显式指定（M14 打包附带 node）
  const explicit = process.env.READING_APP_NODE_BIN
  if (explicit && fs.existsSync(explicit)) {
    return { cmd: explicit, args: [bundle], env: baseEnv }
  }

  // 2) PATH 上的系统 node
  const fromPath = findOnPath('node')
  if (fromPath) {
    return { cmd: fromPath, args: [bundle], env: baseEnv }
  }

  // 3) 兜底：Electron 自带 node（需 Electron ABI 原生模块）
  console.warn('[electron] 未找到 node 二进制，退回 Electron-as-node（需要 Electron ABI 原生模块）')
  return {
    cmd: process.execPath,
    args: [bundle],
    env: { ...baseEnv, ELECTRON_RUN_AS_NODE: '1' },
  }
}

/** 启动后端并等待就绪，返回端口。幂等：多次调用共用同一 Promise。 */
export function startBackend(): Promise<number> {
  if (readyPromise) return readyPromise
  readyPromise = (async () => {
    const bundle = backendBundlePath()
    if (!bundle) {
      // 开发模式：dev.mjs 已外部启动后端
      port = Number(process.env.BACKEND_PORT ?? 8787)
      console.log(`[electron] 开发模式，复用外部后端 :${port}`)
      return port
    }

    // 清掉上次残留，避免读到旧端口
    try {
      fs.rmSync(backendPortFile(), { force: true })
    } catch {
      /* 忽略 */
    }

    const { cmd, args, env } = resolveNodeLauncher(bundle)
    const proc = spawn(cmd, args, { env, stdio: ['ignore', 'pipe', 'pipe'] })
    child = proc
    proc.stdout?.on('data', (d) => process.stdout.write(`[backend] ${d}`))
    proc.stderr?.on('data', (d) => process.stderr.write(`[backend] ${d}`))
    proc.on('error', (err) => {
      console.error(`[electron] 后端进程启动失败: ${String(err)}`)
      child = null
    })
    proc.on('exit', (code, signal) => {
      console.error(`[electron] 后端进程退出 code=${code} signal=${signal}`)
      child = null
    })

    try {
      const p = await waitForPortFile()
      await waitForHealth(p)
      port = p
      console.log(`[electron] 后端就绪 http://127.0.0.1:${p}`)
      return p
    } catch (err) {
      child?.kill('SIGTERM')
      child = null
      throw err
    }
  })()
  return readyPromise
}

export function stopBackend(): void {
  if (child) {
    console.log('[electron] 停止后端进程')
    child.kill('SIGTERM')
    child = null
  }
}

export async function getBackendPort(): Promise<number> {
  if (port != null) return port
  return startBackend()
}
