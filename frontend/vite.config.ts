import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// 开发模式：前端请求 /api 走 Vite proxy 转发到后端固定端口 8787，规避 CORS。
const BACKEND_PORT = Number(process.env.BACKEND_PORT ?? 8787)

// 生产 CSP（仅注入构建产物；dev 由 vite 注入内联脚本/HMR，保持无 CSP 避免破坏）。
// - script-src 'self' 'wasm-unsafe-eval'：打包产物为同源 file:// 资源；pdf.js 走主线程
//   fake worker（动态 import 同源 .mjs）。JBIG2/JPEG2000/ICC 解码 wasm 由后端
//   http://127.0.0.1:* 提供（connect-src 已放行下载），但 WebAssembly 编译/实例化受
//   script-src 约束，需 'wasm-unsafe-eval'（仅放行 wasm，不放行任意 eval）
// - connect-src http://127.0.0.1:*：后端动态端口 API + PDF Range 拉取 + pdf.js 解码 wasm
// - img-src data:：应用内框选截图；blob: 备选
// - style-src 'unsafe-inline'：Element Plus / Vue 运行时内联样式
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: http://127.0.0.1:*",
  "connect-src 'self' http://127.0.0.1:* ws://localhost:5173 ws://127.0.0.1:* blob:",
  "font-src 'self' data:",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-src 'none'",
].join('; ')

function cspPlugin(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      )
    },
  }
}

export default defineConfig({
  plugins: [vue(), cspPlugin()],
  // 生产打包由 Electron 以 file:// 加载，必须用相对路径否则资源 404
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // workspace 包直接走 TS 源码（ESM），规避 CJS 产物下 rollup 无法追踪命名导出的问题
      '@reading/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${BACKEND_PORT}`,
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    // pdf.js 大量使用 class 私有字段，esbuild 预打包会破坏它们导致 "Cannot read from private field"，
    // 走原生 ESM 源码不预打包
    exclude: ['pdfjs-dist'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
