/**
 * 设置 API（M12）：AI 配置读写。key 绝不下发渲染层，仅返回是否已配置。
 */
import type { SettingsDto, SettingsPatch } from '@reading/shared'
import { ApiPaths, baseUrl, parseApiError } from './client'

export async function getSettings(): Promise<SettingsDto> {
  const res = await fetch(`${baseUrl()}${ApiPaths.settings}`)
  if (!res.ok) throw await parseApiError(res)
  return res.json()
}

export async function updateSettings(patch: SettingsPatch): Promise<SettingsDto> {
  const res = await fetch(`${baseUrl()}${ApiPaths.settings}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw await parseApiError(res)
  return res.json()
}
