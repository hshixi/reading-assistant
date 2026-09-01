<template>
  <router-view />
</template>

<script setup lang="ts">
// 应用外壳：后续接入三栏布局（书架 / 阅读器 / 聊天面板）
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
</style>
