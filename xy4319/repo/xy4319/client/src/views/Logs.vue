<template>
  <div class="logs-page">
    <div class="logs-stats">
      <div class="stat-item">
        <span class="stat-icon">📝</span>
        <span class="stat-number">{{ totalLogs }}</span>
        <span class="stat-label">总日志数</span>
      </div>
      <div class="stat-item info">
        <span class="stat-icon">ℹ️</span>
        <span class="stat-number">{{ infoCount }}</span>
        <span class="stat-label">信息</span>
      </div>
      <div class="stat-item warning">
        <span class="stat-icon">⚠️</span>
        <span class="stat-number">{{ warningCount }}</span>
        <span class="stat-label">警告</span>
      </div>
      <div class="stat-item error">
        <span class="stat-icon">❌</span>
        <span class="stat-number">{{ errorCount }}</span>
        <span class="stat-label">错误</span>
      </div>
    </div>

    <div class="logs-filters">
      <div class="filter-group">
        <label class="filter-label">严重程度</label>
        <select v-model="severityFilter" class="form-select">
          <option value="">全部</option>
          <option value="debug">调试</option>
          <option value="info">信息</option>
          <option value="warning">警告</option>
          <option value="error">错误</option>
          <option value="critical">严重</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">操作类型</label>
        <select v-model="actionFilter" class="form-select">
          <option value="">全部</option>
          <option value="create">创建</option>
          <option value="update">更新</option>
          <option value="delete">删除</option>
          <option value="transfer">转运</option>
          <option value="triage">分诊</option>
          <option value="rule">规则检查</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">关键词搜索</label>
        <input 
          type="text" 
          v-model="searchQuery" 
          class="form-input"
          placeholder="搜索日志内容..."
        />
      </div>
      <div class="filter-actions">
        <button class="btn btn-secondary btn-sm" @click="handleRefresh">
          🔄 刷新
        </button>
        <button class="btn btn-secondary btn-sm" @click="clearFilters">
          🗑️ 清除筛选
        </button>
      </div>
    </div>

    <div class="logs-container">
      <div class="logs-table-wrapper">
        <table class="logs-table">
          <thead>
            <tr>
              <th class="col-time">时间</th>
              <th class="col-severity">级别</th>
              <th class="col-action">操作</th>
              <th class="col-message">消息</th>
              <th class="col-details">详情</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="log in paginatedLogs" 
              :key="log.id"
              class="log-row"
              :class="log.severity"
            >
              <td class="log-time">
                <div class="time-main">{{ formatTime(log.createdAt) }}</div>
                <div class="time-date">{{ formatDate(log.createdAt) }}</div>
              </td>
              <td class="log-severity">
                <span class="severity-badge" :class="log.severity">
                  {{ getSeverityIcon(log.severity) }}
                  {{ systemStore.getSeverityLabel(log.severity) }}
                </span>
              </td>
              <td class="log-action">
                <span class="action-tag" :class="log.action || 'unknown'">
                  {{ getActionLabel(log.action) }}
                </span>
              </td>
              <td class="log-message">
                {{ log.message || '-' }}
              </td>
              <td class="log-details">
                <button 
                  v-if="log.details" 
                  class="btn-text btn-sm"
                  @click="showLogDetails(log)"
                >
                  查看详情
                </button>
                <span v-else class="text-muted">-</span>
              </td>
            </tr>
            <tr v-if="filteredLogs.length === 0">
              <td colspan="5" class="empty-row">
                <div class="empty-state">
                  <span class="empty-icon">📭</span>
                  <p>暂无操作日志</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination" v-if="totalPages > 1">
        <button 
          class="pagination-btn"
          :disabled="currentPage === 1"
          @click="currentPage--"
        >
          上一页
        </button>
        <div class="pagination-pages">
          <button 
            v-for="page in visiblePages" 
            :key="page"
            class="page-btn"
            :class="{ active: currentPage === page }"
            @click="currentPage = page"
          >
            {{ page }}
          </button>
        </div>
        <button 
          class="pagination-btn"
          :disabled="currentPage === totalPages"
          @click="currentPage++"
        >
          下一页
        </button>
        <span class="page-info">
          第 {{ currentPage }} / {{ totalPages }} 页，共 {{ filteredLogs.length }} 条
        </span>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="selectedLog" class="modal-overlay" @click.self="selectedLog = null">
          <div class="modal modal-lg">
            <div class="modal-header">
              <h3 class="modal-title">日志详情</h3>
              <button class="btn-text" @click="selectedLog = null">✕</button>
            </div>
            <div class="modal-body">
              <div class="log-detail-grid">
                <div class="detail-item">
                  <label>时间</label>
                  <span>{{ formatDateTime(selectedLog.createdAt) }}</span>
                </div>
                <div class="detail-item">
                  <label>严重级别</label>
                  <span class="severity-badge" :class="selectedLog.severity">
                    {{ systemStore.getSeverityLabel(selectedLog.severity) }}
                  </span>
                </div>
                <div class="detail-item">
                  <label>操作类型</label>
                  <span>{{ getActionLabel(selectedLog.action) }}</span>
                </div>
                <div class="detail-item" v-if="selectedLog.userId">
                  <label>操作用户</label>
                  <span>{{ selectedLog.userId }}</span>
                </div>
                <div class="detail-item" v-if="selectedLog.entityType">
                  <label>实体类型</label>
                  <span>{{ selectedLog.entityType }}</span>
                </div>
                <div class="detail-item" v-if="selectedLog.entityId">
                  <label>实体ID</label>
                  <span>{{ selectedLog.entityId }}</span>
                </div>
                <div class="detail-item full-width" v-if="selectedLog.message">
                  <label>消息</label>
                  <span>{{ selectedLog.message }}</span>
                </div>
                <div class="detail-item full-width" v-if="selectedLog.details">
                  <label>详细数据</label>
                  <pre class="json-display">{{ formatJson(selectedLog.details) }}</pre>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" @click="selectedLog = null">关闭</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useSystemStore } from '@/stores/system'

