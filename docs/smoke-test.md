# M15 冒烟测试清单

以下清单覆盖打包后应用（dmg 安装 / `release/*.app`）的开箱即用路径。
本机执行环境：macOS arm64，无本地 MySQL，无开发者签名（右键打开）。

## 环境与产物

- [ ] 构建产物：`node scripts/release.mjs`（arm64）成功产出 `release/mac-arm64/Reading Assistant.dmg` 与 `.app`
- [ ] dmg 可挂载：`hdiutil attach release/mac-arm64/*.dmg` 无报错，卸载后无残留挂载点

## 首次启动（无 MySQL → 自动降级 SQLite）

- [ ] Finder 打开 `.app`（或右键→打开）能启动；无签名弹窗可通过右键打开绕过
- [ ] 后端自动拉起：`resources/backend/node` 解析到随包 node，后端进程监听 `127.0.0.1:<动态端口>`
- [ ] 数据库降级：日志出现 `MySQL 不可用…自动降级为 SQLite`（或 `driver=sqlite（自动降级）`）
- [ ] 主界面出现书架（无「后端连接失败」红色告警）；首启空态显示「还没有书籍」
- [ ] Electron 安全告警消失（CSP 已注入，`ELECTRON_ENABLE_LOGGING=1` 下无 Security Warning）
- [ ] 无 CSP violation（控制台无 `Refused to` 记录；PDF 请求、API 请求均被放行）

## 阅读

- [ ] 导入 PDF（`docs/sample` 或任意 PDF）成功，列表出现书卡
- [ ] 进入阅读器，单页 canvas 渲染出真实文字像素（非空白页）
- [ ] 翻页 / 缩放 / 连续滚动正常，虚拟化只渲染视口附近页面
- [ ] 大 PDF 可打开（后端 Range 206 按需加载，无整包下载卡死）

## AI 助手与数据持久化

- [ ] 设置页配置 base_url / model / key（key 留空表示沿用已存值）后，新对话即用新配置
- [ ] 框选一页区域 → 弹出快捷动作（翻译 / 解释 / 摘抄 / 高亮）
- [ ] 「翻译」：AI 图文流式返回译文（SSE 打字机效果）
- [ ] 「摘抄」：结果落库，右侧笔记面板出现记录
- [ ] 「高亮」：页面上出现高亮块，重开书籍后仍在
- [ ] 聊天消息持久化：发送若干消息 → 关闭并重开应用 → 重开同一本书，历史会话与完整消息恢复
- [ ] 切换会话（左侧会话列表）加载对应历史

## 配置与设置

- [ ] 设置页显示当前 DB 模式（SQLite 降级时可见标记）
- [ ] 改动设置立即生效（不重启即可用于新对话）

## 退出清理

- [ ] Cmd+Q 退出后无孤儿进程：`pgrep -fl 'server.js'` 为空（后端随主进程 SIGTERM 退出）
- [ ] 重新启动不冲突：单实例锁生效，或重复启动只激活已有窗口

## 双架构（可选，CI/发布前）

- [ ] `node scripts/release.mjs --arch=arm64 --arch=x64` 两包均产出；x64 包在 Intel 机器/ Rosetta 上启动正常
