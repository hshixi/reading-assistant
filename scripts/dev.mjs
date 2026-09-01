/**
 * 开发模式编排：构建 shared → 并发启动 backend(8787) + vite(5173) + electron。
 * 任一子进程退出即终止全部；支持 Ctrl+C 优雅退出。
 *
 * 用法：npm run dev
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const color = (code, s) => `\x1b[${code}m${s}\x1b[0m`
const PREFIX = {
  backend: color(34, '[backend] '), // blue
  vite: color(35, '[vite] '), // magenta
  electron: color(36, '[electron] '), // cyan
  shared: color(33, '[shared] '), // yellow
  dev: color(32, '[dev] '), // green
}

const children = new Set()

function start(name, cmd, args, opts = {}) {
  // 防御：清除 ELECTRON_RUN_AS_NODE（用户 shell 可能已设置，会让 Electron 以纯 Node 模式运行、
  // 导致 require('electron').app 为 undefined、GUI 无法启动）。M13 显式设置它来跑后端不受影响。
  const childEnv = { ...process.env, ...opts.env }
  delete childEnv.ELECTRON_RUN_AS_NODE

  const child = spawn(cmd, args, {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: childEnv,
  })
  children.add(child)
  const prefix = PREFIX[name] ?? '[child] '

  child.stdout.on('data', (d) => {
    d.toString()
      .split('\n')
      .filter((l) => l.length > 0)
      .forEach((l) => process.stdout.write(prefix + l + '\n'))
  })
  child.stderr.on('data', (d) => {
    d.toString()
      .split('\n')
      .filter((l) => l.length > 0)
      .forEach((l) => process.stderr.write(prefix + l + '\n'))
  })

  child.on('exit', (code, signal) => {
    children.delete(child)
    console.error(PREFIX.dev + `${name} 退出（code=${code} signal=${signal}），终止全部子进程`)
    terminateAll()
  })
  return child
}

let terminating = false
function terminateAll() {
  if (terminating) return
  terminating = true
  for (const c of children) {
    try {
      c.kill('SIGTERM')
    } catch {
      /* already gone */
    }
  }
  // 2s 宽限期后强杀
  setTimeout(() => {
    for (const c of children) {
      try {
        c.kill('SIGKILL')
      } catch {
        /* already gone */
      }
    }
    process.exit(0)
  }, 2000).unref()
}

process.on('SIGINT', () => {
  console.log(PREFIX.dev + '收到 Ctrl+C，停止所有子进程…')
  terminateAll()
})
process.on('SIGTERM', terminateAll)

async function runOnce(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: rootDir, stdio: 'inherit', ...opts })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} 退出 code=${code}`))))
  })
}

async function main() {
  console.log(PREFIX.shared + '构建 @reading/shared…')
  await runOnce('npm', ['run', 'build', '-w', '@reading/shared'])
  console.log(PREFIX.shared + 'shared 构建完成')

  start('backend', 'npm', ['run', 'dev', '-w', '@reading/backend'])
  start('vite', 'npm', ['run', 'dev', '-w', '@reading/frontend'])
  start('electron', 'npm', ['run', 'dev', '-w', '@reading/electron'])

  console.log(PREFIX.dev + '三进程已启动（backend 8787 / vite 5173 / electron）')
}

main().catch((err) => {
  console.error(PREFIX.dev + err.message)
  process.exit(1)
})
