<template>
  <div class="session-list">
    <div
      v-for="s in store.sessions"
      :key="s.id"
      class="session-item"
      :class="{ active: s.id === store.activeSessionId }"
      @click="store.openSession(s.id)"
    >
      <div class="session-info">
        <div class="session-title">
          {{ s.title || '新对话' }}
        </div>
        <div class="session-meta">
          {{ s.messageCount ?? 0 }} 条消息
        </div>
      </div>
      <el-dropdown
        trigger="click"
        @click.stop
        @command="(cmd: string) => onCmd(cmd, s.id)"
      >
        <span class="session-more"><el-icon><MoreFilled /></el-icon></span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="rename">
              重命名
            </el-dropdown-item>
            <el-dropdown-item
              command="delete"
              divided
            >
              删除会话
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { MoreFilled } from '@element-plus/icons-vue'
import { useChatStore } from '@/stores/chat'
import { deleteSession, renameSession } from '@/api/chat'

const store = useChatStore()

async function onCmd(cmd: string, sessionId: number): Promise<void> {
  if (cmd === 'rename') {
    const target = store.sessions.find((x) => x.id === sessionId)
    const { value } = await ElMessageBox.prompt('输入新的会话标题', '重命名会话', {
      inputValue: target?.title || '',
      inputPlaceholder: '会话标题',
      inputValidator: (v: string) => (v && v.trim() ? true : '标题不能为空'),
    })
    await renameSession(sessionId, value.trim())
    ElMessage.success('已重命名')
    void store.refreshSessions()
  } else if (cmd === 'delete') {
    await ElMessageBox.confirm('删除后该会话及其全部消息不可恢复，确定删除？', '删除会话', {
      type: 'warning',
      confirmButtonText: '删除',
    })
    await deleteSession(sessionId)
    if (store.activeSessionId === sessionId) {
      // 删除的是当前会话：清空并重新选中最近会话
      store.activeSessionId = null
      store.messages = []
      if (store.bookId) void store.loadSessions(store.bookId)
    } else {
      void store.refreshSessions()
    }
    ElMessage.success('已删除')
  }
}
</script>

<style scoped>
.session-list {
  padding: 4px;
  min-width: 200px;
}
.session-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.session-item:hover {
  background: var(--el-fill-color-light);
}
.session-item.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.session-info {
  flex: 1;
  min-width: 0;
}
.session-title {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.session-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.session-more {
  display: flex;
  align-items: center;
  color: var(--el-text-color-secondary);
  border-radius: 4px;
  padding: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}
.session-item:hover .session-more {
  opacity: 1;
}
</style>
