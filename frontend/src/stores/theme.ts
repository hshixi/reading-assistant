/**
 * 主题 store（V2-F1）：浅色/暗色切换，默认暗色。
 *
 * 实现：给 <html> 加/去 `dark` class，Element Plus 的暗色 css-vars
 * （element-plus/theme-chalk/dark/css-vars.css，main.ts 已引入）在 .dark 下
 * 覆盖 --el-* 变量，组件无需改动即可跟随。
 * 选择持久化到 localStorage（渲染层本地偏好，非敏感数据，不需走后端）。
 */
import { defineStore } from 'pinia'

const THEME_KEY = 'ui.theme'

export type ThemeMode = 'dark' | 'light'

/** 读取持久化主题；无记录时默认暗色（产品决策 #1） */
export function readTheme(): ThemeMode {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

/** 同步切换 <html> 上的 dark class（渲染前调用一次可防首帧浅色闪烁） */
export function applyThemeClass(mode: ThemeMode): void {
  document.documentElement.classList.toggle('dark', mode === 'dark')
}

export const useThemeStore = defineStore('theme', {
  state: () => ({ mode: readTheme() as ThemeMode }),
  actions: {
    toggle(): void {
      this.mode = this.mode === 'dark' ? 'light' : 'dark'
      this.persist()
    },
    persist(): void {
      try {
        localStorage.setItem(THEME_KEY, this.mode)
      } catch {
        /* 忽略存储异常 */
      }
      applyThemeClass(this.mode)
    },
  },
})
