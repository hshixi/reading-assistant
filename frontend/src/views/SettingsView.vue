<template>
  <div class="settings">
    <div class="settings-inner">
      <header class="settings-header">
        <el-button
          link
          @click="$router.push('/')"
        >
          <el-icon><ArrowLeft /></el-icon>
          <span>书架</span>
        </el-button>
        <h2>设置</h2>
      </header>

      <el-form
        v-loading="loading"
        label-width="140px"
        label-position="left"
        class="settings-form"
      >
        <div class="form-section-title">
          AI 配置
        </div>

        <el-form-item label="服务地址">
          <el-input
            v-model="form.aiBaseUrl"
            placeholder="https://api.deepseek.com"
            clearable
          />
        </el-form-item>

        <el-form-item label="API Key">
          <el-input
            v-model="apiKeyInput"
            type="password"
            :placeholder="aiApiKeySet ? '已配置（留空保持不变）' : 'sk-…'"
            show-password
            autocomplete="off"
          />
          <div class="form-hint">
            仅保存在本机后端，不会发送到页面或日志
          </div>
        </el-form-item>

        <el-form-item label="模型">
          <el-input
            v-model="form.aiModel"
            placeholder="deepseek-v4-flash-vision-exp"
            clearable
          />
        </el-form-item>

        <el-form-item label="最大 Token">
          <el-input-number
            v-model="form.aiMaxTokens"
            :min="1"
            :max="65536"
            :step="512"
          />
        </el-form-item>

        <el-form-item label="温度">
          <el-input-number
            v-model="form.aiTemperature"
            :min="0"
            :max="2"
            :step="0.1"
            :precision="1"
          />
        </el-form-item>

        <div class="form-section-title">
          存储
        </div>
        <el-form-item label="数据库模式">
          <div class="db-mode">
            <el-tag
              :type="dbMode === 'sqlite' ? 'info' : 'success'"
              effect="plain"
            >
              {{ dbMode === 'mysql' ? 'MySQL' : 'SQLite' }}
            </el-tag>
            <span class="form-hint">
              {{ dbMode === 'sqlite' ? '内嵌数据库，开箱即用' : '连接外部 MySQL 服务器' }}
            </span>
          </div>
        </el-form-item>

        <div class="form-actions">
          <el-button
            type="primary"
            :loading="saving"
            :disabled="!loaded"
            @click="save"
          >
            保存
          </el-button>
          <el-button @click="reload">
            重置为已保存值
          </el-button>
        </div>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { useSettingsStore } from '@/stores/settings'

const store = useSettingsStore()

const loading = ref(false)
const saving = ref(false)
const loaded = ref(false)
const aiApiKeySet = ref(false)
const apiKeyInput = ref('')
const dbMode = ref('sqlite')

const form = reactive({
  aiBaseUrl: '',
  aiModel: '',
  aiMaxTokens: 4096,
  aiTemperature: 0.3,
})

async function load(): Promise<void> {
  loading.value = true
  try {
    await store.load()
    form.aiBaseUrl = store.aiBaseUrl
    form.aiModel = store.aiModel
    form.aiMaxTokens = store.aiMaxTokens
    form.aiTemperature = store.aiTemperature
    aiApiKeySet.value = store.aiApiKeySet
    dbMode.value = store.dbMode
    apiKeyInput.value = ''
    loaded.value = true
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    loading.value = false
  }
}

async function save(): Promise<void> {
  saving.value = true
  try {
    await store.save({
      aiBaseUrl: form.aiBaseUrl.trim() || undefined,
      aiModel: form.aiModel.trim() || undefined,
      aiMaxTokens: form.aiMaxTokens,
      aiTemperature: form.aiTemperature,
      // 非空才写入，留空 = 保持不变
      aiApiKey: apiKeyInput.value.trim() || undefined,
    })
    apiKeyInput.value = ''
    ElMessage.success('已保存，新对话将立即使用新配置')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : String(err))
  } finally {
    saving.value = false
  }
}

function reload(): void {
  void load()
}

onMounted(load)
</script>

<style scoped>
.settings {
  height: 100%;
  overflow: auto;
  background: var(--el-fill-color-lighter, #f5f6f7);
}
.settings-inner {
  max-width: 620px;
  margin: 0 auto;
  padding: 16px 24px 40px;
}
.settings-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.settings-header h2 {
  margin: 0;
  font-size: 18px;
  color: var(--el-text-color-primary);
}
.settings-form {
  margin-top: 12px;
  background: var(--el-bg-color);
  padding: 20px 20px 12px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
}
.form-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  margin: 8px 0 4px;
  padding-left: 140px;
  box-sizing: border-box;
}
.form-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  margin-left: 8px;
}
.db-mode {
  display: flex;
  align-items: center;
}
.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
</style>
