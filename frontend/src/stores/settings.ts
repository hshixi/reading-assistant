/**
 * 设置 store（M12）：AI 配置。后端每次请求实时读取 app_settings，
 * 因此保存后新对话立即生效，本 store 仅承载设置页展示数据。
 */
import { defineStore } from 'pinia'
import type { SettingsDto, SettingsPatch } from '@reading/shared'
import { getSettings, updateSettings } from '@/api/settings'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    loaded: false,
    aiBaseUrl: '',
    aiModel: '',
    aiMaxTokens: 4096,
    aiTemperature: 0.3,
    aiApiKeySet: false,
    dbMode: 'sqlite',
    schemaVersion: '',
  }),
  actions: {
    async load(): Promise<void> {
      const s = await getSettings()
      this.apply(s)
      this.loaded = true
    },
    apply(s: SettingsDto): void {
      this.aiBaseUrl = s.aiBaseUrl
      this.aiModel = s.aiModel
      this.aiMaxTokens = s.aiMaxTokens
      this.aiTemperature = s.aiTemperature
      this.aiApiKeySet = s.aiApiKeySet
      this.dbMode = s.dbMode
      this.schemaVersion = s.schemaVersion
    },
    async save(patch: SettingsPatch): Promise<void> {
      const s = await updateSettings(patch)
      this.apply(s)
    },
  },
})
