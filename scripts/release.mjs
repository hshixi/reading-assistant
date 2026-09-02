#!/usr/bin/env node
/**
 * M14：构建 dmg（生产发布）。
 *
 * 用法：
 *   node scripts/release.mjs                          # 仅宿主架构（本机 arm64）
 *   node scripts/release.mjs --arch=arm64 --arch=x64  # 双架构
 *   node scripts/release.mjs --node-binary=/path/to/node   # 用本地 node 二进制代替下载
 *
 * 流程：
 *  1. 构建 shared/后端 bundle/前端/electron；前端产物拷入 electron/dist-frontend
 *     （打包后从 asar 内 file:// 加载，见 electron/src/paths.ts）
 *  2. 按架构准备 extraResources/backend：
 *     - server.js（esbuild 单文件）
 *     - node 二进制（默认从 nodejs.org 下载 v24.16.0-darwin-<arch>，可用 --node-binary 覆盖）
 *     - node_modules/better-sqlite3（仅 lib+build/Release 原生二进制；跨架构时
 *       prebuild-install --arch 拉目标架构预编译）+ bindings + file-uri-to-path
 *     - node_modules/pdfjs-dist（裁剪为 package.json + legacy/build/pdf.mjs + pdf.worker.mjs
 *       页数解析入口，另带 wasm/ 供后端 /pdfjs/wasm/ 路由给渲染层 JBIG2 等解码）
 *  3. electron-builder --mac dmg（每架构一份，extraResources 指向对应资源目录）
 *
 * 后端以真实 node 运行（better-sqlite3 原生模块按系统 Node ABI 构建），
 * 因此 node 必须随包附带：GUI 启动的 PATH 不含 node。
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const electronDir = path.join(rootDir, 'electron')
const NODE_VERSION = 'v24.16.0' // 必须与 better-sqlite3 预编译 ABI 匹配（node ABI 137）

// ---- 参数解析 ----
const args = process.argv.slice(2)
let nodeBinaryOverride = null
const archs = new Set()
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a.startsWith('--node-binary=')) nodeBinaryOverride = a.slice('--node-binary='.length)
  else if (a === '--node-binary') nodeBinaryOverride = args[++i]
  else if (a.startsWith('--arch=')) a.slice('--arch='.length).split(',').forEach((x) => x && archs.add(x))
  else if (a === '--arch') archs.add(args[++i])
}
const targets = archs.size ? [...archs] : [os.arch()]
for (const t of targets) {
  if (!['arm64', 'x64'].includes(t)) {
    console.error(`不支持的架构: ${t}（仅 arm64|x64）`)
    process.exit(1)
  }
}

function run(cmd, cwd = rootDir) {
  console.log(`\n$ ${cmd}  [cwd=${path.relative(rootDir, cwd) || '.'}]`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}

// ---- 1. 构建各产物 ----
run('npm run build:backend-bundle')
run('npm run build:frontend')
run('npm run build:electron')

fs.rmSync(path.join(electronDir, 'dist-frontend'), { recursive: true, force: true })
fs.cpSync(path.join(rootDir, 'frontend', 'dist'), path.join(electronDir, 'dist-frontend'), {
  recursive: true,
})
console.log('\n[release] frontend/dist → electron/dist-frontend')

// ---- 2. per-arch 资源 ----
function downloadNode(arch) {
  const tgz = path.join(os.tmpdir(), `node-${NODE_VERSION}-darwin-${arch}.tar.gz`)
  const url = `https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-darwin-${arch}.tar.gz`
  if (fs.existsSync(tgz)) {
    console.log(`[release] 复用已下载 node 缓存: ${tgz}`)
  } else {
    console.log(`[release] 下载 node: ${url}`)
    run(`curl -sL --noproxy '*' -o "${tgz}" "${url}"`)
  }
  const exDir = path.join(os.tmpdir(), `node-extract-${arch}`)
  fs.rmSync(exDir, { recursive: true, force: true })
  fs.mkdirSync(exDir, { recursive: true })
  run(`tar -xzf "${tgz}" -C "${exDir}"`)
  return path.join(exDir, `node-${NODE_VERSION}-darwin-${arch}`, 'bin', 'node')
}

function prepareBackendResources(arch) {
  const out = path.join(rootDir, 'resources', arch, 'backend')
  fs.rmSync(path.join(rootDir, 'resources', arch), { recursive: true, force: true })
  const nm = path.join(out, 'node_modules')
  fs.mkdirSync(nm, { recursive: true })

  // server.js
  fs.copyFileSync(path.join(electronDir, 'dist-backend', 'server.js'), path.join(out, 'server.js'))

  // node 二进制
  const nodeBin = nodeBinaryOverride ?? downloadNode(arch)
  fs.copyFileSync(nodeBin, path.join(out, 'node'))
  fs.chmodSync(path.join(out, 'node'), 0o755)

  // better-sqlite3：只拷运行所需（package.json + lib + build/Release 原生二进制）
  const srcBs = path.join(rootDir, 'node_modules', 'better-sqlite3')
  const bsDir = path.join(nm, 'better-sqlite3')
  fs.mkdirSync(bsDir, { recursive: true })
  fs.copyFileSync(path.join(srcBs, 'package.json'), path.join(bsDir, 'package.json'))
  fs.cpSync(path.join(srcBs, 'lib'), path.join(bsDir, 'lib'), { recursive: true })
  fs.mkdirSync(path.join(bsDir, 'build', 'Release'), { recursive: true })
  if (arch === os.arch()) {
    fs.copyFileSync(
      path.join(srcBs, 'build', 'Release', 'better_sqlite3.node'),
      path.join(bsDir, 'build', 'Release', 'better_sqlite3.node'),
    )
  } else {
    // 跨架构：在副本中拉目标架构预编译二进制（无编译，纯下载）
    console.log(`[release] 为 ${arch} 拉取 better-sqlite3 预编译二进制`)
    run(`cd "${bsDir}" && npx prebuild-install --arch=${arch} --runtime=node`, rootDir)
  }

  // bindings + file-uri-to-path（better-sqlite3 运行时依赖）
  for (const dep of ['bindings', 'file-uri-to-path']) {
    fs.cpSync(path.join(rootDir, 'node_modules', dep), path.join(nm, dep), { recursive: true })
  }

  // pdfjs-dist 裁剪，后端运行时需要三样：
  //  - legacy/build/pdf.mjs + pdf.worker.mjs：页数解析入口。pdf.mjs 在 node 下走 fake
  //    worker，会按相对路径 import 同目录 pdf.worker.mjs —— 早期只带 pdf.mjs 导致
  //    打包版 countPdfPages 每次报「Cannot find module pdf.worker.mjs」而失败
  //    （书架卡片永远「解析中…」）。
  //  - wasm/：渲染层 pdf.js 的 JBIG2/JPEG2000/ICC 解码器（后端 /pdfjs/wasm/ 路由据此
  //    提供）。整目录拷贝（含 *_nowasm_fallback.js），裁剪注释与实现保持一致。
  const pdfSrc = path.join(rootDir, 'node_modules', 'pdfjs-dist')
  const pdfDir = path.join(nm, 'pdfjs-dist')
  fs.mkdirSync(path.join(pdfDir, 'legacy', 'build'), { recursive: true })
  fs.copyFileSync(path.join(pdfSrc, 'package.json'), path.join(pdfDir, 'package.json'))
  fs.copyFileSync(
    path.join(pdfSrc, 'legacy', 'build', 'pdf.mjs'),
    path.join(pdfDir, 'legacy', 'build', 'pdf.mjs'),
  )
  fs.copyFileSync(
    path.join(pdfSrc, 'legacy', 'build', 'pdf.worker.mjs'),
    path.join(pdfDir, 'legacy', 'build', 'pdf.worker.mjs'),
  )
  fs.cpSync(path.join(pdfSrc, 'wasm'), path.join(pdfDir, 'wasm'), { recursive: true })

  console.log(`[release] resources/${arch}/backend 就绪`)
}

// ---- 3. electron-builder（dir 出 .app → 注入 backend 资源 → --prepackaged 出 dmg）----
const PRODUCT_NAME = 'Reading Assistant'

function writeBuilderConfig(arch, extra) {
  const cfgPath = path.join(os.tmpdir(), `electron-builder-${arch}.json`)
  fs.writeFileSync(cfgPath, JSON.stringify(extra, null, 2))
  return cfgPath
}

// M15 图标：resources/icon.icns（scripts/make-icon.py 生成）
const ICON = path.join(rootDir, 'resources', 'icon.icns')

function buildDmg(arch) {
  prepareBackendResources(arch)

  // 3.1 构建 .app（files 显式只含 dist + dist-frontend，排除 node_modules，避免 asar 膨胀）
  const buildCfg = writeBuilderConfig(arch, {
    appId: 'com.readingassistant.desktop',
    productName: PRODUCT_NAME,
    directories: { output: '../release' },
    files: ['dist/**', 'dist-frontend/**', '!**/node_modules/**', '!dist-backend/**'],
    mac: {
      category: 'public.app-category.productivity',
      icon: ICON,
    },
    npmRebuild: false, // 原生模块以系统 Node ABI 随 node 走，不按 Electron ABI 重编译
  })
  console.log(`\n[release] 构建 ${arch} .app ...`)
  run(`npx electron-builder --mac dir --${arch} --config "${buildCfg}"`, electronDir)

  // 3.2 注入 backend 资源（extraResources 会过滤 node_modules，改为打包后手动拷贝）
  const appDir = path.join(rootDir, 'release', `mac-${arch}`, `${PRODUCT_NAME}.app`)
  const resBackend = path.join(appDir, 'Contents', 'Resources', 'backend')
  console.log(`[release] 注入 backend 资源 → ${path.relative(rootDir, resBackend)}`)
  fs.cpSync(path.join(rootDir, 'resources', arch, 'backend'), resBackend, { recursive: true })

  // 3.3 由现成 .app 出 dmg（--prepackaged 只打安装包，不再重新打包）
  const dmgCfg = writeBuilderConfig(arch, {
    appId: 'com.readingassistant.desktop',
    productName: PRODUCT_NAME,
    directories: { output: '../release' },
    mac: { category: 'public.app-category.productivity', icon: ICON },
    dmg: { icon: ICON },
  })
  console.log(`[release] 构建 ${arch} dmg ...`)
  run(`npx electron-builder --mac dmg --${arch} --prepackaged "${appDir}" --config "${dmgCfg}"`, electronDir)
}

for (const arch of targets) {
  buildDmg(arch)
}

console.log(`\n[release] 完成。产物位于 ${path.join(rootDir, 'release')}`)
