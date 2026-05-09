<template>
  <div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">设备总数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #67c23a;">{{ stats.available }}</div>
        <div class="stat-label">可借出</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #409eff;">{{ stats.borrowed }}</div>
        <div class="stat-label">已借出</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #e6a23c;">{{ stats.maintenance }}</div>
        <div class="stat-label">维护中</div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 20px;">
      <div class="card-header">
        <h2 class="card-title">最近借出记录</h2>
      </div>
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
      </div>
      <div v-else-if="recentBorrows.length === 0" class="empty-state">
        <div class="empty-icon">📋</div>
        <p>暂无借出记录</p>
      </div>
      <div v-else class="table-container">
        <table>
          <thead>
            <tr>
              <th>设备编号</th>
              <th>设备名称</th>
              <th>借出人</th>
              <th>借出时间</th>
              <th>预计归还</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in recentBorrows" :key="record.id">
              <td>{{ record.deviceCode }}</td>
              <td>{{ record.deviceName }}</td>
              <td>{{ record.borrowerName }}</td>
              <td>{{ formatDate(record.borrowedAt) }}</td>
              <td>{{ record.expectedReturnAt ? formatDate(record.expectedReturnAt) : '-' }}</td>
              <td>
                <span
                  class="status-badge"
                  :class="getStatusClass(record.status)"
                >
                  {{ getStatusLabel(record.status) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2 class="card-title">设备类别统计</h2>
      </div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>类别</th>
              <th>数量</th>
              <th>可借出</th>
              <th>已借出</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(counts, category) in categoryStats" :key="category">
              <td>{{ getCategoryLabel(category) }}</td>
              <td>{{ counts.total }}</td>
              <td style="color: #67c23a;">{{ counts.available }}</td>
              <td style="color: #409eff;">{{ counts.borrowed }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { DeviceStatus, DeviceCategory, BorrowStatus } from '@shared/types'

interface Stats {
  total: number
  available: number
  borrowed: number
  maintenance: number
}

interface BorrowRecord {
  id: string
  deviceCode: string
  deviceName: string
  borrowerName: string
  borrowedAt: string
  expectedReturnAt: string | null
  status: BorrowStatus
}

interface CategoryCounts {
  total: number
  available: number
  borrowed: number
}

const stats = ref<Stats>({ total: 0, available: 0, borrowed: 0, maintenance: 0 })
const recentBorrows = ref<BorrowRecord[]>([])
const categoryStats = ref<Record<string, CategoryCounts>>({})
const loading = ref(false)

async function loadData() {
  loading.value = true
  try {
    const devicesResult = await window.api.devices.list({
      page: 1,
      pageSize: 1000
    })

    if (devicesResult.success && devicesResult.data) {
      const devices = devicesResult.data.items || []

      stats.value = {
        total: devices.length,
        available: devices.filter((d: any) => d.status === DeviceStatus.AVAILABLE).length,
        borrowed: devices.filter((d: any) => d.status === DeviceStatus.BORROWED).length,
        maintenance: devices.filter((d: any) => d.status === DeviceStatus.MAINTENANCE).length
      }

      const categories: Record<string, CategoryCounts> = {}
      for (const d of devices) {
        if (!categories[d.category]) {
          categories[d.category] = { total: 0, available: 0, borrowed: 0 }
        }
        categories[d.category].total++
        if (d.status === DeviceStatus.AVAILABLE) categories[d.category].available++
        if (d.status === DeviceStatus.BORROWED) categories[d.category].borrowed++
      }
      categoryStats.value = categories
    }

    const borrowsResult = await window.api.borrows.list({
      page: 1,
      pageSize: 10
    })

    if (borrowsResult.success && borrowsResult.data) {
      recentBorrows.value = borrowsResult.data.items || []
    }
  } catch (e) {
    console.error('加载数据失败', e)
  } finally {
    loading.value = false
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getStatusClass(status: BorrowStatus): string {
  switch (status) {
    case BorrowStatus.ACTIVE:
      return 'status-borrowed'
    case BorrowStatus.RETURNED:
      return 'status-available'
    case BorrowStatus.OVERDUE:
      return 'status-lost'
    default:
      return ''
  }
}

function getStatusLabel(status: BorrowStatus): string {
  switch (status) {
    case BorrowStatus.ACTIVE:
      return '借出中'
    case BorrowStatus.RETURNED:
      return '已归还'
    case BorrowStatus.OVERDUE:
      return '已逾期'
    case BorrowStatus.CANCELLED:
      return '已取消'
    default:
      return status
  }
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case DeviceCategory.LAPTOP:
      return '笔记本电脑'
    case DeviceCategory.PHONE:
      return '手机'
    case DeviceCategory.TABLET:
      return '平板'
    case DeviceCategory.CAMERA:
      return '相机'
    case DeviceCategory.AUDIO:
      return '音频设备'
    case DeviceCategory.OTHER:
      return '其他'
    default:
      return category
  }
}

onMounted(() => {
  loadData()
})
</script>
