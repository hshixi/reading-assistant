import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// 开发模式：前端请求 /api 走 Vite proxy 转发到后端固定端口 8787，规避 CORS。
const BACKEND_PORT = Number(process.env.BACKEND_PORT ?? 8787)

export default defineConfig({
  plugins: [vue()],
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
