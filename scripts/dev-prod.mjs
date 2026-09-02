#!/usr/bin/env node
/**
 * M15：源码级生产模式体验（带日志）。
 *
 * 与 `npm run dev` 的区别：
 *  - dev 走 vite dev server（http://localhost:5173）+ 外部后端(8787)
 *  - 本脚本走「生产路径」：esbuild 后端 bundle + file:// 加载前端 + 主进程拉起
 *    真实 node 后端子进程（动态端口握手）+ CSP，和打包后的 dmg 行为一致，
 *    但不用跑 release.mjs（省去 electron-builder 的 ~2 分钟）。
 *
 * 用法：
 *   npm run dev:prod                      # 构建 + 启动，带完整日志（ELECTRON_ENABLE_LOGGING=1）
 *   npm run dev:prod -- --no-build        # 跳过重新构建（已构建过时更快）
 *   npm run dev:prod -- --debug-port=9223 # 附带 CDP 远程调试端口（可用 /tmp/cdp-eval.mjs 检查）
 *   READING_APP_USER_DATA=/path npm run dev:prod   # 自定义数据目录
 *
 * 数据目录默认 `~/Library/Application Support/Reading Assistant (dev)`：
 *  - 与打包后应用的 userData（Reading Assistant）隔离，避免同时运行时 SQLite 互锁
 *  - 但跨本脚本多次运行共享，上传的 PDF / 会话 / 笔记会保留
 *
 * Ctrl+C / 子进程退出即终止；后端随主进程 before-quit 清理（退出后无孤儿进程）。
 */
import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const electronDir = path.join(rootDir, 'electron')

const args = process.argv.slice(2)
const skipBuild = args.includes('--no-build')
let debugPort = null
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--debug-port=')) debugPort = Number(args[i].slice('--debug-port='.length))
  else if (args[i] === '--debug-port') debugPort = Number(args[++i])
}

const color = (code, s) => `\x1b[${code}m${s}\x1b[0m`
const P = {
  build: color(33, '[build] '),
  electron: color(36, '[electron] '),
  dev: color(32, '[dev:prod] '),
}

function run(cmd) {
  console.log(`\n${P.build}$ ${cmd}`)
  execSync(cmd, { cwd: rootDir, stdio: 'inherit' })
}

// ---- 1. 构建（与 release.mjs 一致；--no-build 可跳过）----
if (!skipBuild) {
  run('npm run build:backend-bundle')
  run('npm run build:frontend')
  run('npm run build:electron')
  fs.rmSync(path.join(electronDir, 'dist-frontend'), { recursive: true, force: true })
  fs.cpSync(path.join(rootDir, 'frontend', 'dist'), path.join(electronDir, 'dist-frontend'), {
    recursive: true,
  })
  console.log(`${P.build}frontend/dist → electron/dist-frontend`)
}

// ---- 2. 启动（源码级 prod + 日志）----
const userData = process.env.READING_APP_USER_DATA ?? path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'Reading Assistant (dev)',
)
// monorepo 提升到根 node_modules；个别安装布局下也可能在 electron workspace 内
const ELECTRON_REL = ['dist', 'Electron.app', 'Contents', 'MacOS', 'Electron']
const electronCandidates = [
  path.join(rootDir, 'node_modules', 'electron', ...ELECTRON_REL),
  path.join(electronDir, 'node_modules', 'electron', ...ELECTRON_REL),
]
const electronBin = electronCandidates.find((p) => fs.existsSync(p))
const mainJs = path.join(electronDir, 'dist', 'main.js')

for (const p of [electronBin, mainJs]) {
  if (!fs.existsSync(p)) {
    console.error(`${P.dev}缺少 ${path.relative(rootDir, p)} —— 请先 npm install 或 npm run build:electron`)
    process.exit(1)
  }
}

const childArgs = [mainJs]
if (debugPort) childArgs.push(`--remote-debugging-port=${debugPort}`)

// 防御：清除 ELECTRON_RUN_AS_NODE（用户 shell 可能已设置）
const env = { ...process.env, READING_APP_PROD: '1', ELECTRON_ENABLE_LOGGING: '1', READING_APP_USER_DATA: userData }
delete env.ELECTRON_RUN_AS_NODE

console.log(`${P.dev}用户数据目录：${userData}`)
console.log(`${P.dev}后端 bundle：${path.relative(rootDir, path.join(electronDir, 'dist-backend', 'server.js'))}`)
if (debugPort) console.log(`${P.dev}CDP 调试端口：${debugPort}`)
console.log(`${P.dev}启动中（Ctrl+C 退出）…\n`)

const child = spawn(electronBin, childArgs, {
  cwd: rootDir,
  stdio: ['inherit', 'pipe', 'pipe'],
  env,
})

child.stdout.on('data', (d) => {
  d.toString()
    .split('\n')
    .filter((l) => l.length > 0)
    .forEach((l) => process.stdout.write(P.electron + l + '\n'))
})
child.stderr.on('data', (d) => {
  d.toString()
    .split('\n')
    .filter((l) => l.length > 0)
    .forEach((l) => process.stderr.write(P.electron + l + '\n'))
})

let quitting = false
function shutdown(sig) {
  if (quitting) return
  quitting = true
  console.log(`\n${P.dev}收到 ${sig}，退出 Electron…`)
  try {
    child.kill(sig === 'SIGINT' ? 'SIGINT' : 'SIGTERM')
  } catch {
    /* already gone */
  }
  setTimeout(() => process.exit(0), 1500).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

child.on('exit', (code, signal) => {
  // 后端由主进程 before-quit 清理；这里只需同步退出码
  console.log(`${P.dev}Electron 退出（code=${code} signal=${signal}）`)
  process.exit(code ?? 0)
})
