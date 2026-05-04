<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const sessionStore = useSessionStore()

const showCreateDialog = ref(false)
const newSessionDate = ref(new Date().toISOString().split('T')[0])
const newSessionName = ref('')
const isLoading = ref(false)

const sortedSessions = computed(() => {
  return sessionStore.sessions.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
})

onMounted(async () => {
  await sessionStore.loadSessions()
})

async function createNewSession() {
  if (!newSessionDate.value) {
    ElMessage.warning('请选择日期')
    return
  }

  isLoading.value = true
  try {
    const session = await sessionStore.createSession(
      newSessionDate.value,
      newSessionName.value || undefined
    )
    showCreateDialog.value = false
    ElMessage.success('会话创建成功')
    router.push(`/session/${session.id}/import`)
  } catch (error) {
    ElMessage.error(`创建失败: ${(error as Error).message}`)
  } finally {
    isLoading.value = false
  }
}

function openSession(sessionId: string) {
  router.push(`/session/${sessionId}/import`)
}

async function deleteSession(sessionId: string, event: Event) {
  event.stopPropagation()
  
  try {
    await ElMessageBox.confirm(
      '确定要删除这个会话吗？所有相关数据将被永久删除。',
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    await sessionStore.deleteSession(sessionId)
    ElMessage.success('删除成功')
  } catch {
    // 用户取消或删除失败
  }
}

function getStatusBadge(status: string) {
  const map: Record<string, { text: string; type: string }> = {
    importing: { text: '数据导入', type: 'info' },
    checking: { text: '检测中', type: 'warning' },
    reviewing: { text: '复核中', type: 'primary' },
    exported: { text: '已导出', type: 'success' },
  }
  return map[status] || { text: status, type: 'info' }
}
</script>

<template>
  <div class="home-view">
    <header class="header">
      <div class="header-content">
        <h1 class="title">🗺️ 野外地质样品预检工具</h1>
        <p class="subtitle">每日收工后自动检测样品异常，支持队长复核改判</p>
      </div>
    </header>

    <main class="main-content page-container">
      <div class="action-bar">
        <el-button type="primary" size="large" @click="showCreateDialog = true">
          <el-icon><Plus /></el-icon>
          新建今日检查
        </el-button>
      </div>

      <el-card v-if="sortedSessions.length > 0" class="sessions-card">
        <template #header>
          <span class="card-title">历史会话</span>
          <span class="card-subtitle">共 {{ sortedSessions.length }} 个会话</span>
        </template>

        <el-table :data="sortedSessions" style="width: 100%" @row-click="openSession">
          <el-table-column prop="name" label="会话名称" min-width="200">
            <template #default="{ row }">
              <div class="session-name">
                <strong>{{ row.name }}</strong>
                <span class="session-id">{{ row.id.slice(0, 8) }}...</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="date" label="日期" width="120" />
          <el-table-column prop="status" label="状态" width="120">
            <template #default="{ row }">
              <el-tag :type="getStatusBadge(row.status).type as any">
                {{ getStatusBadge(row.status).text }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建时间" width="180">
            <template #default="{ row }">
              {{ new Date(row.createdAt).toLocaleString('zh-CN') }}
            </template>
          </el-table-column>
          <el-table-column prop="updatedAt" label="更新时间" width="180">
            <template #default="{ row }">
              {{ new Date(row.updatedAt).toLocaleString('zh-CN') }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button 
                type="danger" 
                size="small" 
                link
                @click="deleteSession(row.id, $event)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-empty v-else description="还没有任何会话，点击上方按钮开始创建">
        <el-button type="primary" @click="showCreateDialog = true">
          创建第一个会话
        </el-button>
      </el-empty>
    </main>

    <el-dialog
      v-model="showCreateDialog"
      title="新建检查会话"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form label-position="top" :model="{ date: newSessionDate, name: newSessionName }">
        <el-form-item label="检查日期">
          <el-date-picker
            v-model="newSessionDate"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="会话名称（可选）">
          <el-input
            v-model="newSessionName"
            placeholder="例如：第一工区收工检查"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="isLoading" @click="createNewSession">
          创建并开始
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.home-view {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.header {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 30px 20px;
}

.title {
  font-size: 28px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px 0;
}

.subtitle {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

.main-content {
  padding-top: 30px;
}

.action-bar {
  margin-bottom: 20px;
}

.card-title {
  font-weight: 600;
  font-size: 16px;
}

.card-subtitle {
  margin-left: 12px;
  color: #909399;
  font-size: 14px;
}

.session-name {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.session-id {
  font-size: 12px;
  color: #909399;
  font-family: monospace;
}

:deep(.el-table__row) {
  cursor: pointer;
}

:deep(.el-table__row:hover > td) {
  background-color: #ecf5ff !important;
}
</style>
