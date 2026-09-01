/** 路径解析：应用数据目录、前端构建产物等。 */
import path from 'node:path'
import { app } from 'electron'

/** 用户数据根目录（book 文件、media、sqlite 均在其下） */
export function userDataDir(): string {
  return app.getPath('userData')
}

/** 前端构建产物目录（prod 模式 BrowserWindow 加载此处的 index.html） */
export function frontendDistDir(): string {
  // electron/dist/main.js → 仓库根 → frontend/dist
  return path.join(__dirname, '..', '..', 'frontend', 'dist')
}

/** 后端进程要写入的端口握手文件 */
export function backendPortFile(): string {
  return path.join(userDataDir(), 'backend.port')
}
