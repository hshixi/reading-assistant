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
| M10 | 会话与历史 | sessions CRUD、消息持久化、重开书恢复聊天 | 重开书见上次会话与完整消息；切会话正确 | ✅ 2026-09-01 |
| M11 | 笔记/高亮 | 三表 CRUD、HighlightLayer、AI 摘抄/高亮落库 | 框选→高亮上页；AI 摘抄后笔记面板出现记录 | ✅ 2026-09-01 |
| M12 | 设置页 | AI/DB 设置表单、持久化、立即生效 | 改 base_url/key 后新对话即用新配置 | ✅ 2026-09-01 |
| M13 | 生产打包 | 后端子进程、动态端口、静态资源、CORS/安全 | 源码级 prod 验证：electron 拉起后端子进程、动态端口握手、file:// 渲染、无后端报错、退出无孤儿进程 | ✅ 2026-09-01 |
| M14 | dmg+降级验证 | electron-builder dmg、MySQL→SQLite 自动退回 | dmg 构建 + 打包后应用开箱即用；无 MySQL 自动降级 SQLite；退出无孤儿进程 | ✅ 2026-09-01 |
| M15 | QA/收尾 | 空态/错误处理/README/lint/图标/冒烟清单 | 冒烟测试清单全绿 | ✅ 2026-09-01 | |

## V2 模块日志（F1–F7 / B1–B3，基线 `git tag v1.0.0` = 1624b8a）

V2 规划与逐模块根因见 `.claude/plans/mac-app-dmg-app-1-pdf-2-ai-ai-highlight-federated-hammock.md`；
每个模块一个 `feat/v2-*` 分支，验收（lint + typecheck + CDP/手测）后 squash 合并到 `main`。

| # | 模块 | 交付物 | 验收标准 | 状态 |
|---|---|---|---|---|
| N1 | 主题系统（F1） | theme.ts + EP dark css-vars + ThemeToggle + 硬编码色变量化（`d689a90`） | 默认暗色；切浅色即时全局生效；重启记忆 | ✅ 2026-09-02 |
| N2 | 渲染/选区修复（B1+B2） | PdfViewer 双缓冲 blit + LRU 内容缓存 + 预渲染窗口；SelectionOverlay overlay 本地坐标（`e384c8c`） | 快速滚动/跳转/缩放无白闪；框选首行蓝框与首行对齐 | ✅ 2026-09-02 |
| N3 | 可拖分隔线（F2） | stores/layout.ts + .reader-splitter；移除「适配宽度」按钮（`ce90887`） | 拖拽顺畅、宽度记忆；PDF 区缩放 re-fit 不越界 | ✅ 2026-09-02 |
| N4 | 数据模型 v2 | Highlight/Note rect→rects[]、excerptText、Selection 几何语义；marks DTO 归一化（`7759f5d`） | lint/typecheck 全绿；旧数据读归一化不崩；高亮/笔记 CRUD 通 | ✅ 2026-09-02 |
| N5 | 文本层+右键菜单（F6） | PdfViewer 每页 TextLayer；TextSelectionMenu（翻译/解释/笔记/高亮）；captureTextSelection 行盒化（`5ef8507`） | 原生拖选可见；右键动作走聊天流式/面板；跨页提示 | ✅ 2026-09-02 |
| N6 | 高亮重做+高亮 Tab（F5） | HighlightLayer 多行盒渲染 + 点选卡片；右键「高亮」直建本地高亮；HighlightsPanel（`f15afb1`） | 多行选中全部标黄；删除即时消失；缩放仍贴合 | ✅ 2026-09-02 |
| N7 | 笔记重做（F7） | NoteItem 重排+excerpt；右键「笔记」预填批注编辑态；下划线+hover 浮窗+点击定位；文案「摘抄」→「笔记」（`2ab716e`） | 右键→Tab 预填原文→写批注保存→下划线→hover→点击定位 | ✅ 2026-09-02 |
| N8 | 聊天输入重构（F3/F4） | ChatInput 删 quick-actions 行；相机框选 icon；文本/截图 chip；发送即清 selection（`ba4a828`） | 框选→chip→发送→自动清除；附带开关生效 | ✅ 2026-09-02 |
| N9 | 提及动作+后端落库（B3） | chat.ts highlight 落库分支；deepseek 文本摘录注入；ChatInput 词表→action + 无选区提示（`bdafc7c`） | 「翻译这段」流式；「整理成笔记」落笔记含原文；「高亮这句」落高亮；无选区提及→警告 | ✅ 2026-09-02 |
| N10 | 回归联调 QA | 全量 lint/typecheck；dev:prod 手测（B1/B2/主题/截图/右键/提及）；smoke-test.md 补 V2 条目；本日志 V2 行 | 冒烟 V2 清单全绿；回归测试数据清理；无孤儿进程 | ✅ 2026-09-02 |

