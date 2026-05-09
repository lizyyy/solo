<template>
  <div class="card">
    <div class="card-header">
      <h2 class="card-title">失败重试队列</h2>
      <div class="toolbar">
        <button
          class="btn btn-default"
          @click="loadOperations"
        >
          🔄 刷新
        </button>
      </div>
    </div>

    <div class="search-bar">
      <div class="filters">
        <div class="filter-item">
          <span class="filter-label">状态:</span>
          <select v-model="filterStatus" class="form-select" style="width: 150px;" @change="loadOperations">
            <option value="">全部</option>
            <option value="pending">等待重试</option>
            <option value="retrying">重试中</option>
            <option value="success">已成功</option>
            <option value="failed">已失败</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>
    <div v-else-if="operations.length === 0" class="empty-state">
      <div class="empty-icon">🔄</div>
      <p>暂无失败操作</p>
    </div>
    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th>操作类型</th>
            <th>详情</th>
            <th>错误信息</th>
            <th>重试次数</th>
            <th>上次尝试</th>
            <th>下次重试</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="op in operations" :key="op.id">
            <td>{{ op.operationType }}</td>
            <td>{{ op.details }}</td>
            <td>{{ op.errorMessage }}</td>
            <td>{{ op.retryCount }} / {{ op.maxRetries }}</td>
            <td>{{ formatDate(op.lastAttemptAt) }}</td>
            <td>{{ op.nextRetryAt ? formatDate(op.nextRetryAt) : '-' }}</td>
            <td>
              <span
                class="status-badge"
                :class="getStatusClass(op.status)"
              >
                {{ getStatusLabel(op.status) }}
              </span>
            </td>
            <td>
              <button
                v-if="op.status === 'pending' || op.status === 'retrying'"
                class="btn btn-danger btn-sm"
                @click="cancelRetry(op)"
              >
                取消
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToastStore } from '../stores/toast'
import { RetryStatus } from '@shared/types'

const toastStore = useToastStore()

const operations = ref<any[]>([])
const loading = ref(false)
const filterStatus = ref('')

async function loadOperations() {
  loading.value = true
  try {
    const params: any = {
      page: 1,
      pageSize: 100,
      sortBy: 'created_at',
      sortOrder: 'desc'
    }

    if (filterStatus.value) {
      params.status = filterStatus.value
    }

    const result = await window.api.retry.list(params)
    if (result.success && result.data) {
      operations.value = result.data.items || []
    }
  } catch (e) {
    toastStore.error('加载重试队列失败')
  } finally {
    loading.value = false
  }
}

async function cancelRetry(op: any) {
  if (!confirm('确认取消此重试任务？')) return

  try {
    const result = await window.api.retry.cancel(op.id)
    if (result.success) {
      toastStore.success('已取消重试')
      loadOperations()
    } else {
      toastStore.error(result.error || '取消失败')
    }
  } catch (e) {
    toastStore.error('取消失败')
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

function getStatusClass(status: string): string {
  switch (status) {
    case RetryStatus.PENDING:
      return 'status-maintenance'
    case RetryStatus.RETRYING:
      return 'status-borrowed'
    case RetryStatus.SUCCESS:
      return 'status-available'
    case RetryStatus.FAILED:
      return 'status-lost'
    case RetryStatus.CANCELLED:
      return ''
    default:
      return ''
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case RetryStatus.PENDING:
      return '等待重试'
    case RetryStatus.RETRYING:
      return '重试中'
    case RetryStatus.SUCCESS:
      return '已成功'
    case RetryStatus.FAILED:
      return '已失败'
    case RetryStatus.CANCELLED:
      return '已取消'
    default:
      return status
  }
}

onMounted(() => {
  loadOperations()
})
</script>
