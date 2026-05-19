<template>
  <div>
    <h2 style="margin-bottom: 20px">数据总览</h2>
    
    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="6">
        <el-card>
          <div style="text-align: center">
            <div style="font-size: 24px; color: #409eff; margin-bottom: 8px">{{ stats.total_requests || 0 }}</div>
            <div style="color: #909399">总请求数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div style="text-align: center">
            <div style="font-size: 24px; color: #67c23a; margin-bottom: 8px">{{ stats.total_remaining_quota || 0 }}</div>
            <div style="color: #909399">剩余额度</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div style="text-align: center">
            <div style="font-size: 24px; color: #e6a23c; margin-bottom: 8px">{{ stats.pending_credits || 0 }}</div>
            <div style="color: #909399">待审核退费</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div style="text-align: center">
            <div style="font-size: 24px; color: #f56c6c; margin-bottom: 8px">{{ stats.active_members || 0 }}</div>
            <div style="color: #909399">活跃成员</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>最近请求</span>
              <el-button type="primary" size="small" @click="$router.push('/requests')">查看全部</el-button>
            </div>
          </template>
          <el-table :data="recentRequests" style="width: 100%" size="small">
            <el-table-column prop="id" label="ID" width="80" show-overflow-tooltip />
            <el-table-column prop="quota_consumed" label="消耗额度" width="100" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>待审核退费</span>
              <el-button type="primary" size="small" @click="$router.push('/credits')">审核</el-button>
            </div>
          </template>
          <el-table :data="pendingCredits" style="width: 100%" size="small">
            <el-table-column prop="id" label="ID" width="80" show-overflow-tooltip />
            <el-table-column prop="quota_returned" label="返还额度" width="100" />
            <el-table-column prop="reason" label="原因" show-overflow-tooltip />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { onMounted, computed } from 'vue'
import { useQuotaStore } from '../stores/quota'

const store = useQuotaStore()

const stats = computed(() => store.stats)
const recentRequests = computed(() => store.requests.slice(0, 5))
const pendingCredits = computed(() => store.credits.filter(c => c.status === 'pending').slice(0, 5))

const getStatusType = (status) => {
  const map = { processing: '', completed: 'success', failed: 'danger', refunded: 'warning' }
  return map[status] || ''
}

const getStatusText = (status) => {
  const map = { processing: '处理中', completed: '已完成', failed: '失败', refunded: '已退费' }
  return map[status] || status
}

onMounted(async () => {
  await store.fetchStats()
  await store.fetchRequests()
  await store.fetchCredits()
})
</script>