**N10 实测结论**：`npm run lint` + `npm run typecheck` 全绿；SQLite 降级 dev:prod 下 B1 复测
（快速滚动 48→53 页逐帧可见页 canvas 均已渲染、无空白闪烁）、B2 复测（框选蓝框与鼠标起点对齐、
无 88px 偏移）、主题切换、右键高亮落库/删除、右键翻译流式、框选截图发送即清、提及动作落库，
均已 CDP 端到端/手测通过；回归产生的会话/消息/笔记/高亮测试数据已清理（notes/highlights/sessions=0）。

## V2.1 / V2.2 发布要点（v0.2.0，2026-09-02）

发布版本 0.2.0，交付 V2 重构全量（N1–N10）+ V2.1 QA 五项修复 + V2.2 两项功能。
对外改动一览见根目录 `CHANGELOG.md`；本节记录实现上的关键点，供后续维护回溯。

**V2.1 修复**
- P1 输入区布局：ChatPanel 输入区固定约 1/5 高内部滚动，消息列表 flex:1 吃余量。
- P2 原文引用：chat.ts/stores/chat.ts 把 excerptText + page 并入 meta 落库；MessageItem 渲染引用块。
- P3 提及识别：ChatInput 触发词表扩充 + 句内落库动作兜底扫描 + 剥离最长前缀优先排序。
- P4 UTF-8 文件名：books.ts 上传 multer `defParamCharset: 'utf8'`。
- P5 页面滚动锁死：App.vue `overflow:hidden`，滚动只在各视图内部容器。

**V2.2 书架封面（懒生成 + 磁盘缓存）**
- 后端 `GET /books/:id/cover`：缺封面才生成，写失败哨兵 `cover.png.failed` 防反复重试，
  成功删哨兵并 `Cache-Control: public, max-age=86400`；删除书整目录清理自动带走封面。
- 渲染器 `backend/src/services/cover.ts`：**Quick Look（`qlmanage -t`）** 而非 sips ——
  sips 对部分 PDF 输出全透明（alpha=0）/纯白图片，书架只见占位（实测本应用 PDF 复现）；
  qlmanage 正确出不透明 900px 封面。唯一临时目录 + 原子 rename，并发安全。
- 前端 `BookCover.vue`：图片始终渲染 + 挂载完成态校验 + @error 自动带参重试一次 +
  8s 超时先显示占位（图到达后 @load 自行顶替），无"占位钉死"路径。

**V2.2 阅读进度记忆（lastPage）**
- Book 实体新增 `last_page`（int 可空，TypeORM synchronize 启动自动加列）；
  shared Book/BookPatch 增加 lastPage；books PATCH 支持写/清（整数 ≥1 校验）。
- ReaderView：页码变化防抖 1.2s PATCH 落库；卸载/切书前立即 flush（不依赖防抖）；
  PdfViewer 完成首屏布局后新增 `@loaded` 事件，重开据此 goTo 上次页码。各书进度独立。
- CDP 实测：119 页退出→重开自动定位 119；无进度书停首页；book1/book3 各自记忆互不影响。

**封面/进度的发布前修复教训**：仅靠 DOM（naturalWidth/complete）判断"封面已显示"不可靠 ——
需抓屏逐像素或校验 PNG alpha（曾误判：图片元素 530×900 解码成功但全透明 → 书架只显示占位）。

## V2.3 打包版修复发布要点（v0.2.1，2026-09-02）

发布 0.2.1，修 0.2.0 dmg 的两个**仅打包环境可见**问题。对外改动见根目录 `CHANGELOG.md`；
本节记录根因与实现关键点。

