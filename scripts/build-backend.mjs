/**
 * M13：把后端打成单文件 server.js（Electron prod 模式下由主进程以
 * ELECTRON_RUN_AS_NODE 拉起，监听动态端口）。
 *
 * 打包策略：
 *  - bundle:true 内联 TypeORM/express/reflect-metadata 等纯 JS 依赖。
 *  - external better-sqlite3（原生模块）、mysql2（动态 require）、pdfjs-dist（体积大、动态 import ESM）：
 *    运行时从应用目录的 node_modules 解析；M14 electron-builder 用 extraResources 带入 + asarUnpack。
 *
 * 输出：electron/dist-backend/server.js（开发/验证路径；M14 迁到 extraResources/backend）。
 */
import { build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

await build({
  entryPoints: [path.join(rootDir, 'backend', 'src', 'index.ts')],
  outfile: path.join(rootDir, 'electron', 'dist-backend', 'server.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: false,
  minify: false,
  external: ['better-sqlite3', 'mysql2', 'pdfjs-dist'],
  banner: { js: '/* reading-assistant backend bundle (esbuild) */' },
  logLevel: 'info',
})

console.log('[build-backend] 完成：electron/dist-backend/server.js')
