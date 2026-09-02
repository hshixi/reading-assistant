# V2 大版本计划：暗色主题 + 文本级阅读交互 + 高亮/笔记语义重做

## Context（背景与目标）

V1（M1–M15）已完成并打包（HEAD=`1624b8a`，工作树干净）。用户做了一轮深度体验，提出
7 条前端交互改进（F1–F7）+ 3 条功能问题（B1–B3），要求作为 **V2 新版** 整体规划、模块化推进。
V2 是一次语义升级：阅读器从「截图框选驱动」升级为 **原生文本选择驱动**（引入 pdf.js 文本层），
高亮与笔记改为**原文直标、本地落库**，主题支持浅/暗切换默认暗色。

改动横跨主题系统、阅读器渲染架构（pdf 文本层 + 稳定渲染管线）、选区与动作链路、数据模型、
聊天输入与后端动作落库。V2 开发前先打基线 tag，随时可回滚。

### 已确认产品决策（不可改）
1. **主题**：浅色/暗色切换，**默认暗色**。切换按钮放各页 header，持久化（localStorage `ui.theme`）。
2. **「笔记」按钮**：= 记录选中原文（excerpt）+ 打开笔记面板写理解/批注，**不自动调 AI**；
   AI 摘要/整理仍走聊天触发（保留 B3 通道）。
3. **「高亮」**：直接标在原文上、**不调 AI**，可删除。
4. **「翻译/解释」**（不落库动作）：结果 **复用聊天流式插入当前会话**，可追溯。
5. **「框选截图」（vision）仍保留**，但收进聊天输入区小 icon（F3），供无文本的图/表提问。
6. **安全铁律不变**：API key 永不出现在日志、渲染层永不持 key（全走后端）；后端只绑 127.0.0.1。

### 根因结论（探索确认）
- **B1 滚动闪烁**：`PdfViewer.vue` 虚拟化 ±2 页靠 Vue `v-for` 挂/卸 `<canvas>`；新进页挂**空白 canvas**
  后异步 `page.render`，离开窗口即卸载 canvas，回看重渲染 → 滚动/缩放总有空白帧。
  另有缩放路径 `applyScale` 清空全部 canvas 后整批异步重绘（`cancelAllTasks` + canvas.width 重置即清屏）。
- **B2 框选偏移**：`SelectionOverlay.vue` `onDown/onMove` 把**视口** `e.clientX/Y` 直接写进
  overlay-本地坐标的 `rectStyle`，而 overlay 原点在 header+toolbar 之下 ~88px → 蓝色选框比鼠标
  低 2~3 行；`captureSelection()` 换算本身正确（对比 canvas `getBoundingClientRect()`）。
- **B3 提及动作缺后端落库**：`chat.ts` 路由目前只在 `action==='note'` 时落库；
  `action==='highlight'` **不落库**；`translate/explain` 的 `selection` 只进 system prompt 不落库（符合预期）。
- 工具/API 就绪性：pdfjs-dist **5.7.284 导出 `TextLayer` 类**（`{ textContentSource, container, viewport }`
  → `render(): Promise`，缩放用 `update({ viewport })`；样式需引入 `web/pdf_viewer.css` 的 `.textLayer` 规则，
  随包已带该 css）。Element Plus 2.9 提供 `element-plus/theme-chalk/dark/css-vars.css`（`html.dark` 生效）。
  TypeORM `synchronize` 默认开 → 新增列/字段由 synchronize 自动演进，遗留行读时归一化即可。

---

## 一、数据模型 v2（模块 N4 落地，其它模块的语义基础）

矩形定位统一为 **每高亮/每笔记一段归一化行盒数组**（PDF 文本位置随缩放等比，百分比行盒在任意
zoom 下恒准，无需重跑文本层）。

**shared/src/types.ts**
- `Highlight.rect` → `rects: Rect[]`（DB 列仍叫 `rect`，simple-json 语义变数组）。
- `Note` 新增 `excerptText: string | null`；`Note.rect` → `rects: Rect[] | null`。
- `Selection` 改为几何语义：`{ page: number; rects: Rect[] }`（去掉单 rect）。
- `ChatRequest` 新增 `excerptText?: string`（文本动作原文；note/highlight 落库用原文而非 AI 摘句）。
- frontend `reader.ts` 内部 `ReaderSelection` 改为可辨识联合：
  `TextSelectionPayload { kind:'text'; page; rects; text } | ImageSelectionPayload { kind:'image'; page; rect; imageDataUrl }`。

**backend**：`Highlight.ts`/`Note.ts` 实体改字段名映射（`@Column({ name:'rect', type:'simple-json' }) rects`），
`Note` 加 `excerptText`（synchronize 自动加列）；`routes/marks.ts` DTO 同步；读旧行时归一化
（对象 → `[obj]`）。所有 rect 校验从 `rectFromBody` 换成 `rectsFromBody`（数组、每项 4 字段）。