**根因共性**：dev 走 Vite `http://localhost:5173` + 全量 node_modules + 无 CSP，与打包
（`file://` 加载 dist-frontend + 严格 CSP + 裁剪 node_modules）差异大，两类问题 dev 流程都测不出。
**教训**：发版前用 `dev:prod`（就是 file:// + CSP + 裁剪版后端）当"打包预演"过一遍，而不是只信
纯 dev 测试。

**问题 1 · 书架「解析中…」卡死（pageCount 永远 NULL）**
- 打包 `release.mjs` 裁 pdfjs-dist 只带 `legacy/build/pdf.mjs`，漏 `pdf.worker.mjs`：
  打包后端异步算页数每次报「Cannot find module pdf.worker.mjs」而失败。
- 修：裁剪补全 `pdf.worker.mjs` + `wasm/`；`page-count.ts` import 前垫最小 `DOMMatrix` 桩
  （打包后端无 canvas，pdf.mjs 顶层 `new DOMMatrix()` 直接崩）；
  `books.ts` PATCH 路由新增接受 `pageCount`；ReaderView 打开读到 numPages 且 DB 仍 NULL 时
  回填落库（自愈历史「解析中」书）；ShelfView 上传后 `ensurePageCount` 轮询刷新卡片。

**问题 2 · 翻页空白（扫描 PDF 的 JBIG2/JPEG2000 解码失败）**
- pdf.js 5.7 的 jbig2/openjpeg/qcms 解码器走 wasm（`wasmUrl` 拼文件名加载），打包版既没带
  wasm 文件、渲染层也没传 `wasmUrl` → 扫描页 XObject 全被忽略 → 首页正常、翻页全白。
- 修：后端 `/pdfjs/wasm/:file` 白名单静态路由（file:// 页不能 fetch file:// wasm，改走
  `http://127.0.0.1`；`connect-src` 早已放行）；PdfViewer `getDocument({ wasmUrl })`；
  **CSP 加 `wasm-unsafe-eval`** —— file:// 页 `script-src 'self'` 会拦 `WebAssembly.instantiate()`，
  仅放行 wasm 编译（不放行任意 eval），解码器即时生效。
- 0.2.1 dmg 实测：300 页 PDF 导入即显示页数；遗留「解析中」书打开自愈；翻页至正文深处渲染正常、
  控制台无 JBig2/CSP 报错。

## V2.4 / V2.5 迭代模块日志（已发布 0.2.2，基线 main=e805003）

两块需求（用户 2026-09-09 确认方案，见 `.claude/plans/…federated-hammock.md`）：
V2.5 书架卡片 + V2.4 扫描版区域笔记/高亮。每模块一个 `feat/*` 分支，squash 合并后在此登记。

| # | 模块 | 交付物 | 状态 |
|---|---|---|---|
| R1 | V2.5 书架卡片进度/笔记数 | Book.noteCount 聚合（列表+详情）；BookCover 封面底进度条；meta 精简两行 | ✅ 00cd9f2（dev:prod 实测 OK） |
| R2 | V2.4 扫描版区域笔记/高亮 | Highlight 加图片列 + region-store 落盘 + deepseek 转写分支 + 框选迷你菜单 + 细边框标记 + 面板缩略图/批注 | ✅ e805003（dev:prod 实测 OK，0.2.2 已发布） |

## 分支纪律

- `main` 为保护分支，仅接受 `feat/*` 的 squash merge。
- 每个里程碑结束运行 `npm run lint` + `npm run typecheck` + 相关验收用例。

## M13 架构决策：后端子进程用「真实 node」而非 Electron 自带 node

后端以 node 二进制启动（`backend-process.ts` 的 `resolveNodeLauncher`），不用
`ELECTRON_RUN_AS_NODE`。原因：better-sqlite3 原生模块按系统 Node ABI 构建
（prebuilt，node-gyp 安装脚本自动下载，无需编译）；换 Electron ABI 需能编译
Node24 头文件（C++20 `<source_location>`）的较新工具链，本机 Apple clang14 无法编译，
且 `@electron/rebuild` 会覆盖系统构建、破坏 dev 流程。

**node 解析顺序**：`READING_APP_NODE_BIN`（M14 打包时在 extraResources 附带同版本
node 二进制并指定）→ PATH 上的系统 node → 兜底 process.execPath+ELECTRON_RUN_AS_NODE。
GUI（Finder）启动的 PATH 不含 node，**M14 必须捆绑 node 二进制**，否则打包后无法拉起后端。