const systemStore = useSystemStore()

const severityFilter = ref('')
const actionFilter = ref('')
const searchQuery = ref('')
const currentPage = ref(1)
const selectedLog = ref(null)
const pageSize = ref(50)

const totalLogs = computed(() => systemStore.logs.length)
const infoCount = computed(() => systemStore.logs.filter(l => l.severity === 'info').length)
const warningCount = computed(() => systemStore.logs.filter(l => l.severity === 'warning').length)
const errorCount = computed(() => systemStore.logs.filter(l => l.severity === 'error' || l.severity === 'critical').length)

const filteredLogs = computed(() => {
  let logs = [...systemStore.logs]
  
  if (severityFilter.value) {
    logs = logs.filter(l => l.severity === severityFilter.value)
  }
  
  if (actionFilter.value) {
    logs = logs.filter(l => l.action === actionFilter.value)
  }
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    logs = logs.filter(l => 
      (l.message && l.message.toLowerCase().includes(query)) ||
      (l.action && l.action.toLowerCase().includes(query))
    )
  }
  
  return logs
})

const totalPages = computed(() => Math.ceil(filteredLogs.value.length / pageSize.value))

const visiblePages = computed(() => {
  const pages = []
  const start = Math.max(1, currentPage.value - 2)
  const end = Math.min(totalPages.value, start + 4)
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  return pages
})

const paginatedLogs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredLogs.value.slice(start, start + pageSize.value)
})

watch([severityFilter, actionFilter, searchQuery], () => {
  currentPage.value = 1
})

function getSeverityIcon(severity) {
  const icons = {
    debug: '🔍',
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    critical: '🚨'
  }
  return icons[severity] || '📝'
}

function getActionLabel(action) {
  const labels = {
    create: '创建',
    update: '更新',
    delete: '删除',
    transfer: '转运',
    triage: '分诊',
    rule: '规则检查',
    import: '导入',
    export: '导出',
    system: '系统'
  }
  return labels[action] || action || '未知'
}

function formatTime(timestamp) {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDate(timestamp) {
  if (!timestamp) return '-'
  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function formatDateTime(timestamp) {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString('zh-CN')
}

function formatJson(details) {
  if (!details) return ''
  try {
    const obj = typeof details === 'string' ? JSON.parse(details) : details
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(details)
  }
}

function showLogDetails(log) {
  selectedLog.value = log
}

function clearFilters() {
  severityFilter.value = ''
  actionFilter.value = ''
  searchQuery.value = ''
  currentPage.value = 1
}

function handleRefresh() {
  systemStore.fetchLogs()
}

onMounted(() => {
  systemStore.fetchLogs()
})
</script>

<style scoped>
.logs-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.logs-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  background: white;
  border-radius: var(--radius);
  border: 1px solid var(--color-gray-200);
}

.stat-icon {
  font-size: 20px;
}

.stat-number {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-gray-900);
}

