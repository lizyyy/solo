<template>
  <div class="container">
    <div class="page-header">
      <h2>仪表盘</h2>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">总推送数</div>
        <div class="value">{{ stats?.total || 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="label">今日推送</div>
        <div class="value">{{ stats?.today || 0 }}</div>
      </div>
      <div class="stat-card" style="border-left: 4px solid #67c23a">
        <div class="label">已发送</div>
        <div class="value">{{ stats?.byStatus?.sent || 0 }}</div>
      </div>
      <div class="stat-card" style="border-left: 4px solid #e6a23c">
        <div class="label">队列中</div>
        <div class="value">{{ queueCount }}</div>
      </div>
      <div class="stat-card" style="border-left: 4px solid #f56c6c">
        <div class="label">失败</div>
        <div class="value">{{ stats?.byStatus?.failed || 0 }}</div>
      </div>
      <div class="stat-card" style="border-left: 4px solid #909399">
        <div class="label">已取消</div>
        <div class="value">{{ stats?.byStatus?.cancelled || 0 }}</div>
      </div>
    </div>
    
    <div class="filter-bar">
      <el-form :inline="true" :model="filterForm">
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部状态" clearable style="width: 150px">
            <el-option label="待处理" value="pending" />
            <el-option label="队列中" value="queued" />
            <el-option label="处理中" value="processing" />
            <el-option label="已发送" value="sent" />
            <el-option label="失败" value="failed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="filterForm.pushType" placeholder="全部类型" clearable style="width: 150px">
            <el-option label="广播" value="broadcast" />
            <el-option label="定向" value="targeted" />
            <el-option label="系统" value="system" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadMessages">查询</el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </div>
    
    <el-card>
      <template #header>
        <div class="card-header">
          <span>最近推送</span>
          <el-button type="primary" link @click="$router.push('/push/create')">
            <el-icon><Plus /></el-icon>
            新建推送
          </el-button>
        </div>
      </template>
      
      <el-table :data="messages" v-loading="loading" stripe>
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="pushType" label="类型" width="100">
          <template #default="{ row }">
            {{ pushTypeLabels[row.pushType] || row.pushType }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :class="`status-tag status-${row.status}`" effect="light">
              {{ statusLabels[row.status] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="deliveredCount" label="送达" width="80" />
        <el-table-column prop="retryCount" label="重试" width="60" />
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/push/${row._id}`)">
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import type { PushMessage, Statistics } from '@/types'
import { getStatistics, listPushMessages } from '@/api/push'

const loading = ref(false)
const stats = ref<Statistics | null>(null)
const messages = ref<PushMessage[]>([])

const filterForm = reactive({
  status: '',
  pushType: '',
})

const queueCount = computed(() => {
  if (!stats.value) return 0
  const byStatus = stats.value.byStatus || {}
  return (byStatus.pending || 0) + (byStatus.queued || 0) + (byStatus.processing || 0)
})

const statusLabels: Record<string, string> = {
  pending: '待处理',
  queued: '队列中',
  processing: '处理中',
  sent: '已发送',
  failed: '失败',
  cancelled: '已取消',
}

const pushTypeLabels: Record<string, string> = {
  broadcast: '广播',
  targeted: '定向',
  system: '系统',
}

function formatDate(date: string): string {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

async function loadStats() {
  try {
    stats.value = await getStatistics()
  } catch (e) {
    console.error('Failed to load stats:', e)
  }
}

async function loadMessages() {
  loading.value = true
  try {
    const result = await listPushMessages({
      page: 1,
      limit: 10,
      status: filterForm.status || undefined,
      pushType: filterForm.pushType || undefined,
    })
    messages.value = result.data
  } catch (e) {
    console.error('Failed to load messages:', e)
  } finally {
    loading.value = false
  }
}

function resetFilter() {
  filterForm.status = ''
  filterForm.pushType = ''
  loadMessages()
}

onMounted(() => {
  loadStats()
  loadMessages()
  
  setInterval(() => {
    loadStats()
  }, 30000)
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
