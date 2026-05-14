<template>
  <div class="execution-logs">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>执行日志列表</span>
          <el-button type="primary" @click="loadLogs" :loading="loading">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>

      <el-table :data="logs" v-loading="loading" stripe border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="迁移脚本" width="150">
          <template #default="{ row }">
            <el-button type="text" @click="goToDetail(row.migration_id)">
              查看脚本 #{{ row.migration_id }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column prop="execution_type" label="执行类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getTypeColor(row.execution_type)">
              {{ getTypeText(row.execution_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusColor(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="executed_by" label="执行人" width="120" />
        <el-table-column prop="started_at" label="开始时间" width="180">
          <template #default="{ row }">{{ formatDate(row.started_at) }}</template>
        </el-table-column>
        <el-table-column prop="completed_at" label="结束时间" width="180">
          <template #default="{ row }">{{ formatDate(row.completed_at) }}</template>
        </el-table-column>
        <el-table-column prop="duration_seconds" label="耗时(秒)" width="100" />
        <el-table-column prop="affected_rows" label="影响行数" width="100" />
        <el-table-column prop="parent_log_id" label="父日志ID" width="100" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="viewLog(row)">
              详情
            </el-button>
            <el-button
              v-if="row.status === 'success' || row.status === 'failed'"
              type="success"
              size="small"
              @click="replayLog(row)"
            >
              回放
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="detailDialogVisible" title="日志详情" width="800px">
      <el-descriptions :column="2" border v-if="currentLog">
        <el-descriptions-item label="日志ID">{{ currentLog.id }}</el-descriptions-item>
        <el-descriptions-item label="执行类型">
          <el-tag :type="getTypeColor(currentLog.execution_type)">
            {{ getTypeText(currentLog.execution_type) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusColor(currentLog.status)">
            {{ getStatusText(currentLog.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="执行人">{{ currentLog.executed_by || '-' }}</el-descriptions-item>
        <el-descriptions-item label="开始时间">{{ formatDate(currentLog.started_at) }}</el-descriptions-item>
        <el-descriptions-item label="结束时间">{{ formatDate(currentLog.completed_at) }}</el-descriptions-item>
        <el-descriptions-item label="耗时(秒)">{{ currentLog.duration_seconds || '-' }}</el-descriptions-item>
        <el-descriptions-item label="影响行数">{{ currentLog.affected_rows || '-' }}</el-descriptions-item>
      </el-descriptions>
      
      <el-divider content-position="left">脚本内容</el-divider>
      <el-input
        :model-value="currentLog?.script_content"
        type="textarea"
        :rows="6"
        readonly
      />
      
      <el-divider content-position="left">执行输出</el-divider>
      <el-input
        :model-value="currentLog?.output"
        type="textarea"
        :rows="4"
        readonly
      />
      
      <el-divider content-position="left" v-if="currentLog?.error_message">错误信息</el-divider>
      <el-alert
        v-if="currentLog?.error_message"
        :title="currentLog.error_message"
        type="error"
        show-icon
      />
      
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button
          v-if="currentLog && (currentLog.status === 'success' || currentLog.status === 'failed')"
          type="primary"
          @click="replayLog(currentLog)"
        >
          回放执行
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { useMigrationStore } from '@/stores/migration'

const router = useRouter()
const migrationStore = useMigrationStore()

const logs = ref([])
const loading = ref(false)
const detailDialogVisible = ref(false)
const currentLog = ref(null)

const loadLogs = async () => {
  loading.value = true
  try {
    logs.value = await migrationStore.listExecutionLogs()
  } catch (error) {
    ElMessage.error('加载日志失败')
  } finally {
    loading.value = false
  }
}

const goToDetail = (migrationId) => {
  router.push(`/detail/${migrationId}`)
}

const viewLog = (log) => {
  currentLog.value = log
  detailDialogVisible.value = true
}

const replayLog = async (log) => {
  const { value: executedBy } = await ElMessage.prompt('请输入执行人姓名', '回放执行', {
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  })
  if (executedBy) {
    await migrationStore.replayExecution(log.id, executedBy)
    ElMessage.success('回放已启动')
    detailDialogVisible.value = false
    loadLogs()
  }
}

const getTypeText = (type) => {
  const map = {
    'migration': '迁移',
    'rollback': '回滚',
    'replay': '回放',
    'manual_fix': '人工修正'
  }
  return map[type] || type
}

const getTypeColor = (type) => {
  const map = {
    'migration': 'primary',
    'rollback': 'warning',
    'replay': 'info',
    'manual_fix': 'danger'
  }
  return map[type] || 'info'
}

const getStatusText = (status) => {
  const map = {
    'pending': '待执行',
    'running': '执行中',
    'success': '成功',
    'failed': '失败',
    'partial': '部分成功'
  }
  return map[status] || status
}

const getStatusColor = (status) => {
  const map = {
    'pending': 'info',
    'running': 'primary',
    'success': 'success',
    'failed': 'danger',
    'partial': 'warning'
  }
  return map[status] || 'info'
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}

onMounted(() => {
  loadLogs()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>