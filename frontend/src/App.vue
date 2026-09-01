<template>
  <div class="app-shell">
    <el-alert
      v-if="backendError"
      :title="`后端连接失败：${backendError}`"
      type="error"
      :closable="false"
      show-icon
      class="backend-alert"
    />
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { initApi, checkHealth } from '@/api/client'

const backendError = ref<string>('')

onMounted(async () => {
  try {
    await initApi()
    await checkHealth()
    console.info('[app] 后端已连接')
  } catch (err) {
    backendError.value = err instanceof Error ? err.message : String(err)
    console.warn('[app] 后端连接失败:', err)
  }
})
</script>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
  font-family:
    -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', Helvetica, Arial,
    sans-serif;
  -webkit-font-smoothing: antialiased;
  background: var(--el-bg-color-page, #f5f7fa);
}

.app-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.backend-alert {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  width: 60%;
}
</style>
