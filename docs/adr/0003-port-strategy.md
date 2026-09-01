# ADR-003：本地端口策略（dev 固定 + proxy，prod 动态 + 握手文件）

- 日期：2026-09-01
- 状态：已接受

## 背景

前后端分离：Vue 前端（浏览器/Electron 渲染层）需访问本地 Node 后端。开发与生产加载方式不同（dev = Vite dev server，prod = file:// 静态资源 + 后端子进程）。

## 决策

- **dev**：后端固定 `127.0.0.1:8787`；前端 Vite dev server 通过 **proxy** 把 `/api` 转发到 8787，渲染层无跨域问题。
- **prod**：Electron 主进程以 `ELECTRON_RUN_AS_NODE` 拉起后端，后端监听 `127.0.0.1:0`（随机可用端口），把实际端口写入 `userData/backend.port`，主进程读文件后经 `backend:port` IPC 推给渲染层。

## 理由

- 避免与用户其他本地服务端口冲突。
- 后端只绑定 127.0.0.1，不在局域网暴露。
- dev 用 Vite proxy 完全规避 CORS；prod 渲染层 origin 为 `file://`（null），后端 CORS 放开 `*` 即可（本机服务、无 cookie）。

## 影响

- 前端 API 客户端统一封装 baseURL：`import.meta.env.DEV ? '/api'（走 vite proxy）: http://127.0.0.1:${port}/api`。
- Electron `ipc.ts` 提供 `app:getBackendPort`，M13 起读取握手文件。
