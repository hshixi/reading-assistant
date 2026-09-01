# ADR-004：后端打包（esbuild 单文件 + 原生模块独立随包）

- 日期：2026-09-01
- 状态：已接受

## 背景

electron-builder 打包 dmg 时，需把后端 Node 服务随包分发并以子进程运行。直接整包 `node_modules` 会显著膨胀体积，且原生模块（better-sqlite3）不能进 asar。

## 决策

- 后端用 **esbuild** 打包为单文件 `server.js`（`platform:node`、`bundle:true`、`external:['better-sqlite3']`），放在 `extraResources/backend`。
- `mysql2` 为纯 JS，直接 bundle 进单文件。
- `better-sqlite3` 预编译二进制（`darwin-arm64` / `darwin-x64`）随包放 `backend/native/`，运行时用 `module.createRequire` 指向该路径加载；`asarUnpack` 排除原生模块。
- 开发期仍用 `tsx watch` 直接跑 TS 源码（不经 esbuild）。

## 理由

- 控制 dmg 体积、避免 node_modules 全量随包。
- esbuild 对 ESM/CJS 混合依赖兼容好、打包快。
- 原生二进制必须避开 asar 读取路径（Chromium 的 asar 仅虚拟文件系统，原生加载器无法直接读），故 unpack + createRequire。

## 影响

- arm64 / x64 各出一个 dmg，native 对应架构。
- 后端代码保持无运行时动态 `require`（除原生模块外），保证 esbuild 可静态分析。
