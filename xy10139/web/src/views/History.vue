<template>
  <div class="history-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>历史记录</span>
          <el-tag type="info" effect="plain">共 {{ jobs.length }} 条记录</el-tag>
        </div>
      </template>

      <el-table :data="jobs" v-loading="loading" stripe>
        <el-table-column prop="name" label="文件名" min-width="200">
          <template #default="{ row }">
            <el-tag type="primary" effect="plain">{{ row.name }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="120">
          <template #default="{ row }">
            {{ getTypeLabel(row.type) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="totalRows" label="总计" width="80" />
        <el-table-column label="成功" width="80">
          <template #default="{ row }">
            <span class="success-text">{{ row.successCount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="失败" width="80">
          <template #default="{ row }">
            <span class="failed-text">{{ row.failedCount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="成功率" width="100">
          <template #default="{ row }">
            <el-progress 
              :percentage="Math.round((row.successCount / row.totalRows) * 100)" 
              :stroke-width="12"
              :color="getProgressColor(row)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="viewDetail(row.id)">
              查看
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="jobs.length === 0 && !loading" description="暂无历史记录" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { jobsApi, type ImportJob } from '../api'

const router = useRouter()
const loading = ref(false)
const jobs = ref<ImportJob[]>([])

const typeLabels: Record<string, string> = {
  user: '用户',
  product: '商品',
  order: '订单',
  custom: '自定义'
}

const statusLabels: Record<string, string> = {
  pending: '待处理',
  validating: '校验中',
  completed: '已完成',
  failed: '失败'
}

onMounted(() => loadJobs())

async function loadJobs() {
  loading.value = true
  try {
    const { data } = await jobsApi.list()
    jobs.value = data.jobs
  } catch (e: any) {
    ElMessage.error('加载历史记录失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

function getTypeLabel(type: string) {
  return typeLabels[type] || type
}

function getStatusLabel(status: string) {
  return statusLabels[status] || status
}

function getStatusType(status: string) {
  switch (status) {
    case 'completed': return 'success'
    case 'failed': return 'danger'
    case 'validating': return 'warning'
    default: return 'info'
  }
}

function getProgressColor(row: ImportJob) {
  const rate = row.totalRows > 0 ? row.successCount / row.totalRows : 0
  if (rate >= 0.9) return '#67c23a'
  if (rate >= 0.5) return '#e6a23c'
  return '#f56c6c'
}

function formatDate(date: string) {
  return new Date(date).toLocaleString('zh-CN')
}

function viewDetail(id: string) {
  router.push(`/jobs/${id}`)
}
</script>

<style scoped>
.history-container {
  max-width: 1200px;
  margin: 24px auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.success-text {
  color: #67c23a;
  font-weight: 600;
}

.failed-text {
  color: #f56c6c;
  font-weight: 600;
}
</style>