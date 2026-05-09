<template>
  <div class="card">
    <div class="card-header">
      <h2 class="card-title">批量操作记录</h2>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>
    <div v-else-if="operations.length === 0" class="empty-state">
      <div class="empty-icon">⚡</div>
      <p>暂无批量操作记录</p>
    </div>
    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th>操作类型</th>
            <th>创建人</th>
            <th>开始时间</th>
            <th>完成时间</th>
            <th>总数</th>
            <th>成功</th>
            <th>失败</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="op in operations" :key="op.id">
            <td>{{ getOperationTypeLabel(op.operationType) }}</td>
            <td>{{ op.createdByName }}</td>
            <td>{{ formatDate(op.startedAt) }}</td>
            <td>{{ op.completedAt ? formatDate(op.completedAt) : '-' }}</td>
            <td>{{ op.totalCount }}</td>
            <td style="color: #67c23a;">{{ op.successCount }}</td>
            <td style="color: #f56c6c;">{{ op.failedCount }}</td>
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
                class="btn btn-default btn-sm"
                @click="viewDetails(op)"
              >
                详情
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div v-if="showDetailModal" class="modal-overlay" @click.self="showDetailModal = false">
    <div class="modal modal-lg">
      <div class="modal-header">
        <h3 class="modal-title">批量操作详情</h3>
        <button class="modal-close" @click="showDetailModal = false">&times;</button>
      </div>
      <div class="modal-body" v-if="selectedOperation">
        <div class="batch-info">
          <p><strong>操作类型：</strong>{{ getOperationTypeLabel(selectedOperation.operationType) }}</p>
          <p><strong>创建人：</strong>{{ selectedOperation.createdByName }}</p>
          <p><strong>开始时间：</strong>{{ formatDate(selectedOperation.startedAt) }}</p>
          <p><strong>完成时间：</strong>{{ selectedOperation.completedAt ? formatDate(selectedOperation.completedAt) : '-' }}</p>
          <p>
            <strong>结果：</strong>
            总数 {{ selectedOperation.totalCount }},
            成功 <span style="color: #67c23a;">{{ selectedOperation.successCount }}</span>,
            失败 <span style="color: #f56c6c;">{{ selectedOperation.failedCount }}</span>
          </p>
        </div>

        <h4 style="margin-bottom: 12px;">详细结果</h4>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>设备编号</th>
                <th>状态</th>
                <th>错误信息</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="result in selectedOperation.results" :key="result.id">
                <td>{{ result.itemCode || '-' }}</td>
                <td>
                  <span
                    class="status-badge"
                    :class="result.success ? 'status-available' : 'status-lost'"
                  >
                    {{ result.success ? '成功' : '失败' }}
                  </span>
                </td>
                <td>{{ result.errorMessage || '-' }}</td>
                <td>{{ formatDate(result.timestamp) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-default" @click="showDetailModal = false">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToastStore } from '../stores/toast'
import { BatchStatus } from '@shared/types'

const toastStore = useToastStore()

const operations = ref<any[]>([])
const loading = ref(false)
const showDetailModal = ref(false)
const selectedOperation = ref<any>(null)

async function loadOperations() {
  loading.value = true
  try {
    const result = await window.api.batch.list({
      page: 1,
      pageSize: 50,
      sortBy: 'started_at',
      sortOrder: 'desc'
    })
    if (result.success && result.data) {
      operations.value = result.data.items || []
    }
  } catch (e) {
    toastStore.error('加载批量操作记录失败')
  } finally {
    loading.value = false
  }
}

function viewDetails(op: any) {
  selectedOperation.value = op
  showDetailModal.value = true
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

function getOperationTypeLabel(type: string): string {
  switch (type) {
    case 'import_devices':
      return '导入设备'
    case 'batch_lend':
      return '批量借出'
    case 'batch_return':
      return '批量归还'
    default:
      return type
  }
}

function getStatusClass(status: string): string {
  switch (status) {
    case BatchStatus.COMPLETED:
      return 'status-available'
    case BatchStatus.PARTIAL:
      return 'status-maintenance'
    case BatchStatus.FAILED:
      return 'status-lost'
    case BatchStatus.RUNNING:
      return 'status-borrowed'
    default:
      return ''
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case BatchStatus.PENDING:
      return '等待中'
    case BatchStatus.RUNNING:
      return '进行中'
    case BatchStatus.COMPLETED:
      return '已完成'
    case BatchStatus.PARTIAL:
      return '部分完成'
    case BatchStatus.FAILED:
      return '失败'
    default:
      return status
  }
}

onMounted(() => {
  loadOperations()
})
</script>
