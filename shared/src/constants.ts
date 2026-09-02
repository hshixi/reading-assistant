/** AI 快捷动作类型 */
export const ACTION_TYPES = ['translate', 'explain', 'note', 'highlight'] as const
export type ActionType = (typeof ACTION_TYPES)[number]

export const ACTION_LABELS: Record<ActionType, string> = {
  translate: '翻译',
  explain: '解释',
  note: '笔记',
  highlight: '高亮',
}

/** 默认 AI 配置（存在 app_settings，用户可覆盖） */
export const DEFAULT_AI_SETTINGS = {
  aiBaseUrl: 'https://api.deepseek.com',
  aiModel: 'deepseek-v4-flash-vision-exp',
  aiMaxTokens: '4096',
  aiTemperature: '0.3',
} as const

/** app_settings 表常用 key */
export const SETTINGS_KEYS = {
  AI_BASE_URL: 'aiBaseUrl',
  AI_API_KEY: 'aiApiKey',
  AI_MODEL: 'aiModel',
  AI_MAX_TOKENS: 'aiMaxTokens',
  AI_TEMPERATURE: 'aiTemperature',
  DB_MODE: 'dbMode', // 'mysql' | 'sqlite'
  SCHEMA_VERSION: 'schemaVersion',
} as const