另：eslint `ignores` 增加 `**/dist-backend/**`（esbuild 单文件产物不参与 lint）。

## M14 打包要点（scripts/release.mjs + electron-builder）

- **node 随包附带**：better-sqlite3 按系统 Node ABI（node v24.16.0，ABI 137）构建，
  后端必须以同版本真实 node 运行。release 脚本从 nodejs.org 下载 darwin-<arch> 的
  node 二进制放入 `Resources/backend/node`（可用 `--node-binary` 覆盖），
  主进程 `resolveNodeLauncher` 优先用 `process.resourcesPath/backend/node`。
- **extraResources 会过滤 node_modules**（app-builder-lib util/filter.js 对
  `node_modules` 目录直接 return false）→ 改为「dir 出 .app → 手动注入
  resources/<arch>/backend 到 .app/Contents/Resources/backend → --prepackaged 出 dmg」。
- **asar 只含 electron/dist + electron/dist-frontend**（release 脚本把 frontend/dist
  拷入 electron/dist-frontend；`files` 显式排除 `**/node_modules/**`，避免 monorepo
  依赖污染）。frontendDistDir() 优先解析 asar 内的 dist-frontend。
- **后端运行时依赖**：server.js 由 esbuild 内联 express/typeorm/mysql2 等纯 JS；
  external better-sqlite3（原生）+ pdfjs-dist（ESM 动态 import）。随包只带
  better-sqlite3（lib+build/Release）、bindings、file-uri-to-path、
  pdfjs-dist（裁剪为 package.json + legacy/build/pdf.mjs，自包含）。
- **MySQL 自动探测**：主进程以 `DATABASE_DRIVER=auto` 拉起后端 → 有 MySQL 用 MySQL、
  无则 connect ECONNREFUSED 秒级降级 SQLite（init.ts）。
- **前端竞态修复**：App.vue 用 initApi()+checkHealth() 就绪门控（ready 前不渲染
  router-view，失败显示重试）。此前 ShelfView 的 fetchBooks 在 initApi 解析端口前
  运行，prod 冷启动下落到 8787 导致 "Failed to fetch"。
- 打包后无签名（本地内测右键打开）。

## M15 收尾要点（QA）

- **CSP**：构建期 vite 插件（`frontend/vite.config.ts` 的 `cspPlugin`）仅向产物注入 meta
  `default-src 'self'; script-src 'self'; ...; connect-src 'self' http://127.0.0.1:* ws://... blob:`
  （无 `unsafe-eval`；pdf.js 主线程 fake worker 无 worker-src；应用内框选截图是 data: URL）。
  源码级 prod + 打包 dmg 双重验证：无 Security Warning、无 `Refused to`，PDF 文字像素渲染正常。
- **图标**：`scripts/make-icon.py`（Pillow 绘制蓝靛渐变圆角方块 + 打开的书 + 橙色高亮笔道，
  语义呼应「阅读 + AI 高亮」）→ `resources/icon.icns`（iconutil）。release.mjs 的
  `.app` 与 dmg 卷都指定该图标。
- **lint/typecheck 收尾**：eslint `ignores` 增补 `**/dist-frontend/**`、`**/resources/*/`；
  MessageItem.vue 的 `v-html`（marked 输出经 DOMPurify.sanitize）用模板顶部
  `eslint-disable vue/no-v-html` 注释豁免。`npm run lint` 0 error、`npm run typecheck` 全绿。
- **空态/错误处理**：书架空态（el-empty）、阅读器加载/出错重试、聊天空态与 msg.error、
  笔记空态、后端握手失败重试（App.vue）均已具备，M15 复核无缺口。
- **冒烟清单**：见 `docs/smoke-test.md`。本机已验证：dmg 构建、无 MySQL 降级 SQLite、
  空态、上传→书架、重开恢复数据、PDF 渲染、CSP 0 违规、退出 0 孤儿进程。
- **README**：补充打包发布、架构决策要点（真实 node 后端子进程、DB 自动降级、前端竞态防护）
  与安全设计（API key 只存后端不进日志、仅绑 127.0.0.1、CSP、contextIsolation）。
- 遗留：x64 包 / 签名公证 / CI 自动化，发布前按需补。
