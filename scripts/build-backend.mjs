/**
 * M13/M14：把后端打成单文件 server.js（Electron prod 模式下由主进程以真实 node 拉起）。
 *
 * 打包策略：
 *  - bundle:true 内联 TypeORM/express/mysql2/reflect-metadata 等纯 JS 依赖
 *    （mysql2 纯 JS，bundled 后 MySQL 模式无需随包携带 node_modules）。
 *  - external better-sqlite3（原生模块）、pdfjs-dist（页数解析用 ESM 动态 import，
 *    运行时从应用目录 node_modules 解析）：
 *    M14 由 release 脚本把这两个依赖树拷进 extraResources/backend/node_modules。
 *
 * 输出：electron/dist-backend/server.js（源码级 prod 验证路径）；
 *       M14 release 脚本会将其拷贝到 extraResources/backend/server.js。
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
  external: ['better-sqlite3', 'pdfjs-dist'],
  banner: { js: '/* reading-assistant backend bundle (esbuild) */' },
  logLevel: 'info',
})

console.log('[build-backend] 完成：electron/dist-backend/server.js')
