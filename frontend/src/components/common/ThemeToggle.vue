<template>
  <el-button
    :title="theme.mode === 'dark' ? '切换到浅色' : '切换到暗色'"
    text
    circle
    data-test="theme-toggle"
    @click="theme.toggle()"
  >
    <el-icon :size="17">
      <Sunny v-if="theme.mode === 'light'" />
      <Moon v-else />
    </el-icon>
  </el-button>
</template>

<script setup lang="ts">
import { Moon, Sunny } from '@element-plus/icons-vue'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()
</script>
