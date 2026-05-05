<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">排查任务</h2>
      <el-button type="primary" @click="refresh">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </div>

    <el-card>
      <el-table :data="tasks" v-loading="loading" stripe>
        <el-table-column prop="name" label="任务名称" min-width="200" />
        <el-table-column prop="type" label="类型" width="150">
          <template #default="{ row }">
            <el-tag :type="getTypeTag(row.type)">{{ getTypeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTag(row.status)">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="统计" min-width="200">
          <template #default="{ row }">
            <div class="stats-inline">
              <el-tag v-if="row.riskCount > 0" type="danger" size="small">
                风险: {{ row.riskCount }}
              </el-tag>
              <el-tag type="info" size="small">
                日志: {{ row.hitChainCount }}
              </el-tag>
              <el-tag v-if="row.anomalyUserCount > 0" type="warning" size="small">
                异常: {{ row.anomalyUserCount }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="completedAt" label="完成时间" width="180">
          <template #default="{ row }">
            {{ row.completedAt ? formatTime(row.completedAt) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="goToDetail(row.id)">
              详情
            </el-button>
            <el-button type="success" size="small" @click="exportReport(row.id)" :disabled="row.status !== 'completed'">
              导出
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { queryApi } from '../api'
import dayjs from 'dayjs'

const router = useRouter()

const loading = ref(false)
const tasks = ref<any[]>([])

const loadTasks = async () => {
  loading.value = true
  try {
    const res = await queryApi.getDebugTasks()
    if (res.data.success) {
      tasks.value = res.data.data
    }
  } catch (error: any) {
    ElMessage.error('加载失败: ' + (error.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

const goToDetail = (id: string) => {
  router.push(`/tasks/${id}`)
}

const exportReport = async (id: string) => {
  try {
    const { value } = await ElMessageBox.confirm(
      '请选择导出格式',
      '导出报告',
      {
        confirmButtonText: 'Markdown',
        cancelButtonText: 'JSON',
        distinguishCancelAndClose: true,
        type: 'info'
      }
    )

    if (value === 'confirm') {
      window.open(queryApi.exportMarkdown(id), '_blank')
    } else {
      window.open(queryApi.exportJson(id), '_blank')
    }
  } catch (error: any) {
    if (error !== 'close') {
      if (error === 'cancel') {
        window.open(queryApi.exportJson(id), '_blank')
      }
    }
  }
}

const refresh = () => {
  loadTasks()
}

const getTypeTag = (type: string) => {
  const types: Record<string, string> = {
    canary: 'primary',
    rollback: 'warning',
    sw_residue: 'danger',
    purge_miss: 'info',
    risk_detection: 'success'
  }
  return types[type] || 'info'
}

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    canary: '灰度发布模拟',
    rollback: '回滚模拟',
    sw_residue: 'SW残留模拟',
    purge_miss: 'Purge漏节点',
    risk_detection: '风险检测'
  }
  return labels[type] || type
}

const getStatusTag = (status: string) => {
  const tags: Record<string, string> = {
    pending: 'info',
    running: 'warning',
    completed: 'success',
    failed: 'danger'
  }
  return tags[status] || 'info'
}

const formatTime = (time: string) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

onMounted(() => {
  loadTasks()
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
  margin: 0;
}

.stats-inline {
  display: flex;
  gap: 8px;
}
</style>
