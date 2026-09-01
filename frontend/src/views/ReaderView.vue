<template>
  <div class="reader">
    <el-empty description="PDF 阅读器开发中（M5 接入 pdf.js）" />
  </div>
</template>

<script setup lang="ts">
// M5 起通过 useRoute().params.bookId 加载 PDF 与聊天会话
</script>

<style scoped>
.reader {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