**动作协议 v2**：
| 动作 | 触发 | 数据 | 落库 |
|---|---|---|---|
| 翻译/解释 | 文本右键菜单 | `action + excerptText`（无图）| 否，纯聊天 |
| 高亮 | 文本右键菜单「高亮」 | 前端直建 highlight（`rects+excerptText`）| 是（本地，无 AI）|
| 笔记 | 文本右键菜单「笔记」 | 前端打开笔记面板填批注后直建 note | 是（本地，无 AI）|
| AI 整理/摘要笔记 | 聊天里提及 + 选中文字 | `action:'note' + selection.rects + excerptText` | 后端解析 JSON 落 note |
| AI 高亮摘录 | 聊天里提及 + 选中文字 | `action:'highlight' + ...` | 后端解析 JSON 落 highlight（补）|
| vision 提问/翻译图 | 输入区框选 icon | `imageDataUrl`（截图上页）| 否 |

---

## 二、阅读器渲染管线（N2/N5 重构目标）

`PdfViewer.vue` 每页改为稳定「页对象」渲染，引入三条机制消除白闪，并为文本层铺路：

1. **双缓冲 blit**：`renderPageCanvas` 先渲染到离屏 canvas，`task.promise` 完成后一次性
   `ctx.drawImage` 上屏 → 消除「清屏再逐笔重绘」的可见空隙（缩放/重渲同样受益）。
2. **LRU 内容缓存**：`Map<num, { off: HTMLCanvasElement, scale, dpr }>`；页面离开 ±2 窗口时
   把上屏内容存缓存而非丢弃；回看同 scale 直接复用，跳过整次异步渲染。
3. **预渲染窗口 > 挂载窗口**：可见集 ±3 预渲染、±2 挂 DOM，给新进页留足渲染提前量；
   `cancelTasksOutOfRange` 只取消越过缓存边的任务。

页内 z 序（text layer 引入后）：`canvas(0) < 高亮/下划线层(1, pointer-events:none) < TextLayer spans(2, 可选)
< 交互标记(3)`。文本层只在可见页挂载，`applyScale` 后对存活 TextLayer 调 `update({viewport})`；
`getTextContent` 复用 pdf.js 页对象缓存。

---

## 三、模块规划（git `feat/v2-*` → main；每模块验收后 squash 合并）

### N1 · 基线收尾 + 主题系统（F1）
- `git tag v1.0.0 1624b8a`（**合并任何 feat 前先打**）；README/docs 注明 V2 起始点。
- 新建 `frontend/src/stores/theme.ts`：state `mode:'dark'|'light'`，init 读 localStorage（默认 dark），
  apply 时切 `document.documentElement.classList.toggle('dark', …)` 并写回 localStorage。
- `main.ts`：import `element-plus/theme-chalk/dark/css-vars.css`。
- 建站即用组件：`components/common/ThemeToggle.vue`（el-switch/icon），放 ShelfView / ReaderView / SettingsView header。
- **硬编码色扫描**：App.vue `body`、PdfViewer `.pdf-viewer` 背景、NotesPanel 背景、ChatInput/MessageItem 里非
  `--el-*` 的颜色改 CSS 变量；PDF 纸面 canvas 恒白（`.pdf-canvas { background:#fff }` 保留，这是纸张语义）。
- 验收：dev:prod 启动默认暗色；切浅色即时全局生效；重启记忆。

### N2 · 阅读器渲染/选区修复（B1 + B2）
- `PdfViewer.vue` 按第二节三条机制改造（先不动文本层）。
- `SelectionOverlay.vue` B2 修复：`onDown/onMove` 改算 overlay 本地坐标
  `x = e.clientX - overlayRect.left`，且选区矩形夹取到**光标所在单页**（`elementFromPoint` 命中 canvas 则裁剪），
  `captureSelection()` 保持用 client 坐标对 canvas rect 求交的现有正确算法。
- 验收：连续快速滚动 + 页内大幅跳转无白闪；缩放无闪；框选首行时蓝框顶与首行对齐、截图内容与所见一致。

### N3 · 布局：可拖分隔线（F2）
- `ReaderView.vue`：删「适配宽度」按钮；`.reader-chat` 固定 380px 改为
  `.reader-splitter`（5px，`cursor:col-resize`，mousedown→drag→mouseup 改 readerChatWidth）。
- 宽度状态存 `useThemeStore`? 否 — 新建 `stores/layout.ts`（`readerChatWidth`），localStorage 持久化，clamp 260–640。
- `PdfViewer` 暴露「是否自动适配」状态：载入初始 fitWidth；用 ResizeObserver 监听 `.reader-main` 宽度，
  若用户未手动 zoom（记录 `scale` 是否来自 fitWidth 且未手动改）则宽度变化后自动 re-fit。
