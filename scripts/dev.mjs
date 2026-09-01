/**
 * 开发模式编排：构建 shared → 并发启动 backend(8787) + vite(5173) + electron。
 * 任意子进程退出即终止全部。
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
}

function run(cmd, args, opts = {}, label = cmd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: rootDir, shell: false, stdio: 'pipe', ...opts })
    const prefix = PREFIX[label] ?? ''
    const pipe = (stream, fn) => {
      let buf = ''
      stream.on('data', (d) => {
        buf += d.toString()
        let i
        while ((i = buf.indexOf('\n')) >= 0) {
          fn(buf.slice(0, i))
          buf = buf.slice(i + 1)
        }
      })
    }
    pipe(child.stdout, (line) => process.stdout.write(prefix + line + '\n'))
    pipe(child.stderr, (line) => process.stderr.write(prefix + line + '\n'))
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code !== 0) reject(new Error(`${cmd} exited with code ${code}`))
      else resolve()
    })
  })
}

async function main() {
  console.log(PREFIX.shared + 'building @reading/shared…')
  await run('npm', ['run', 'build', '-w', '@reading/shared'], {}, 'shared')
  console.log(PREFIX.shared + 'shared built')

  const children = [
    run('npm', ['run', 'dev', '-w', '@reading/backend'], {}, 'backend'),
    run('npm', ['run', 'dev', '-w', '@reading/frontend'], {}, 'vite'),
    run('npm', ['run', 'dev', '-w', '@reading/electron'], {}, 'electron'),
  ]

  // 任一子进程失败/退出即终止所有
  Promise.any(children.map((p) => p.catch((e) => { throw e }))).catch((err) => {
    console.error(color(31, '\n[dev] ' + err.message))
    process.exit(1)
  })
}

main()
