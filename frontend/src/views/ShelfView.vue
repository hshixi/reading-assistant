<template>
  <div class="shelf">
    <h1>Reading Assistant</h1>
    <el-empty description="书架功能开发中（M4 接入书籍上传/列表）" />
  </div>
</template>

<script setup lang="ts">
// 书架：导入 PDF + 书籍列表。M4 里程碑接入后端 API。
</script>

<style scoped>
.shelf {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}
h1 {
  color: var(--el-text-color-primary);
}
</style>
