<template>
  <div class="cover-box">
    <img
      v-show="state !== 'fail'"
      ref="imgRef"
      :src="coverUrl"
      :alt="title"
      class="cover-img"
      :class="{ dim: state === 'loading' }"
      @load="onLoad"
      @error="onError"
    >
    <el-icon
      v-if="state === 'loading'"
      class="cover-state cover-loading"
      :size="36"
    >
      <Loading />
    </el-icon>
    <el-icon
      v-else-if="state === 'fail'"
      class="cover-state cover-fallback"
      :size="56"
    >
      <Document />
    </el-icon>
    <!-- V2.5：底部细进度条（0–100 或 null 隐藏；null = pageCount 未知不误导） -->
    <div
      v-if="progress != null"
      class="cover-progress"
      data-test="cover-progress"
    >
      <div
        class="cover-progress-fill"
        :style="{ width: fillWidth }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Document, Loading } from '@element-plus/icons-vue'
import { bookCoverUrl } from '@/api/client'

const props = defineProps<{ bookId: number; title: string; progress?: number | null }>()

/** 填充宽度：clamp 0–100（lastPage 偶发超过 pageCount 时封顶，避免条溢出） */
const fillWidth = computed(() => `${Math.max(0, Math.min(100, props.progress ?? 0))}%`)

type CoverState = 'loading' | 'ok' | 'fail'
const state = ref<CoverState>('loading')
/** 自动重试次数：首载失败带缓存失效参数重发一次，消除「后端首次懒生成/瞬时失败」把封面钉在占位图 */
const attempt = ref(0)
/** 尝试数 >0 时追加时间戳参数绕过浏览器对旧失败/旧资源的缓存 */
const coverUrl = computed(() => {
  const u = bookCoverUrl(props.bookId)
  return attempt.value === 0 ? u : `${u}?t=${Date.now()}`
})

/** 兜底：挂载后若图片已就绪（浏览器缓存同步命中时 load 可能先于监听绑定）直接置 ok */
const imgRef = ref<HTMLImageElement | null>(null)
onMounted(() => {
  const img = imgRef.value
  if (img && img.complete && img.naturalWidth > 0) state.value = 'ok'
})

/** 兜底：懒生成慢（大扫描件 sips 秒级）/后端临时不可达 → 超时先显示占位，图片真正到达后 @load 自行顶替 */
const FAIL_TIMEOUT_MS = 8000
let failTimer: ReturnType<typeof setTimeout> | undefined
onMounted(() => {
  failTimer = setTimeout(() => {
    if (state.value === 'loading') state.value = 'fail'
  }, FAIL_TIMEOUT_MS)
})
onBeforeUnmount(() => clearTimeout(failTimer))

function onLoad(): void {
  state.value = 'ok'
}

function onError(): void {
  if (attempt.value === 0) {
    // 重试：url 带 ?t= 强制重新请求（后端封面可能刚生成完成 / 前次网络瞬时失败）
    attempt.value = 1
    state.value = 'loading'
  } else {
    state.value = 'fail'
  }
}
</script>

<style scoped>
.cover-box {
  position: relative;
  height: 240px;
  margin-bottom: 10px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.cover-img {
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.28);
  border-radius: 2px;
}
/* 加载中让封面略微退隐，聚焦到 spinner（图片到达后 @load 即移除该态，无残留占位） */
.cover-img.dim {
  opacity: 0.55;
}
.cover-state {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  border-radius: 50%;
  padding: 4px;
  z-index: 2;
}
.cover-loading {
  animation: spin 1s linear infinite;
}
.cover-fallback {
  color: var(--el-text-color-placeholder);
}
/* 旋转必须保留 translate 居中，否则动画覆盖 transform 会甩到左上角 */
@keyframes spin {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}
/* V2.5：封面底部细进度条 —— 轨道低调、填充用主题主色，暗/浅主题自适应 */
.cover-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 4px;
  background: var(--el-fill-color-darker);
  z-index: 2;
}
.cover-progress-fill {
  height: 100%;
  background: var(--el-color-primary);
  transition: width 0.2s ease;
}
</style>