- 验收：拖分隔线左右顺畅、宽度记忆；左右切换 `showRight` 保留宽度；PDF 区变宽变窄均不出现内容越界/错位。

### N4 · 数据模型 v2（前置语义，无 UI）
- shared 类型 + backend 实体/DTO/路由 + frontend stores/api + api/highlights.ts HighlightInput 按第一节改。
- frontend `reader.ts` `ReaderSelection` 联合类型；`SelectionOverlay` 产出 `ImageSelectionPayload`；
  ChatInput/onSend 相应适配（保持编译过）。旧 `toRect` 适配器删除/替换。
- 验收：`npm run lint`+`typecheck` 全绿；上传旧书（含 V1 遗留高亮/笔记数据）能打开且高亮/笔记列表渲染不崩
  （读归一化生效）；手工建/删高亮、笔记 CRUD 通。

### N5 · 文本层 + 原生拖选 + 右键菜单（F6）
- `PdfViewer.vue`：每可见页 `.page-wrap` 内加 `.text-layer` 容器，`page.getTextContent()` →
  `new pdfjsLib.TextLayer({ textContentSource, container, viewport }).render()`；
  引入 `pdf_viewer.css` 中 `.textLayer` 规则（经 vite 正常 import 或挑关键规则本地化）；
  `applyScale` 后对存活页 `update({viewport})`。
- 文本选择：不做 pdfjs 自有 selectionEditor，利用**原生 DOM 选区**（spans transparent color + `::selection`
  可见色）。容器确保无 `user-select:none`。
- `components/reader/TextSelectionMenu.vue`（右键菜单）：`contextmenu` 于文本层触发且当前页有选中 →
  显示菜单（翻译 / 解释 / 笔记 / 高亮，主题化）；选中跨页提示「请在同一页内选择」。
- `stores/reader.ts` action `captureTextSelection()`：`window.getSelection()` → `range.getClientRects()`
  相对 `.page-wrap` 归一化多行盒 → `{ page, rects, text }` 存入 `selection`（`kind:'text'`）；
  供右键菜单动作消费。
- 翻译/解释菜单项：`store.send(指令, { action, selection, excerptText })` → 聊天流式（消息可见为「翻译选中内容」）。

### N6 · 高亮重做 + 高亮 Tab（F5）
- `HighlightLayer.vue`：按 `h.rects[]` 渲染多 div（百分比）；`pointer-events:none`；每条高亮整体可点
  （包围盒）→ 小 popover「删除高亮 / 显示原文」。
- 右键菜单「高亮」：直接 `readerStore.addHighlight({ pageNumber, rects, excerptText })`（本地无 AI）→
  `ElMessage.success` + 清文本选区。
