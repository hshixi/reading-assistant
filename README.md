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
└── electron/   # Electron 主进程 + preload
```

## 开发

```bash
npm install          # 安装所有 workspace 依赖
npm run dev          # 并发启动 vite + backend + electron
```

> 后端环境变量见 `backend/.env.example`。开发默认 `DATABASE_DRIVER=sqlite` 无需安装 MySQL；改用 MySQL 需先启动本地 MySQL 并设置 `DATABASE_DRIVER=mysql` 及相关连接参数。

## 里程碑

开发按 `docs/plan.md` 中 M1–M15 里程碑推进，每个里程碑对应一个 `feat/mNN-*` 分支，验收后合并 `main`。
