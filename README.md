# Reading Assistant（辅助阅读）

macOS 桌面阅读辅助应用：本地 PDF 阅读 + 右侧 AI 助手随读随问。

- **阅读**：导入本地 PDF，应用内浏览，支持缩放 / 翻页 / 连续滚动。
- **AI 助手**：看不懂的段落「框选截图」发给 AI（DeepSeek vision 模型），支持翻译 / 解释 / 摘抄笔记 / 高亮注释。
- **数据持久化**：书籍、会话、聊天记录、笔记、高亮、注释存储于本地 MySQL（ORM 抽象，可退回内嵌 SQLite）。
- **历史上下文**：重新打开同一本书，自动恢复历史聊天记录。

## 技术栈

| 层 | 选型 |
|---|---|
| 壳 | Electron（electron-builder 打包 dmg） |
| 前端 | Vue 3 + Vite + TypeScript + Element Plus + Pinia |
| 后端 | Node.js + TypeScript + Express |
| 数据库 | MySQL（TypeORM，可切 SQLite） |
| PDF | pdfjs-dist |
| AI | DeepSeek OpenAI 兼容 API（vision，流式 SSE） |

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
npm run dev          # 并发启动 vite + backend + electron
```

> 后端环境变量见 `backend/.env.example`。开发默认 `DATABASE_DRIVER=sqlite` 无需安装 MySQL；改用 MySQL 需先启动本地 MySQL 并设置 `DATABASE_DRIVER=mysql` 及相关连接参数。

## 打包发布（dmg）

```bash
python3 scripts/make-icon.py        # 重新生成 resources/icon.icns（依赖 Pillow）
node scripts/release.mjs            # 构建 arm64 dmg（本机架构）
node scripts/release.mjs --arch=arm64 --arch=x64   # 双架构
node scripts/release.mjs --node-binary=/path/to/node  # 用本地 node 二进制代替下载
```

产物输出到 `release/`。打包流程：esbuild 把后端 bundle 成单文件 `server.js` → electron-builder 出 `.app` → 手动注入 `Resources/backend/`（node 二进制 + better-sqlite3 原生模块 + 裁剪后的 pdfjs-dist）→ `--prepackaged` 出 dmg。细节见 `docs/plan.md`「M14 打包要点」。

### 架构决策要点

- **后端以真实 node 运行**（非 Electron 自带 node）：better-sqlite3 按系统 Node ABI 预编译，与随包附带、由 `release.mjs` 从 nodejs.org 下载的 node 二进制一致。GUI（Finder）启动的 PATH 不含 node，所以 node 必须随包。
- **数据库自动降级**：主进程以 `DATABASE_DRIVER=auto` 拉起后端 → 有 MySQL 用 MySQL，连接失败秒级退回内嵌 SQLite，设置页可见当前模式。
- **前端竞态防护**：渲染层先 `initApi()+checkHealth()` 握手拿到动态后端端口再渲染书架，失败显示重试。

## 安全设计

- **API Key 只存后端**：渲染层永不持有 DeepSeek key；key 存于本地数据库 `app_settings`，仅后端读取后直接调上游 API，**不写入任何日志**。
- **仅绑定 127.0.0.1**：后端监听本机回环地址，动态端口（prod 由主进程握手传递）；前端 CSP 的 `connect-src` 只放行 `http://127.0.0.1:*`。
- **CSP**：构建期由 vite 插件注入 `index.html`（`script-src 'self'`，无 `unsafe-eval`；pdf.js 走主线程 fake worker，无需 worker-src），屏蔽远程脚本与内嵌脚本。
- **浏览器安全**：`contextIsolation:true`、`nodeIntegration:false`、`webSecurity:true`。

## 里程碑

开发按 `docs/plan.md` 中 M1–M15 里程碑推进，每个里程碑对应一个 `feat/mNN-*` 分支，验收后合并 `main`。
