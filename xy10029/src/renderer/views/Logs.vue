<template>
  <div class="card">
    <div class="card-header">
      <h2 class="card-title">系统日志</h2>
    </div>

    <div class="search-bar">
      <div class="filters">
        <div class="filter-item">
          <span class="filter-label">级别:</span>
          <select v-model="filterLevel" class="form-select" style="width: 120px;" @change="loadLogs">
            <option value="">全部</option>
            <option value="info">信息</option>
            <option value="warn">警告</option>
            <option value="error">错误</option>
          </select>
        </div>
        <div class="filter-item">
          <span class="filter-label">模块:</span>
          <select v-model="filterModule" class="form-select" style="width: 120px;" @change="loadLogs">
            <option value="">全部</option>
            <option value="auth">认证</option>
            <option value="device">设备</option>
            <option value="import">导入</option>
            <option value="export">导出</option>
            <option value="batch">批量</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>
    <div v-else-if="logs.length === 0" class="empty-state">
      <div class="empty-icon">📝</div>
      <p>暂无日志记录</p>
    </div>
    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>级别</th>
            <th>模块</th>
            <th>操作</th>
            <th>用户</th>
            <th>详情</th>
            <th>状态</th>
            <th>耗时</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id">
            <td>{{ formatDate(log.timestamp) }}</td>
            <td>
              <span
                class="status-badge"
                :class="getLevelClass(log.level)"
              >
                {{ getLevelLabel(log.level) }}
              </span>
            </td>
            <td>{{ log.module }}</td>
            <td>{{ log.action }}</td>
            <td>{{ log.userName || '-' }}</td>
            <td>{{ log.details }}</td>
            <td>{{ log.success ? '成功' : '失败' }}</td>
            <td>{{ log.duration }}ms</td>
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
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useToastStore } from '../stores/toast'
import { LogLevel } from '@shared/types'

const toastStore = useToastStore()

const logs = ref<any[]>([])
const loading = ref(false)
const filterLevel = ref('')
const filterModule = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

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

async function loadLogs() {
  loading.value = true
  try {
    const params: any = {
      page: currentPage.value,
      pageSize: pageSize.value,
      sortBy: 'timestamp',
      sortOrder: 'desc'
    }

    if (filterLevel.value) {
      params.level = filterLevel.value
    }
    if (filterModule.value) {
      params.module = filterModule.value
    }

    const result = await window.api.logs.list(params)
    if (result.success && result.data) {
      logs.value = result.data.items || []
      total.value = result.data.total || 0
    }
  } catch (e) {
    toastStore.error('加载日志失败')
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
    minute: '2-digit',
    second: '2-digit'
  })
}

function getLevelClass(level: string): string {
  switch (level) {
    case LogLevel.INFO:
      return 'status-available'
    case LogLevel.WARN:
      return 'status-maintenance'
    case LogLevel.ERROR:
    case LogLevel.FATAL:
      return 'status-lost'
    default:
      return ''
  }
}

function getLevelLabel(level: string): string {
  switch (level) {
    case LogLevel.DEBUG:
      return '调试'
    case LogLevel.INFO:
      return '信息'
    case LogLevel.WARN:
      return '警告'
    case LogLevel.ERROR:
      return '错误'
    case LogLevel.FATAL:
      return '致命'
    default:
      return level
  }
}

onMounted(() => {
  loadLogs()
})

watch(currentPage, () => {
  loadLogs()
})
</script>
