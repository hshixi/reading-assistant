/**
 * 后端环境配置。开发环境由 .env 提供；生产环境由 Electron 主进程注入 env 或默认值。
 * 该文件只负责"读取配置"，不含业务逻辑。
 */
import path from 'node:path'
import os from 'node:os'

export type DatabaseDriver = 'mysql' | 'sqlite' | 'auto'

export interface AppConfig {
  nodeEnv: string
  host: string
  port: number

  /** 数据库驱动：mysql | sqlite | auto（探测失败自动退回 sqlite） */
  dbDriver: DatabaseDriver
  /** 数据根目录：sqlite 数据库文件、books/、media/ 都在其下 */
  dataDir: string

  // MySQL 连接参数（dbDriver=mysql 时使用）
  dbHost: string
  dbPort: number
  dbUser: string
  dbPassword: string
  dbName: string

  // AI（默认值；可被 app_settings 覆盖）
  aiBaseUrl: string
  aiApiKey: string
  aiModel: string
  aiMaxTokens: number
  aiTemperature: number
}

function env(key: string, fallback = ''): string {
  return process.env[key] ?? fallback
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  return Number.isNaN(n) ? fallback : n
}

function envFloat(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const n = Number.parseFloat(raw)
  return Number.isNaN(n) ? fallback : n
}

/** 数据根目录解析优先级：env DATA_DIR > Electron userData > ~/.reading-assistant */
function resolveDataDir(): string {
  if (process.env.DATA_DIR) return path.resolve(process.env.DATA_DIR)
  if (process.env.READING_APP_DATA_DIR) return process.env.READING_APP_DATA_DIR
  return path.join(os.homedir(), '.reading-assistant')
}

export function loadConfig(): AppConfig {
  // 加载 backend/.env（存在时）。Node >= 21.7 原生支持，无额外依赖。
  try {
    process.loadEnvFile(path.resolve(__dirname, '..', '.env'))
  } catch {
    // .env 不存在则忽略，走环境变量/默认值
  }

  const dbDriverRaw = (env('DATABASE_DRIVER', 'sqlite') || 'sqlite').toLowerCase()
  const dbDriver: DatabaseDriver =
    dbDriverRaw === 'mysql' || dbDriverRaw === 'auto' ? dbDriverRaw : 'sqlite'

  return {
    nodeEnv: env('NODE_ENV', 'development'),
    host: env('HOST', '127.0.0.1'),
    port: envInt('PORT', 8787),
    dbDriver,
    dataDir: resolveDataDir(),
    dbHost: env('DB_HOST', '127.0.0.1'),
    dbPort: envInt('DB_PORT', 3306),
    dbUser: env('DB_USER', 'root'),
    dbPassword: env('DB_PASSWORD', ''),
    dbName: env('DB_NAME', 'reading_assistant'),
    aiBaseUrl: env('AI_BASE_URL', 'https://api.deepseek.com'),
    aiApiKey: env('AI_API_KEY', ''),
    aiModel: env('AI_MODEL', 'deepseek-v4-flash-vision-exp'),
    aiMaxTokens: envInt('AI_MAX_TOKENS', 4096),
    aiTemperature: envFloat('AI_TEMPERATURE', 0.3),
  }
}
