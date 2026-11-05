# Reading Assistant（辅助阅读）

macOS 桌面阅读辅助应用：本地 PDF 阅读 + 右侧 AI 助手随读随问。

> 当前仓库只提供源码，暂不提供预编译 dmg。原因是构建产物尚未做 Developer ID 签名与公证，直接分发会被 macOS Gatekeeper 拦截；需要安装包可按「自行打包」在本地构建（本机运行不受影响），或等后续完成签名公证后再提供。

## 功能

- **阅读**：导入本地 PDF，应用内浏览，支持缩放 / 翻页 / 连续滚动。
- **AI 助手**：看不懂的段落「框选截图」发给 AI（默认 DeepSeek vision 模型），支持翻译 / 解释 / 摘抄笔记 / 高亮注释。
- **数据持久化**：书籍、会话、聊天记录、笔记、高亮、注释默认存本地 SQLite（零配置）；也可切 MySQL。
- **历史上下文**：重新打开同一本书，自动恢复历史聊天记录。
- **主题**：浅色 / 暗色切换，默认暗色。

## 系统要求

- macOS 13+
- Node.js 20+（开发 / 构建）
- 仅适配 macOS，Windows / Linux 未测试

## 快速开始

```bash
npm install
npm run dev
```

首次启动后，在「设置」页填入自己的 AI API Key。默认配置指向 DeepSeek 的 OpenAI 兼容接口：

- Base URL：`https://api.deepseek.com`
- Model：`deepseek-v4-flash-vision-exp`

如果该模型在你的账号下不可用，直接在设置页改成你账号可用的 vision 模型，或换成其他兼容 OpenAI Chat Completions 的服务商。应用需要模型支持图片输入和 SSE 流式返回。

> API Key 只保存在本机数据库的 `app_settings` 表，由后端读取，不会下发到渲染层，也不会写进仓库。请不要把 key 写进 `.env` 后提交。

## 技术栈

| 层 | 选型 |
|---|---|
| 壳 | Electron（electron-builder 打包 dmg） |
| 前端 | Vue 3 + Vite + TypeScript + Element Plus + Pinia |
| 后端 | Node.js + TypeScript + Express |
| 数据库 | SQLite（默认，零配置）/ MySQL（TypeORM，可选） |
| PDF | pdfjs-dist |
| AI | OpenAI 兼容 API（DeepSeek vision，流式 SSE） |

## 仓库结构（npm workspaces）

```
reading_assistant/
├── shared/     # 前后端共享 DTO 类型
├── backend/    # Express 后端（DB / AI / 文件存储）
├── frontend/   # Vue3 渲染层
├── electron/   # Electron 主进程 + preload
├── scripts/    # dev.mjs / build-backend.mjs / release.mjs / make-icon.py
├── resources/  # icon.icns（应用与 dmg 图标）
└── docs/       # plan.md（里程碑）、adr/
```

## 开发

```bash
npm install          # 安装所有 workspace 依赖
npm run dev          # 并发启动 vite + backend + electron（HMR 热更新）
npm run dev:prod     # 源码级生产模式：后端 bundle + file:// + CSP + 完整日志
```

> 后端环境变量见 `backend/.env.example`。开发默认 `DATABASE_DRIVER=sqlite` 无需安装 MySQL；改用 MySQL 需先启动本地 MySQL 并设置 `DATABASE_DRIVER=mysql` 及相关连接参数。

### `npm run dev:prod`（体验生产路径，无需打 dmg）

与打包后的 dmg 行为一致（真实 node 后端子进程、动态端口握手、file:// 加载、CSP），
但启动只要 ~10 秒，且输出完整日志（后端降级、端口、渲染层 console）。适合发布前
自己传 PDF 走完整流程。

```bash
npm run dev:prod                  # 构建 + 启动
npm run dev:prod -- --no-build    # 已构建过时跳过重新构建
npm run dev:prod -- --debug-port=9223   # 附带 CDP 调试端口
```

- 数据目录默认 `~/Library/Application Support/Reading Assistant (dev)`（与打包应用隔离，
  但跨多次运行保留上传的书籍/会话）；可用 `READING_APP_USER_DATA=/path` 覆盖。
- `Ctrl+C` 退出，后端随主进程清理，无孤儿进程。

## 自行打包（dmg）

```bash
python3 scripts/make-icon.py        # 重新生成 resources/icon.icns（依赖 Pillow）
node scripts/release.mjs            # 构建 arm64 dmg（本机架构）
node scripts/release.mjs --arch=arm64 --arch=x64   # 双架构
node scripts/release.mjs --node-binary=/path/to/node  # 用本地 node 二进制代替下载
```

产物输出到 `release/`。打包流程：esbuild 把后端 bundle 成单文件 `server.js` → electron-builder 出 `.app` → 手动注入 `Resources/backend/`（node 二进制 + better-sqlite3 原生模块 + 裁剪后的 pdfjs-dist）→ `--prepackaged` 出 dmg。细节见 `docs/plan.md`「M14 打包要点」。

> ⚠️ 当前脚本产出的 dmg **未签名、未公证**，只适合本机使用。对外分发需要 Apple Developer Program 的 Developer ID Application 证书，并对 app / dmg 做签名、公证和 staple；否则别人下载后会被 Gatekeeper 拦截。

## 架构决策要点

- **后端以真实 node 运行**（非 Electron 自带 node）：better-sqlite3 按系统 Node ABI 预编译，与随包附带、由 `release.mjs` 从 nodejs.org 下载的 node 二进制一致。GUI（Finder）启动的 PATH 不含 node，所以 node 必须随包。
- **数据库自动降级**：主进程以 `DATABASE_DRIVER=auto` 拉起后端 → 有 MySQL 用 MySQL，连接失败秒级退回内嵌 SQLite，设置页可见当前模式。
- **前端竞态防护**：渲染层先 `initApi()+checkHealth()` 握手拿到动态后端端口再渲染书架，失败显示重试。

## 安全设计

- **API Key 只存后端**：渲染层永不持有 API Key；key 存于本地数据库 `app_settings`，仅后端读取后直接调上游 API，日志中的 `sk-` / `Bearer` 凭证会脱敏。
- **仅绑定 127.0.0.1**：后端监听本机回环地址，动态端口（prod 由主进程握手传递）；前端 CSP 的 `connect-src` 只放行 `http://127.0.0.1:*`。
- **CSP**：构建期由 vite 插件注入 `index.html`（`script-src 'self'`，无 `unsafe-eval`；pdf.js 走主线程 fake worker，无需 worker-src），屏蔽远程脚本与内嵌脚本。
- **浏览器安全**：`contextIsolation:true`、`nodeIntegration:false`、`webSecurity:true`。

## 隐私

- 书籍、会话、笔记、高亮、API Key 都存在本机，不上传服务器。
- 只有你主动框选 / 发送的截图和文本会发给你配置的 AI 服务商。
- 应用没有埋点或遥测。

## 里程碑

开发按 `docs/plan.md` 中 M1–M15 里程碑推进，每个里程碑对应一个 `feat/mNN-*` 分支，验收后合并 `main`。

## License

[MIT](LICENSE)
