<template>
  <div class="page-container">
    <div class="action-bar">
      <h2 class="page-title" style="margin: 0; border: none; padding: 0;">赛事管理</h2>
      <div class="action-bar-right">
        <el-button type="primary" @click="showCreateDialog = true">
          <el-icon><Plus /></el-icon>
          新建赛事
        </el-button>
      </div>
    </div>

    <el-empty v-if="sessions.length === 0 && !loading" description="暂无赛事，请创建新赛事">
      <el-button type="primary" @click="showCreateDialog = true">创建赛事</el-button>
    </el-empty>

    <div v-else class="sessions-list">
      <el-card v-for="session in sessions" :key="session.id" class="session-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <div class="session-info-main">
              <span class="session-name">{{ session.name || session.eventName || '未命名赛事' }}</span>
              <el-tag :type="getStatusTagType(session.status)" size="small">
                {{ getStatusLabel(session.status) }}
              </el-tag>
            </div>
            <div class="session-actions">
              <el-button size="small" @click="handleSelectSession(session)">
                {{ currentSessionId === session.id ? '当前选中' : '选择此赛事' }}
              </el-button>
              <el-button type="primary" size="small" @click="handleSelectSession(session); router.push('/import')" v-if="currentSessionId !== session.id">
                进入
              </el-button>
            </div>
          </div>
        </template>

        <el-descriptions :column="4" border size="small">
          <el-descriptions-item label="赛事名称">
            {{ session.eventName || session.name || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="比赛地点">
            {{ session.location || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="比赛日期">
            {{ session.date ? formatDate(session.date) : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ session.createdAt ? formatDateTime(session.createdAt) : '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>
    </div>

    <el-dialog v-model="showCreateDialog" title="新建赛事" width="500px">
      <el-form :model="newSessionForm" label-width="100px">
        <el-form-item label="赛事名称" required>
          <el-input v-model="newSessionForm.name" placeholder="请输入赛事名称" />
        </el-form-item>
        <el-form-item label="比赛日期" required>
          <el-date-picker
            v-model="newSessionForm.date"
            type="date"
            placeholder="请选择比赛日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="比赛地点">
          <el-input v-model="newSessionForm.location" placeholder="请输入比赛地点" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreateSession">
          创建
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import type { Session } from '@/types'
import { useAppStore } from '@/stores'

const router = useRouter()
const appStore = useAppStore()

const sessions = ref<Session[]>([])
const loading = ref(false)
const creating = ref(false)
const showCreateDialog = ref(false)
const currentSessionId = ref<string | null>(null)

const newSessionForm = ref({
  name: '',
  date: '',
  location: '',
})

function formatDate(isoString: string): string {
  if (!isoString) return '-'
  const date = new Date(isoString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function formatDateTime(isoString: string): string {
  if (!isoString) return '-'
  const date = new Date(isoString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatusTagType(status: Session['status']): string {
  switch (status) {
    case 'importing': return 'info'
    case 'checking': return 'warning'
    case 'reviewing': return ''
    case 'exported': return 'success'
    default: return 'info'
  }
}

function getStatusLabel(status: Session['status']): string {
  switch (status) {
    case 'importing': return '数据导入中'
    case 'checking': return '风险检测中'
    case 'reviewing': return '复核中'
    case 'exported': return '已导出'
    default: return '未知'
  }
}

async function loadSessions(): Promise<void> {
  loading.value = true
  await appStore.loadSessions()
  sessions.value = [...appStore.sessions]
  currentSessionId.value = appStore.currentSessionId
  loading.value = false
}

function handleSelectSession(session: Session): void {
  appStore.selectSession(session.id)
  currentSessionId.value = session.id
  ElMessage.success(`已选择赛事: ${session.name || session.eventName}`)
}

async function handleCreateSession(): Promise<void> {
  if (!newSessionForm.value.name) {
    ElMessage.warning('请输入赛事名称')
    return
  }
  if (!newSessionForm.value.date) {
    ElMessage.warning('请选择比赛日期')
    return
  }

  creating.value = true
  try {
    await appStore.createNewSession({
      date: newSessionForm.value.date,
      name: newSessionForm.value.name,
      eventName: newSessionForm.value.name,
      location: newSessionForm.value.location,
      status: 'importing',
    })
    ElMessage.success('赛事创建成功')
    showCreateDialog.value = false
    newSessionForm.value = { name: '', date: '', location: '' }
    await loadSessions()
    router.push('/import')
  } catch (err) {
    ElMessage.error(`创建失败: ${(err as Error).message}`)
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  loadSessions()
})
</script>

<style scoped>
.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.session-card {
  transition: all 0.3s;
}

.session-card:hover {
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.session-info-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.session-name {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.session-actions {
  display: flex;
  gap: 8px;
}
</style>