- `components/highlights/HighlightsPanel.vue` + `HighlightsPanel` 挂右 Tab（聊天/笔记/**高亮**）：
  列表显示 excerptText + 页码 + 时间 + 删除；删除 → `removeHighlight` → 页面上矩形即时消失。
- 验收：选中多行→高亮→页面上每行都标黄；高亮 Tab 点删除后原文标记消失；缩放后高亮仍贴合。

### N7 · 笔记重做：原文 excerpt + 批注 + 下划线 + 定位（F7）
- 数据：`Note.excerptText`（原文）+ `Note.content`（批注）。`NotesPanel` 加**新建笔记编辑态**：
  右键「笔记」→ 切到笔记 Tab，编辑器预填 excerpt（只读引用块）+ 空批注 textarea → 保存
  `createNote({ content: 批注, excerptText, pageNumber, rects })`。
- 页内表现：`components/reader/NoteMarkLayer.vue`（并入 HighlightLayer 或独立层）按 `note.rects[]`
  画**淡红下划线**（如 2px bottom border rgba(231,76,60,.5) + 极浅红底）；hover 显示浮窗（content 优先，
  无则 excerpt）；**点击** → 右 Tab 切 notes 并滚动定位该条（闪烁高亮 1.5s）。
- NoteItem 重排：excerpt（引文样式）+ 批注内容 + 页码/时间/删除；页面跳转复用现 @jump。
- 全局文案「摘抄/摘抄笔记」→「笔记」：ACTION_LABELS、NotesPanel 空态、ChatInput 提示、README/docs。
- 验收：右键选中→笔记→Tab 预填原文→写批注保存→原文出现下划线→hover 见批注→点击跳笔记 Tab 定位到该条。

### N8 · 聊天输入重构 + 截图自动清除（F3/F4）
- `ChatInput.vue`：
  - 删除 quick-actions 行（翻译/解释/高亮/摘抄按钮）——入口迁至右键菜单 / 高亮 Tab。
  - 输入行左侧加**框选截图 icon**（camera）：点击进入截图模式（复用 SelectionOverlay），
    产出 `ImageSelectionPayload` 显示缩略 chip + 清除按钮 + 附带勾选。
  - 输入框维持 el-input textarea autosize（min1/max6）自动增高；Enter 发送、Shift+Enter 换行。
  - 文本选区（kind:'text'）存在时，输入区顶部显示「已选中第 n 页文字（xx 字）[清除]」提示条。
- `stores/chat.ts` `send()` 成功（含 onDone/onError 后）或 `chat.ts` onSend：若本次消耗了截图/选区 → 调
  `readerStore.clearSelection()`（F4：发送即清，防重复误发）。高亮本地直建成功后也清选区。
- 验收：截图→发送→待发送 chip 自动消失；手动打字带截图发送同样自动清；不发送不消失。

### N9 · 聊天提及动作 + 后端动作落库（B3）
- `chat.ts` 后端 `createChatRouter`：补 `action==='highlight'` 落库分支（模型 JSON
  `{"type":"highlight","excerpt":…}` → 用 `selection.rects` + `excerptText`/模型 excerpt 建 highlight，
  发 `save` 事件）；`action==='note'` 分支同时写 `excerptText`。
- `deepseek.ts`：`buildMessages` 在 action 且无图但有 `excerptText` 时，user 消息注入
  `<选中内容>…</选中内容>`（文本动作不必走 vision）。
- frontend 提及→动作映射：`ChatInput.onSend` 若存在**文本选区**，解析 typed 前若干字命中词表
  （翻译→translate、解释/说明/讲讲→explain、摘抄/整理/笔记/记笔记→note、高亮/标注→highlight）
  则自动附加 `action + selection.rects + excerptText`；无选区却提及高亮/笔记 → `ElMessage.warning`
  「请先拖动选中文字」。选中过时若属截图则不发选区（仅文本）。
- 验收：选中文字打「翻译这段」→ 走翻译流式；打「整理成笔记」→ 笔记落库出现在笔记 Tab 且含原文 excerpt；
  打「高亮这句」→ 高亮落库上页。

### N10 · 回归联调 QA
- 全量 `npm run lint` + `npm run typecheck`；`dev:prod` 全流程手测；对照 `docs/smoke-test.md` 补 V2 冒烟条目
  （主题/文本选择/高亮删除/笔记下划线/分隔线记忆/截图自动清/提及动作）。打包 dmg 复验 CSP 0 违规、暗色在 file:// 正常。
- B1/B2 复测专项；无孤儿进程。

---

## 关键文件清单（改动最密集处）

- 渲染/文本层：`frontend/src/components/reader/PdfViewer.vue`、新增 `TextLayer 挂载`、`TextSelectionMenu.vue`、`NoteMarkLayer`（或并入 HighlightLayer）。
- 选区与 store：`frontend/src/components/reader/SelectionOverlay.vue`、`frontend/src/stores/reader.ts`、`frontend/src/stores/chat.ts`、`frontend/src/stores/notes.ts`。
- 面板：`frontend/src/components/chat/ChatInput.vue`、`notes/NotesPanel.vue`、`notes/NoteItem.vue`、新增 `highlights/HighlightsPanel.vue`。
- 视图/主题/布局：`frontend/src/views/ReaderView.vue`、`ShelfView.vue`、`SettingsView.vue`、`main.ts`、新增 `stores/theme.ts`、`stores/layout.ts`、`components/common/ThemeToggle.vue`。
- 共享/后端：`shared/src/types.ts`、`backend/src/db/entities/{Note,Highlight}.ts`、`backend/src/routes/marks.ts`、`backend/src/routes/chat.ts`、`backend/src/services/deepseek.ts`、`backend/src/db/bootstrap.ts`（schema_version→2 备注）。
- 前端 api：`frontend/src/api/highlights.ts`（HighlightInput.rects）。

## 验证方式

1. 每模块末：`npm run lint` + `npm run typecheck` + 该模块验收条目（N2 用手滚轮/缩放手测；N5–N7 用样例 PDF 选中文+英文文本）。
2. 回归：`npm run dev:prod`（真实生产路径 + 日志）全流程：导入 → 书架 → 阅读 → 主题切换 → 文本选择 → 高亮/笔记/翻译 → 高亮 Tab 删除 → 重开书数据仍在（SQLite）。
3. 打包：`node scripts/release.mjs` → dmg 安装启动 → CSP Security Warning=0、暗色默认、后端降级正常。
4. 回滚：任一模块出问题 → `git tag v1.0.0` 即刻还原（V1 基线）。
