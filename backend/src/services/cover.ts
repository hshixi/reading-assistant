/**
 * PDF 首页封面生成（懒生成 + 磁盘缓存）。
 *
 * 用 macOS 内置 QuickLook 命令行 `qlmanage -t` 生成 PDF 首页缩略图 —— 本应用仅面向
 * macOS，无原生依赖、不影响 electron-builder 打包。
 *
 * 为什么不用 sips：实测 sips `-s format png` 栅格化部分 PDF 时整页为全透明（alpha=0），
 * 输出 JPEG 则整页纯白 —— 该 PDF 内容根本没被绘制，书架上只会看到占位。QuickLook 的
 * PDF 缩略图渲染则正确（实测 13MB/441 页 PDF 约 0.15s 出 900px 不透明封面）。
 *
 * qlmanage 产物命名固定为 `<输入文件名>.png`，因此先在封面同目录建唯一临时子目录，
 * 渲染完成后把产物原子 rename 到目标 cover.png —— 并发多请求只会有一次写入生效，
 * 失败时目录整体清理，不留半成品。
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const execFileAsync = promisify(execFile)

const QLMANAGE = '/usr/bin/qlmanage'
/** 长边像素：书架卡片约 220px 宽、@2x Retina 下 900px 足够清晰且文件很小 */
const COVER_MAX_EDGE = '900'
const QL_TIMEOUT_MS = 30_000

export async function renderPdfCover(originalPath: string, destPath: string): Promise<void> {
  const dir = path.dirname(destPath)
  const workDir = path.join(dir, `.cover-${process.pid}-${crypto.randomBytes(4).toString('hex')}.tmpdir`)
  fs.mkdirSync(workDir, { recursive: true })
  try {
    await execFileAsync(
      QLMANAGE,
      ['-t', '-s', COVER_MAX_EDGE, '-o', workDir, originalPath],
      { timeout: QL_TIMEOUT_MS },
    )
    const produced = path.join(workDir, `${path.basename(originalPath)}.png`)
    if (!fs.existsSync(produced)) throw new Error('qlmanage 未产出封面文件')
    await fs.promises.rename(produced, destPath)
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true })
  }
}
