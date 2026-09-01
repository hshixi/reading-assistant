# 开发指南

## 环境要求

- Node.js >= 20（开发机为 24.x）
- npm >= 10
- macOS（目标平台）

## 常用命令（仓库根目录）

```bash
npm install          # 安装全部 workspace 依赖
npm run dev          # 并发启动 backend(8787) + vite(5173) + electron
npm run build        # 依次构建 shared → backend → frontend → electron
npm run typecheck    # 各包 tsc 类型检查
npm run lint         # eslint
```

## 单独跑某个包

```bash
npm run dev -w @reading/backend     # 后端 tsx watch（127.0.0.1:8787）
npm run dev -w @reading/frontend    # 前端 Vite dev server（5173）
npm run dev -w @reading/electron    # Electron（需先构建 electron + 起前端）
```

## 后端环境变量

复制 `backend/.env.example` 为 `backend/.env` 后按需修改。开发默认 `DATABASE_DRIVER=sqlite`，无需安装 MySQL。

切换到 MySQL：

```bash
DATABASE_DRIVER=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的密码
DB_NAME=reading_assistant
```

需先创建数据库：`CREATE DATABASE reading_assistant CHARACTER SET utf8mb4;`

## AI 配置

DeepSeek API key 建议在**应用设置页**填写（存本地 app_settings，不进代码仓库）。临时本地验证也可用 env：

```bash
AI_API_KEY=sk-xxx   # 写入 backend/.env
```

## 数据目录

默认 `~/.reading-assistant`（可用 `DATA_DIR` 覆盖）：

```
~/.reading-assistant/
├── books/{bookId}/original.pdf
├── media/{sessionId}/{messageId}.png
├── data/app.sqlite        # 仅 SQLite 模式
└── backend.port           # 生产动态端口握手
```
