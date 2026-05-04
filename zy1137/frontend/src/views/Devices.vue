<template>
  <div>
    <div class="filter-bar">
      <div class="search-input">
        <span v-html="IconSearch"></span>
        <input 
          type="text" 
          class="form-control" 
          placeholder="搜索设备名称、MAC地址..."
          v-model="searchQuery"
          @keyup.enter="loadDevices"
        />
      </div>
      <div class="filter-item">
        <label>设备类型:</label>
        <select class="form-control form-select" v-model="filters.deviceType" @change="loadDevices">
          <option value="">全部类型</option>
          <option value="esl">电子价签</option>
          <option value="printer">小票打印机</option>
          <option value="beacon">Beacon信标</option>
          <option value="scanner">扫码枪</option>
          <option value="headset">员工耳机</option>
          <option value="other">其他设备</option>
        </select>
      </div>
      <div class="filter-item">
        <label>状态:</label>
        <select class="form-control form-select" v-model="filters.status" @change="loadDevices">
          <option value="">全部状态</option>
          <option value="active">活跃</option>
          <option value="inactive">停用</option>
          <option value="maintenance">维护中</option>
          <option value="missing">丢失</option>
        </select>
      </div>
      <div class="filter-item">
        <label>风险标签:</label>
        <select class="form-control form-select" v-model="filters.riskTag" @change="loadDevices">
          <option value="">全部风险</option>
          <option value="rssi_fluctuation">RSSI波动</option>
          <option value="long_disconnect">长时间失联</option>
          <option value="low_battery">低电量</option>
          <option value="pairing_failures">配对失败</option>
          <option value="zone_violation">区域越界</option>
        </select>
      </div>
      <button class="btn btn-secondary" @click="loadDevices">
        <span v-html="IconRefresh"></span> 刷新
      </button>
      <router-link to="/import" class="btn btn-primary">
        <span v-html="IconUpload"></span> 导入
      </router-link>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">设备列表 ({{ pagination.total }})</h3>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-sm btn-secondary" @click="selectAll">
            全选
          </button>
          <button class="btn btn-sm btn-secondary" @click="clearSelection">
            取消
          </button>
          <button 
            class="btn btn-sm btn-danger" 
            :disabled="selectedIds.length === 0"
            @click="batchAction"
          >
            批量操作
          </button>
        </div>
      </div>
      <div class="card-body" style="padding: 0;">
        <div v-if="loading" class="loading">
          <div class="spinner"></div>
        </div>
        <div v-else-if="devices.length === 0" class="empty-state">
          <p class="empty-state-title">暂无设备数据</p>
          <p class="empty-state-desc">请先导入设备数据或调整筛选条件</p>
          <router-link to="/import" class="btn btn-primary">导入设备</router-link>
        </div>
        <div v-else class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th style="width: 40px;">
                  <input type="checkbox" v-model="isAllSelected" @change="toggleSelectAll" />
                </th>
                <th>设备名称</th>
                <th>MAC地址</th>
                <th>设备类型</th>
                <th>状态</th>
                <th>电量</th>
                <th>信号强度</th>
                <th>风险标签</th>
                <th>最后扫描</th>
                <th style="width: 120px;">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="device in devices" :key="device.id" 
                  :class="{ 'selected': selectedIds.includes(device.id) }">
                <td>
                  <input 
                    type="checkbox" 
                    :value="device.id" 
                    v-model="selectedIds"
                    @change="updateSelectAll"
                  />
                </td>
                <td>
                  <router-link :to="`/devices/${device.id}`" class="device-name">
                    {{ device.deviceName || '未命名设备' }}
                  </router-link>
                </td>
                <td>
                  <code class="mac-address">{{ device.macAddress }}</code>
                </td>
                <td>
                  <span class="badge" :style="getDeviceTypeBadgeStyle(device.deviceType)">
                    {{ getDeviceTypeLabel(device.deviceType) }}
                  </span>
                </td>
                <td>
                  <span class="badge" :class="getStatusBadgeClass(device.status)">
                    {{ getStatusLabel(device.status) }}
                  </span>
                </td>
                <td>
                  <div class="battery-display" v-if="device.batteryLevel !== null && device.batteryLevel !== undefined">
                    <span class="battery-level" :style="{ color: getBatteryColor(device.batteryLevel) }">
                      {{ device.batteryLevel }}%
                    </span>
                    <span v-html="IconBattery(device.batteryLevel)"></span>
                  </div>
                  <span class="badge badge-secondary" v-else>-</span>
                </td>
                <td>
                  <div class="signal-display" v-if="device.lastRSSI !== null && device.lastRSSI !== undefined">
                    <span class="signal-value" :style="{ color: getRSSIColor(device.lastRSSI) }">
                      {{ device.lastRSSI }} dBm
                    </span>
                    <span v-html="IconSignal(device.lastRSSI)"></span>
                  </div>
                  <span class="badge badge-secondary" v-else>-</span>
                </td>
                <td>
                  <div class="risk-tags">
                    <span 
                      v-for="tag in (device.riskTags || []).slice(0, 2)" 
                      :key="tag"
                      class="badge badge-danger"
                      style="font-size: 11px; margin-right: 4px; margin-bottom: 4px;"
                    >
                      {{ getRiskTagLabel(tag) }}
                    </span>
                    <span 
                      v-if="(device.riskTags || []).length > 2"
                      class="badge badge-secondary"
                      style="font-size: 11px;"
                    >
                      +{{ (device.riskTags || []).length - 2 }}
                    </span>
                  </div>
                </td>
                <td>
                  <span class="last-scan">
                    {{ device.lastSeenAt ? formatTime(device.lastSeenAt) : '-' }}
                  </span>
                </td>
                <td>
                  <div class="action-buttons">
                    <router-link :to="`/devices/${device.id}`" class="btn btn-sm btn-secondary" title="查看详情">
                      详情
                    </router-link>
                    <button class="btn btn-sm btn-primary" @click="handleDevice(device)" title="处理">
                      处理
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

    <div v-if="showHandleModal" class="modal-overlay" @click.self="showHandleModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">处理设备: {{ selectedDevice?.deviceName }}</h3>
          <button class="modal-close" @click="showHandleModal = false" v-html="IconClose"></button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">处理操作</label>
            <select class="form-control form-select" v-model="handleAction">
              <option value="acknowledge">标记已确认</option>
              <option value="investigate">标记调查中</option>
              <option value="resolve">标记已解决</option>
              <option value="false_positive">标记误报</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">处理人</label>
            <input type="text" class="form-control" v-model="handleHandler" placeholder="请输入处理人姓名" />
          </div>
          <div class="form-group">
            <label class="form-label">备注说明</label>
            <textarea 
              class="form-control" 
              rows="4" 
              v-model="handleNote"
              placeholder="请输入处理备注..."
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showHandleModal = false">取消</button>
          <button class="btn btn-primary" @click="submitHandle" :disabled="submitting">
            {{ submitting ? '提交中...' : '确认提交' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useApi, formatRelativeTime, getStatusLabel, getDeviceTypeLabel } from '@/utils/api'
import { 
  RefreshIcon,
  UploadIcon,
  SearchIcon,
  CloseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BatteryIcon,
  SignalIcon
} from '@/components/icons'

export default {
  name: 'Devices',
  setup() {
    const route = useRoute()
    const api = useApi()

    const loading = ref(false)
    const devices = ref([])
    const selectedIds = ref([])
    const isAllSelected = ref(false)
    const searchQuery = ref('')
    const filters = ref({
      deviceType: '',
      status: '',
      riskTag: ''
    })
    const pagination = ref({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0
    })

    const showHandleModal = ref(false)
    const selectedDevice = ref(null)
    const handleAction = ref('acknowledge')
    const handleHandler = ref('')
    const handleNote = ref('')
    const submitting = ref(false)

    const IconRefresh = RefreshIcon()
    const IconUpload = UploadIcon()
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

    const loadDevices = async () => {
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

        const result = await api.devices.list(params)
        devices.value = result.items || []
        pagination.value = {
          page: result.page || 1,
          pageSize: result.pageSize || 20,
          total: result.total || 0,
          totalPages: result.totalPages || 0
        }
      } catch (error) {
        console.error('Failed to load devices:', error)
        showNotification('error', '加载失败', error.message)
      } finally {
        loading.value = false
      }
    }

    const changePage = (page) => {
      pagination.value.page = page
      loadDevices()
    }

    const toggleSelectAll = () => {
      if (isAllSelected.value) {
        selectedIds.value = devices.value.map(d => d.id)
      } else {
        selectedIds.value = []
      }
    }

    const updateSelectAll = () => {
      isAllSelected.value = selectedIds.value.length === devices.value.length
    }

    const selectAll = () => {
      selectedIds.value = devices.value.map(d => d.id)
      isAllSelected.value = true
    }

    const clearSelection = () => {
      selectedIds.value = []
      isAllSelected.value = false
    }

    const batchAction = () => {
      showNotification('info', '提示', `已选择 ${selectedIds.value.length} 个设备`)
    }

    const handleDevice = (device) => {
      selectedDevice.value = device
      handleAction.value = 'acknowledge'
      handleHandler.value = ''
      handleNote.value = ''
      showHandleModal.value = true
    }

    const submitHandle = async () => {
      if (!handleHandler.value.trim()) {
        showNotification('warning', '请填写处理人', '处理人姓名不能为空')
        return
      }

      submitting.value = true
      try {
        await api.devices.update(selectedDevice.value.id, {
          note: handleNote.value
        })
        
        showNotification('success', '处理成功', '设备状态已更新')
        showHandleModal.value = false
        loadDevices()
      } catch (error) {
        showNotification('error', '处理失败', error.message)
      } finally {
        submitting.value = false
      }
    }

    const formatTime = (date) => formatRelativeTime(date)

    const getDeviceTypeBadgeStyle = (type) => {
      const colors = {
        'esl': '#3b82f6',
        'printer': '#10b981',
        'beacon': '#8b5cf6',
        'scanner': '#f59e0b',
        'headset': '#ec4899',
        'other': '#6b7280'
      }
      const color = colors[type] || '#6b7280'
      return {
        background: `rgba(${parseInt(color.slice(1,3),16)}, ${parseInt(color.slice(3,5),16)}, ${parseInt(color.slice(5,7),16)}, 0.1)`,
        color: color
      }
    }

    const getStatusBadgeClass = (status) => {
      const classes = {
        'active': 'badge-success',
        'inactive': 'badge-secondary',
        'maintenance': 'badge-warning',
        'missing': 'badge-danger'
      }
      return classes[status] || 'badge-secondary'
    }

    const getBatteryColor = (level) => {
      if (level < 10) return '#dc2626'
      if (level < 20) return '#f59e0b'
      if (level < 50) return '#3b82f6'
      return '#10b981'
    }

    const getRSSIColor = (rssi) => {
      if (rssi >= -60) return '#10b981'
      if (rssi >= -70) return '#3b82f6'
      if (rssi >= -80) return '#f59e0b'
      if (rssi >= -90) return '#ea580c'
      return '#dc2626'
    }

    const getRiskTagLabel = (tag) => {
      const labels = {
        'rssi_fluctuation': '信号波动',
        'long_disconnect': '长时间失联',
        'duplicate_device': '重复设备',
        'random_address_drift': '地址漂移',
        'low_battery': '低电量',
        'pairing_failures': '配对失败',
        'zone_violation': '区域越界'
      }
      return labels[tag] || tag
    }

    const IconBattery = (level) => BatteryIcon(level)
    const IconSignal = (rssi) => SignalIcon(rssi)

    const showNotification = (type, title, message) => {
      const event = new CustomEvent('notification', {
        detail: { type, title, message }
      })
      window.dispatchEvent(event)
    }

    watch(() => route.query.type, (newType) => {
      if (newType) {
        filters.value.deviceType = newType
        loadDevices()
      }
    })

    onMounted(() => {
      if (route.query.type) {
        filters.value.deviceType = route.query.type
      }
      loadDevices()
    })

    return {
      loading,
      devices,
      selectedIds,
      isAllSelected,
      searchQuery,
      filters,
      pagination,
      visiblePages,
      showHandleModal,
      selectedDevice,
      handleAction,
      handleHandler,
      handleNote,
      submitting,
      IconRefresh,
      IconUpload,
      IconSearch,
      IconClose,
      IconChevronLeft,
      IconChevronRight,
      IconBattery,
      IconSignal,
      loadDevices,
      changePage,
      toggleSelectAll,
      updateSelectAll,
      selectAll,
      clearSelection,
      batchAction,
      handleDevice,
      submitHandle,
      formatTime,
      getDeviceTypeLabel,
      getDeviceTypeBadgeStyle,
      getStatusLabel,
      getStatusBadgeClass,
      getBatteryColor,
      getRSSIColor,
      getRiskTagLabel
    }
  }
}
</script>

<style scoped>
.device-name {
  font-weight: 500;
  color: var(--color-gray-900);
}

.device-name:hover {
  color: var(--color-primary);
}

.mac-address {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
  color: var(--color-gray-600);
  background: var(--color-gray-100);
  padding: 2px 6px;
  border-radius: 4px;
}

.battery-display,
.signal-display {
  display: flex;
  align-items: center;
  gap: 6px;
}

.battery-level,
.signal-value {
  font-weight: 500;
  font-size: 13px;
}

.risk-tags {
  display: flex;
  flex-wrap: wrap;
}

.last-scan {
  font-size: 12px;
  color: var(--color-gray-500);
}

.action-buttons {
  display: flex;
  gap: 6px;
}

.selected {
  background: rgba(59, 130, 246, 0.05);
}
</style>
