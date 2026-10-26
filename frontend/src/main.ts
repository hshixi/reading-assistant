import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
// V2-F1 暗色主题：html.dark 下覆盖 --el-* 变量（默认暗色）
import 'element-plus/theme-chalk/dark/css-vars.css'
// 数学公式排版（KaTeX）+ Markdown 正文样式（聊天 / 笔记共用）
import 'katex/dist/katex.min.css'
import './styles/markdown.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import App from './App.vue'
import router from './router'
import { applyThemeClass, readTheme } from './stores/theme'

// 首帧渲染前先落 dark class，避免启动瞬间浅色闪烁
applyThemeClass(readTheme())

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })

app.mount('#app')
