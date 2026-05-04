<template>
  <div>
    <div class="stats-grid" style="margin-bottom: 24px;">
      <div class="stat-card">
        <div class="stat-card-header">
          <div>
            <div class="stat-card-title">待处理</div>
            <div class="stat-card-value" style="color: var(--color-danger);">{{ stats.open || 0 }}</div>
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <div>
            <div class="stat-card-title">严重异常</div>
            <div class="stat-card-value" style="color: var(--color-danger);">{{ stats.critical || 0 }}</div>
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <div>
            <div class="stat-card-title">已解决</div>
            <div class="stat-card-value" style="color: var(--color-success);">{{ stats.resolved || 0 }}</div>
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <div>
            <div class="stat-card-title">误报</div>
            <div class="stat-card-value" style="color: var(--color-gray-500);">{{ stats.falsePositive || 0 }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="filter-bar">
      <div class="search-input">
        <span v-html="IconSearch"></span>
        <input 
          type="text" 
          class="form-control" 
          placeholder="搜索异常描述、设备名称..."
          v-model="searchQuery"
          @keyup.enter="loadAnomalies"
        />
      </div>
      <div class="filter-item">
        <label>状态:</label>
        <select class="form-control form-select" v-model="filters.status" @change="loadAnomalies">
          <option value="">全部状态</option>
          <option value="open">待处理</option>
          <option value="acknowledged">已确认</option>
          <option value="investigating">调查中</option>
          <option value="resolved">已解决</option>
          <option value="false_positive">误报</option>
        </select>
      </div>
      <div class="filter-item">
        <label>严重程度:</label>
        <select class="form-control form-select" v-model="filters.severity" @change="loadAnomalies">
          <option value="">全部级别</option>
          <option value="critical">严重</option>
          <option value="high">高危</option>
          <option value="medium">中等</option>
          <option value="low">低</option>
        </select>
      </div>
      <div class="filter-item">
        <label>异常类型:</label>
        <select class="form-control form-select" v-model="filters.anomalyType" @change="loadAnomalies">
          <option value="">全部类型</option>
          <option value="rssi_fluctuation">RSSI波动</option>
          <option value="long_disconnect">长时间失联</option>
          <option value="duplicate_device">重复设备</option>
          <option value="random_address_drift">地址漂移</option>
          <option value="low_battery">低电量</option>
          <option value="pairing_failures">配对失败</option>
          <option value="zone_violation">区域越界</option>
        </select>
      </div>
      <button class="btn btn-secondary" @click="loadAnomalies">
        <span v-html="IconRefresh"></span> 刷新
      </button>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">异常队列 ({{ pagination.total }})</h3>
        <div style="display: flex; gap: 8px;">
          <button 
            class="btn btn-sm btn-secondary" 
            :disabled="selectedIds.length === 0"
            @click="batchAcknowledge"
          >
            批量确认
          </button>
          <button 
            class="btn btn-sm btn-secondary" 
            :disabled="selectedIds.length === 0"
            @click="batchResolve"
          >
            批量解决
          </button>
        </div>
      </div>
      <div class="card-body" style="padding: 0;">
        <div v-if="loading" class="loading">
          <div class="spinner"></div>
        </div>
        <div v-else-if="anomalies.length === 0" class="empty-state">
          <p class="empty-state-title">暂无异常</p>
          <p class="empty-state-desc">所有设备运行正常</p>
        </div>
        <div v-else class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th style="width: 40px;">
                  <input type="checkbox" v-model="isAllSelected" @change="toggleSelectAll" />
                </th>
                <th>异常类型</th>
                <th>严重程度</th>
                <th>风险分数</th>
                <th>关联设备</th>
                <th>状态</th>
                <th>发现时间</th>
                <th style="width: 150px;">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="anomaly in anomalies" :key="anomaly.id">
                <td>
                  <input 
                    type="checkbox" 
                    :value="anomaly.id"
                    v-model="selectedIds"
                    @change="updateSelectAll"
                  />
                </td>
                <td>
                  <div>
                    <span class="badge" :class="getAnomalyBadgeClass(anomaly.anomalyType)">
                      {{ getAnomalyTypeLabel(anomaly.anomalyType) }}
                    </span>
                  </div>
                  <div v-if="anomaly.description" style="font-size: 12px; color: var(--color-gray-500); margin-top: 4px;">
                    {{ anomaly.description }}
                  </div>
                </td>
                <td>
                  <span class="badge" :class="getSeverityBadgeClass(anomaly.severity)">
                    {{ getSeverityLabel(anomaly.severity) }}
                  </span>
                </td>
                <td>
                  <span 
                    class="risk-score"
                    :style="{ color: getRiskScoreColor(anomaly.riskScore) }"
                  >
                    {{ anomaly.riskScore }}
                  </span>
                </td>
                <td>
                  <router-link 
                    v-if="anomaly.deviceId" 
                    :to="`/devices/${anomaly.deviceId}`"
                    style="color: var(--color-primary); font-weight: 500;"
                  >
                    {{ anomaly.affectedDeviceName || '查看设备' }}
                  </router-link>
                  <span v-else class="badge badge-secondary">未关联</span>
                </td>
                <td>
                  <span class="badge" :class="getStatusBadgeClass(anomaly.status)">
                    {{ getStatusLabel(anomaly.status) }}
                  </span>
                </td>
                <td>{{ formatTime(anomaly.discoveredAt) }}</td>
                <td>
                  <div class="action-buttons">
                    <button 
                      v-if="anomaly.status === 'open'"
                      class="btn btn-sm btn-secondary" 
                      @click="acknowledgeAnomaly(anomaly)"
                    >
                      确认
                    </button>
                    <button 
                      v-if="anomaly.status === 'open' || anomaly.status === 'acknowledged'"
                      class="btn btn-sm btn-success" 
                      @click="resolveAnomaly(anomaly)"
                    >
                      解决
                    </button>
                    <button 
                      class="btn btn-sm btn-secondary" 
                      @click="showDetail(anomaly)"
                    >
                      详情
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-if="pagination.total > 0" class="card-footer">
        <div class="pagination">
          <div class="pagination-info">
            显示 {{ (pagination.page - 1) * pagination.pageSize + 1 }} - 
            {{ Math.min(pagination.page * pagination.pageSize, pagination.total) }} 
            条，共 {{ pagination.total }} 条
          </div>
          <div class="pagination-controls">
            <button 
              class="pagination-btn" 
              :disabled="pagination.page <= 1"
              @click="changePage(pagination.page - 1)"
            >
              {{ IconChevronLeft }}
            </button>
            <button 
              v-for="p in visiblePages" 
              :key="p"
              class="pagination-btn"
              :class="{ active: p === pagination.page }"
              @click="changePage(p)"
            >
              {{ p }}
            </button>
            <button 
              class="pagination-btn" 
              :disabled="pagination.page >= pagination.totalPages"
              @click="changePage(pagination.page + 1)"
            >
              {{ IconChevronRight }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showDetailModal" class="modal-overlay" @click.self="showDetailModal = false">
      <div class="modal" style="max-width: 700px;">
        <div class="modal-header">
          <h3 class="modal-title">异常详情</h3>
          <button class="modal-close" @click="showDetailModal = false" v-html="IconClose"></button>
        </div>
        <div class="modal-body" v-if="selectedAnomaly">
          <div class="detail-section">
            <h4 class="detail-section-title">基本信息</h4>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">异常类型</span>
                <span class="badge" :class="getAnomalyBadgeClass(selectedAnomaly.anomalyType)">
                  {{ getAnomalyTypeLabel(selectedAnomaly.anomalyType) }}
                </span>
              </div>
              <div class="detail-item">
                <span class="detail-label">严重程度</span>
                <span class="badge" :class="getSeverityBadgeClass(selectedAnomaly.severity)">
                  {{ getSeverityLabel(selectedAnomaly.severity) }}
                </span>
              </div>
              <div class="detail-item">
                <span class="detail-label">风险分数</span>
                <span :style="{ color: getRiskScoreColor(selectedAnomaly.riskScore), fontWeight: '600' }">
                  {{ selectedAnomaly.riskScore }}
                </span>
              </div>
              <div class="detail-item">
                <span class="detail-label">当前状态</span>
                <span class="badge" :class="getStatusBadgeClass(selectedAnomaly.status)">
                  {{ getStatusLabel(selectedAnomaly.status) }}
                </span>
              </div>
              <div class="detail-item">
                <span class="detail-label">发现时间</span>
                <span>{{ formatDateTime(selectedAnomaly.discoveredAt) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">最后更新</span>
                <span>{{ formatDateTime(selectedAnomaly.updatedAt) }}</span>
              </div>
            </div>
          </div>

          <div v-if="selectedAnomaly.description" class="detail-section">
            <h4 class="detail-section-title">异常描述</h4>
            <p style="color: var(--color-gray-700); white-space: pre-wrap;">
              {{ selectedAnomaly.description }}
            </p>
          </div>

          <div v-if="selectedAnomaly.analysis" class="detail-section">
            <h4 class="detail-section-title">分析详情</h4>
            <pre style="background: var(--color-gray-50); padding: 12px; border-radius: var(--radius-md); font-size: 12px; overflow-x: auto;">
              {{ JSON.stringify(selectedAnomaly.analysis, null, 2) }}
            </pre>
          </div>

          <div v-if="selectedAnomaly.relatedIds && selectedAnomaly.relatedIds.length > 0" class="detail-section">
            <h4 class="detail-section-title">相关设备</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              <router-link 
                v-for="id in selectedAnomaly.relatedIds" 
                :key="id"
                :to="`/devices/${id}`"
                class="badge badge-primary"
                style="text-decoration: none;"
              >
                设备 #{{ id }}
              </router-link>
            </div>
          </div>

          <div class="detail-section">
            <h4 class="detail-section-title">处理</h4>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div class="form-group">
                <label class="form-label">处理状态</label>
                <select class="form-control form-select" v-model="handleForm.status">
                  <option value="acknowledged">标记已确认</option>
                  <option value="investigating">标记调查中</option>
                  <option value="resolved">标记已解决</option>
                  <option value="false_positive">标记误报</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">处理人</label>
                <input 
                  type="text" 
                  class="form-control" 
                  v-model="handleForm.handledBy"
                  placeholder="请输入处理人姓名"
                />
              </div>
              <div class="form-group">
                <label class="form-label">备注</label>
                <textarea 
                  class="form-control" 
                  rows="3"
                  v-model="handleForm.note"
                  placeholder="请输入处理备注..."
                ></textarea>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showDetailModal = false">取消</button>
          <button class="btn btn-primary" @click="submitHandle" :disabled="submitting">
            {{ submitting ? '提交中...' : '提交处理' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useApi, formatRelativeTime, formatDateTime, getAnomalyTypeLabel, getSeverityLabel, getStatusLabel } from '@/utils/api'
import { 
  RefreshIcon,
  SearchIcon,
  CloseIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@/components/icons'

export default {
  name: 'Anomalies',
  setup() {
    const api = useApi()

    const loading = ref(false)
    const anomalies = ref([])
    const selectedIds = ref([])
    const isAllSelected = ref(false)
    const searchQuery = ref('')
    const filters = ref({
      status: '',
      severity: '',
      anomalyType: ''
    })
    const pagination = ref({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0
    })
    const stats = ref({
      open: 0,
      critical: 0,
      resolved: 0,
      falsePositive: 0
    })

    const showDetailModal = ref(false)
    const selectedAnomaly = ref(null)
    const handleForm = ref({
      status: 'acknowledged',
      handledBy: '',
      note: ''
    })
    const submitting = ref(false)

    const IconRefresh = RefreshIcon()
    const IconSearch = SearchIcon()
    const IconClose = CloseIcon()
    const IconChevronLeft = ChevronLeftIcon()
    const IconChevronRight = ChevronRightIcon()

    const visiblePages = computed(() => {
      const { page, totalPages } = pagination.value
      const pages = []
      const start = Math.max(1, page - 2)
      const end = Math.min(totalPages, page + 2)
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      return pages
    })

    const loadStats = async () => {
      try {
        const result = await api.anomalies.stats()
        stats.value = result || {
          open: 0,
          critical: 0,
          resolved: 0,
          falsePositive: 0
        }
      } catch (error) {
        console.error('Failed to load stats:', error)
      }
    }

    const loadAnomalies = async () => {
      loading.value = true
      try {
        const params = {
          page: pagination.value.page,
          pageSize: pagination.value.pageSize,
          search: searchQuery.value,
          ...filters.value
        }
        
        Object.keys(params).forEach(key => {
          if (params[key] === '' || params[key] === null || params[key] === undefined) {
            delete params[key]
          }
        })

        const result = await api.anomalies.list(params)
        anomalies.value = result.items || []
        pagination.value = {
          page: result.page || 1,
          pageSize: result.pageSize || 20,
          total: result.total || 0,
          totalPages: result.totalPages || 0
        }
      } catch (error) {
        console.error('Failed to load anomalies:', error)
        showNotification('error', '加载失败', error.message)
      } finally {
        loading.value = false
      }
    }

    const changePage = (page) => {
      pagination.value.page = page
      loadAnomalies()
    }

    const toggleSelectAll = () => {
      if (isAllSelected.value) {
        selectedIds.value = anomalies.value.map(a => a.id)
      } else {
        selectedIds.value = []
      }
    }

    const updateSelectAll = () => {
      isAllSelected.value = selectedIds.value.length === anomalies.value.length
    }

    const acknowledgeAnomaly = async (anomaly) => {
      try {
        await api.anomalies.update(anomaly.id, { status: 'acknowledged' })
        showNotification('success', '已确认', '异常已标记为已确认')
        loadAnomalies()
        loadStats()
      } catch (error) {
        showNotification('error', '操作失败', error.message)
      }
    }

    const resolveAnomaly = async (anomaly) => {
      selectedAnomaly.value = anomaly
      handleForm.value = {
        status: 'resolved',
        handledBy: '',
        note: ''
      }
      showDetailModal.value = true
    }

    const batchAcknowledge = async () => {
      try {
        for (const id of selectedIds.value) {
          await api.anomalies.update(id, { status: 'acknowledged' })
        }
        showNotification('success', '批量操作成功', `已确认 ${selectedIds.value.length} 个异常`)
        selectedIds.value = []
        isAllSelected.value = false
        loadAnomalies()
        loadStats()
      } catch (error) {
        showNotification('error', '批量操作失败', error.message)
      }
    }

    const batchResolve = async () => {
      showNotification('info', '提示', '请逐个处理并填写备注')
    }

    const showDetail = (anomaly) => {
      selectedAnomaly.value = anomaly
      handleForm.value = {
        status: anomaly.status === 'open' ? 'acknowledged' : anomaly.status,
        handledBy: '',
        note: ''
      }
      showDetailModal.value = true
    }

    const submitHandle = async () => {
      if (!handleForm.value.handledBy.trim()) {
        showNotification('warning', '请填写处理人', '处理人姓名不能为空')
        return
      }

      submitting.value = true
      try {
        await api.anomalies.handle(selectedAnomaly.value.id, {
          status: handleForm.value.status,
          handledBy: handleForm.value.handledBy,
          note: handleForm.value.note
        })
        
        showNotification('success', '处理成功', '异常状态已更新')
        showDetailModal.value = false
        loadAnomalies()
        loadStats()
      } catch (error) {
        showNotification('error', '处理失败', error.message)
      } finally {
        submitting.value = false
      }
    }

    const formatTime = (date) => formatRelativeTime(date)

    const getAnomalyBadgeClass = (type) => {
      return 'badge-danger'
    }

    const getSeverityBadgeClass = (severity) => {
      const classes = {
        'critical': 'badge-danger',
        'high': 'badge-warning',
        'medium': 'badge-primary',
        'low': 'badge-success',
        'info': 'badge-secondary'
      }
      return classes[severity] || 'badge-secondary'
    }

    const getStatusBadgeClass = (status) => {
      const classes = {
        'open': 'badge-danger',
        'acknowledged': 'badge-warning',
        'investigating': 'badge-primary',
        'resolved': 'badge-success',
        'false_positive': 'badge-secondary'
      }
      return classes[status] || 'badge-secondary'
    }

    const getRiskScoreColor = (score) => {
      if (score >= 80) return '#dc2626'
      if (score >= 60) return '#ea580c'
      if (score >= 40) return '#f59e0b'
      if (score >= 20) return '#3b82f6'
      return '#10b981'
    }

    const showNotification = (type, title, message) => {
      const event = new CustomEvent('notification', {
        detail: { type, title, message }
      })
      window.dispatchEvent(event)
    }

    onMounted(() => {
      loadStats()
      loadAnomalies()
    })

    return {
      loading,
      anomalies,
      selectedIds,
      isAllSelected,
      searchQuery,
      filters,
      pagination,
      stats,
      visiblePages,
      showDetailModal,
      selectedAnomaly,
      handleForm,
      submitting,
      IconRefresh,
      IconSearch,
      IconClose,
      IconChevronLeft,
      IconChevronRight,
      loadStats,
      loadAnomalies,
      changePage,
      toggleSelectAll,
      updateSelectAll,
      acknowledgeAnomaly,
      resolveAnomaly,
      batchAcknowledge,
      batchResolve,
      showDetail,
      submitHandle,
      formatTime,
      formatDateTime,
      getAnomalyTypeLabel,
      getSeverityLabel,
      getStatusLabel,
      getAnomalyBadgeClass,
      getSeverityBadgeClass,
      getStatusBadgeClass,
      getRiskScoreColor
    }
  }
}
</script>

<style scoped>
.risk-score {
  font-size: 18px;
  font-weight: 700;
}

.action-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-gray-600);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-gray-200);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 12px;
  color: var(--color-gray-500);
}
</style>