.stat-label {
  font-size: 13px;
  color: var(--color-gray-600);
}

.stat-item.info .stat-number { color: var(--color-blue); }
.stat-item.warning .stat-number { color: var(--color-yellow); }
.stat-item.error .stat-number { color: var(--color-red); }

.logs-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
  padding: 16px 20px;
  background: white;
  border-radius: var(--radius);
  border: 1px solid var(--color-gray-200);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-gray-600);
}

.form-select,
.form-input {
  padding: 8px 12px;
  border: 1px solid var(--color-gray-300);
  border-radius: var(--radius-sm);
  font-size: 14px;
  min-width: 140px;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--color-blue);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.filter-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.logs-container {
  background: white;
  border-radius: var(--radius);
  border: 1px solid var(--color-gray-200);
}

.logs-table-wrapper {
  overflow-x: auto;
}

.logs-table {
  width: 100%;
  border-collapse: collapse;
}

.logs-table th {
  padding: 14px 16px;
  background: var(--color-gray-50);
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-gray-600);
  border-bottom: 1px solid var(--color-gray-200);
}

.logs-table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-gray-100);
  font-size: 14px;
}

.col-time { width: 140px; }
.col-severity { width: 120px; }
.col-action { width: 100px; }
.col-details { width: 100px; }

.log-row:hover {
  background: var(--color-gray-50);
}

.log-row.warning {
  background: #fffbeb;
}

.log-row.error,
.log-row.critical {
  background: #fef2f2;
}

.log-time {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 13px;
}

.time-main {
  font-weight: 600;
  color: var(--color-gray-900);
}

.time-date {
  font-size: 12px;
  color: var(--color-gray-500);
}

.severity-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
}

.severity-badge.debug {
  background: var(--color-gray-100);
  color: var(--color-gray-600);
}

.severity-badge.info {
  background: #dbeafe;
  color: var(--color-blue);
}

.severity-badge.warning {
  background: #fef3c7;
  color: #92400e;
}

.severity-badge.error {
  background: #fee2e2;
  color: var(--color-red);
}

.severity-badge.critical {
  background: #fecaca;
  color: #7f1d1d;
}

.action-tag {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  background: var(--color-gray-100);
  color: var(--color-gray-700);
}

.action-tag.create { background: #dcfce7; color: var(--color-green); }
.action-tag.update { background: #dbeafe; color: var(--color-blue); }
.action-tag.delete { background: #fee2e2; color: var(--color-red); }
.action-tag.transfer { background: #e0e7ff; color: #4f46e5; }
.action-tag.triage { background: #fce7f3; color: #db2777; }
.action-tag.rule { background: #fef3c7; color: #92400e; }

.log-message {
  color: var(--color-gray-800);
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-text {
  background: none;
  border: none;
  color: var(--color-blue);
  font-size: 13px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

.btn-text:hover {
  background: #dbeafe;
}

.text-muted {
  color: var(--color-gray-400);
}

.empty-row {
  text-align: center;
}

.empty-state {
  padding: 60px 20px;
  color: var(--color-gray-500);
}

.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--color-gray-200);
}

.pagination-btn,
.page-btn {
  padding: 8px 14px;
  border: 1px solid var(--color-gray-300);
  background: white;
  border-radius: var(--radius-sm);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.pagination-btn:hover:not(:disabled),
.page-btn:hover {
  border-color: var(--color-blue);
  color: var(--color-blue);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-btn.active {
  background: var(--color-blue);
  border-color: var(--color-blue);
  color: white;
}

.pagination-pages {
  display: flex;
  gap: 4px;
}

.page-info {
  font-size: 13px;
  color: var(--color-gray-500);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  max-width: 600px;
  width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-lg {
  max-width: 700px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-gray-200);
}

.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--color-gray-200);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.log-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-item.full-width {
  grid-column: 1 / -1;
}

.detail-item label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-gray-500);
}

.detail-item span {
  font-size: 14px;
  color: var(--color-gray-900);
}

.json-display {
  background: var(--color-gray-900);
  color: #e5e7eb;
  padding: 12px;
  border-radius: var(--radius-sm);
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
  margin: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
