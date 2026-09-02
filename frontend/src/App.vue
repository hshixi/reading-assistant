<template>
  <div class="app-shell">
    <template v-if="ready">
      <router-view />
    </template>
    <template v-else>
      <div class="backend-wait">
        <el-alert
          v-if="backendError"
          :title="`后端连接失败：${backendError}`"
          type="error"
          :closable="false"
          show-icon
          class="backend-alert"
        />
        <template v-if="backendError">
          <el-button
            type="primary"
            @click="connect"
          >
            重试
          </el-button>
        </template>
        <template v-else>
          <el-skeleton
            :rows="1"
            animated
            class="backend-skeleton"
          />
          <p class="backend-loading">
            正在启动本地服务…
          </p>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { initApi, checkHealth } from '@/api/client'

const ready = ref(false)
const backendError = ref('')

async function connect(): Promise<void> {
  ready.value = false
  backendError.value = ''
  try {
    await initApi()
    await checkHealth()
    console.info('[app] 后端已连接')
    ready.value = true
  } catch (err) {
    backendError.value = err instanceof Error ? err.message : String(err)
    console.warn('[app] 后端连接失败:', err)
  }
}

onMounted(() => void connect())
</script>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
  /* V2.1-P5：锁死文档级滚动 —— 整页只能由各视图内部滚动容器滚动
     （PDF 区 .pdf-viewer / 书架 / 设置页 / 右侧消息列表），杜绝外壳整体上下滑 */
  overflow: hidden;
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
  overflow: hidden;
}

.backend-wait {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.backend-alert {
  width: 60%;
}

.backend-skeleton {
  width: 240px;
}

.backend-loading {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}
</style>
