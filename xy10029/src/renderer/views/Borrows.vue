<template>
  <div class="card">
    <div class="card-header">
      <h2 class="card-title">借出记录</h2>
      <div class="toolbar">
        <button
          v-if="canExport"
          class="btn btn-default"
          @click="showExportModal = true"
        >
          📤 导出
        </button>
      </div>
    </div>

    <div class="search-bar">
      <div class="filters">
        <div class="filter-item">
          <span class="filter-label">状态:</span>
          <select v-model="filterStatus" class="form-select" style="width: 150px;" @change="loadRecords">
            <option value="">全部</option>
            <option value="active">借出中</option>
            <option value="returned">已归还</option>
            <option value="overdue">已逾期</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>
    <div v-else-if="records.length === 0" class="empty-state">
      <div class="empty-icon">📋</div>
      <p>暂无借出记录</p>
    </div>
    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th>设备编号</th>
            <th>借出人</th>
            <th>操作员</th>
            <th>借出时间</th>
            <th>预计归还</th>
            <th>实际归还</th>
            <th>用途</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in records" :key="record.id">
            <td>{{ record.deviceCode }}</td>
            <td>{{ record.borrowerName }}</td>
            <td>{{ record.operatorName }}</td>
            <td>{{ formatDate(record.borrowedAt) }}</td>
            <td>{{ record.expectedReturnAt ? formatDate(record.expectedReturnAt) : '-' }}</td>
            <td>{{ record.returnedAt ? formatDate(record.returnedAt) : '-' }}</td>
            <td>{{ record.purpose || '-' }}</td>
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

    <div v-if="totalPages > 1" class="pagination">
      <button
        class="page-btn"
        :disabled="currentPage === 1"
        @click="changePage(currentPage - 1)"
      >
        上一页
      </button>
      <button
        class="page-btn"
        :class="{ active: currentPage === p }"
        v-for="p in visiblePages"
        :key="p"
        @click="changePage(p)"
      >
        {{ p }}
      </button>
      <button
        class="page-btn"
        :disabled="currentPage === totalPages"
        @click="changePage(currentPage + 1)"
      >
        下一页
      </button>
    </div>
  </div>

  <ExportModal
    v-if="showExportModal"
    :dataType="'borrows'"
    @close="showExportModal = false"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useToastStore } from '../stores/toast'
import { Permission, BorrowStatus } from '@shared/types'
import ExportModal from '../components/ExportModal.vue'

const authStore = useAuthStore()
const toastStore = useToastStore()

const records = ref<any[]>([])
const loading = ref(false)
const filterStatus = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const showExportModal = ref(false)

const canExport = computed(() => authStore.hasPermission(Permission.EXPORT_DATA))

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))
const visiblePages = computed(() => {
  const pages: number[] = []
  for (let i = 1; i <= totalPages.value; i++) {
    if (i <= 5 || i >= totalPages.value - 2 || Math.abs(i - currentPage.value) <= 2) {
      pages.push(i)
    }
  }
  return pages.filter((p, i, arr) => i === 0 || p !== arr[i - 1])
})

async function loadRecords() {
  loading.value = true
  try {
    const params: any = {
      page: currentPage.value,
      pageSize: pageSize.value,
      sortBy: 'borrowed_at',
      sortOrder: 'desc'
    }

    if (filterStatus.value) {
      params.status = filterStatus.value
    }

    const result = await window.api.borrows.list(params)
    if (result.success && result.data) {
      records.value = result.data.items || []
      total.value = result.data.total || 0
    }
  } catch (e) {
    toastStore.error('加载借出记录失败')
  } finally {
    loading.value = false
  }
}

function changePage(page: number) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
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

function getStatusClass(status: string): string {
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

function getStatusLabel(status: string): string {
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

onMounted(() => {
  loadRecords()
})

watch(currentPage, () => {
  loadRecords()
})
</script>
