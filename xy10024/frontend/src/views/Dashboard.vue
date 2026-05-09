<template>
  <div>
    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-value" style="color: #409eff;">{{ stats.totalDevices }}</div>
          <div class="stat-label">设备总数</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-value" style="color: #e6a23c;">{{ stats.availableDevices }}</div>
          <div class="stat-label">可借用</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-value" style="color: #f56c6c;">{{ stats.borrowedDevices }}</div>
          <div class="stat-label">借用中</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-value" style="color: #67c23a;">{{ stats.todayBorrows }}</div>
          <div class="stat-label">今日借用</div>
        </div>
      </el-col>
    </el-row>

    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>最近借用记录</span>
          <el-button type="primary" link @click="router.push('/borrows')">
            查看全部
          </el-button>
        </div>
      </template>
      <el-table :data="recentBorrows" v-loading="loading">
        <el-table-column prop="device_id" label="设备ID" width="280">
          <template #default="{ row }">
            <el-tag size="small">{{ row.device_id.substring(0, 8) }}...</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="borrower_id" label="借用人ID" width="280">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.borrower_id.substring(0, 8) }}...</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="purpose" label="用途" show-overflow-tooltip />
        <el-table-column prop="borrow_date" label="借用时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.borrow_date) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getDevices } from '@/api/devices'
import { getBorrowRecords } from '@/api/borrows'
import dayjs from 'dayjs'

const router = useRouter()
const loading = ref(false)
const recentBorrows = ref([])
const stats = ref({
  totalDevices: 0,
  availableDevices: 0,
  borrowedDevices: 0,
  todayBorrows: 0
})

function formatDate(date) {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

function getStatusType(status) {
  const types = {
    borrowed: 'warning',
    returned: 'success',
    overdue: 'danger'
  }
  return types[status] || 'info'
}

function getStatusText(status) {
  const texts = {
    borrowed: '借用中',
    returned: '已归还',
    overdue: '已逾期'
  }
  return texts[status] || status
}

async function loadData() {
  loading.value = true
  try {
    const [devicesRes, borrowsRes] = await Promise.all([
      getDevices({ page: 1, page_size: 1000 }),
      getBorrowRecords({ page: 1, page_size: 10 })
    ])

    const devices = devicesRes.devices || []
    stats.value.totalDevices = devicesRes.total || 0
    stats.value.availableDevices = devices.filter(d => d.status === 'available').length
    stats.value.borrowedDevices = devices.filter(d => d.status === 'borrowed').length

    const today = dayjs().startOf('day')
    const borrowRecords = borrowsRes.records || []
    stats.value.todayBorrows = borrowRecords.filter(
      b => dayjs(b.borrow_date).isAfter(today)
    ).length

    recentBorrows.value = borrowRecords
  } catch (error) {
    console.error('Failed to load dashboard data:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>
