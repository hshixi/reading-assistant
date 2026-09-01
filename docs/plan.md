# 开发里程碑

开发按里程碑逐个推进：每个里程碑一个 `feat/mNN-*` 分支，验收通过后 squash 合并到 `main`。

| # | 里程碑 | 交付物 | 验收标准 | 状态 |
|---|---|---|---|---|
| M1 | 仓库骨架 | git init、npm workspaces、tsconfig/eslint、shared 类型、docs/adr | 三包可构建，lint/typecheck 通过，后端 /health 通 | ✅ 2026-09-01 |
| M2 | Electron 壳连通 | main/preload、dev.mjs、窗口加载 vite dev | dev 启动见默认 Vue 页，主进程无错 | ✅ 2026-09-01 |
| M3 | DB 层 | 7 实体、data-source 双驱动、bootstrap、settings 种子 | MySQL 与 SQLite 两种 env 均能 initialize+建表+种子 | ✅ 2026-09-01 |
| M4 | 书籍模块 | book-store、上传接口、Range 流、列表/删除 | 上传/删除 PDF 成功，文件目录正确清理 | ✅ 2026-09-01 |
| M5 | PDF 阅读器 | pdf.js 单页渲染+页码+缩放、worker 配置 | dev 与 prod(file://) 均渲染无 worker 报错 | ✅ 2026-09-01 |
| M6 | 连续滚动 | 虚拟化渲染、适配宽度 | 100 页 PDF 滚动流畅，缩放不糊 | ✅ 2026-09-01 |
| M7 | 框选截图 | SelectionOverlay、坐标换算、PNG dataURL | Retina 2x 下截图与选区一致无偏移 | ✅ 2026-09-01 |
| M8 | 聊天 UI | ChatPanel、MessageList、markdown、SSE 消费 | mock 后端流式打字机正常 | ✅ 2026-09-01 |
| M9 | DeepSeek 接入 | deepseek.ts、stream 端点、翻译/解释 | 真实 API 图文流式回答；断网/401 有提示 | ✅ 2026-09-01 |
| M10 | 会话与历史 | sessions CRUD、消息持久化、重开书恢复聊天 | 重开书见上次会话与完整消息；切会话正确 | |
| M11 | 笔记/高亮 | 三表 CRUD、HighlightLayer、AI 摘抄/高亮落库 | 框选→高亮上页；AI 摘抄后笔记面板出现记录 | |
| M12 | 设置页 | AI/DB 设置表单、持久化、立即生效 | 改 base_url/key 后新对话即用新配置 | |
| M13 | 生产打包 | 后端子进程、动态端口、静态资源、CORS/安全 | dmg 装后打开即用，无 file:// 问题 | |
| M14 | dmg+降级验证 | electron-builder dmg、MySQL→SQLite 自动退回 | 无 MySQL 机器开箱即用；有 MySQL 用 MySQL | |
| M15 | QA/收尾 | 空态/错误处理/README/lint/CI/图标 | 冒烟测试清单全绿 | |

## 分支纪律

- `main` 为保护分支，仅接受 `feat/*` 的 squash merge。
- 每个里程碑结束运行 `npm run lint` + `npm run typecheck` + 相关验收用例。
