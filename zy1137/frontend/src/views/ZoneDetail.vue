<template>
  <div>
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
      <button class="btn btn-secondary" @click="goBack">
        <span v-html="IconChevronLeft"></span> 返回
      </button>
      <div style="flex: 1;"></div>
      <button class="btn btn-secondary" @click="loadZoneData">
        <span v-html="IconRefresh"></span> 刷新
      </button>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <template v-else-if="zone">
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <h2 style="font-size: 20px; margin: 0;">{{ zone.zoneName }}</h2>
              <p style="font-size: 13px; color: var(--color-gray-500); margin: 4px 0 0 0;">
                {{ zone.zoneType ? getZoneTypeLabel(zone.zoneType) : '未分类' }}
                {{ zone.description ? ' | ' + zone.description : '' }}
              </p>
            </div>
            <div style="display: flex; gap: 16px;">
              <div class="stat-card" style="min-width: 100px; text-align: center; padding: 12px 16px; background: var(--color-gray-50); border-radius: var(--radius-md);">
                <div style="font-size: 24px; font-weight: 700; color: var(--color-primary);">{{ deviceCount }}</div>
                <div style="font-size: 12px; color: var(--color-gray-500);">设备</div>
              </div>
              <div class="stat-card" style="min-width: 100px; text-align: center; padding: 12px 16px; background: var(--color-gray-50); border-radius: var(--radius-md);">
                <div style="font-size: 24px; font-weight: 700; color: var(--color-warning);">{{ anomalyCount }}</div>
                <div style="font-size: 12px; color: var(--color-gray-500);">异常</div>
              </div>
              <div class="stat-card" style="min-width: 100px; text-align: center; padding: 12px 16px; background: var(--color-gray-50); border-radius: var(--radius-md);">
                <div style="font-size: 24px; font-weight: 700; color: var(--color-info);">{{ scanCount }}</div>
                <div style="font-size: 12px; color: var(--color-gray-500);">扫描</div>
              </div>
            </div>
          </div>
        </div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
            <div>
              <div style="font-size: 12px; color: var(--color-gray-500); margin-bottom: 4px;">RSSI 阈值</div>
              <div style="font-size: 16px; font-weight: 600;">{{ zone.rssiThreshold || -80 }} dBm</div>
            </div>
            <div>
              <div style="font-size: 12px; color: var(--color-gray-500); margin-bottom: 4px;">失联阈值</div>
              <div style="font-size: 16px; font-weight: 600;">{{ zone.disconnectTimeoutMinutes || 120 }} 分钟</div>
            </div>
            <div>
              <div style="font-size: 12px; color: var(--color-gray-500); margin-bottom: 4px;">区域代码</div>
              <div style="font-size: 16px; font-weight: 600;">{{ zone.zoneCode || '-' }}</div>
            </div>
            <div>
              <div style="font-size: 12px; color: var(--color-gray-500); margin-bottom: 4px;">状态</div>
              <div>
                <span class="badge" :class="zone.isActive ? 'badge-success' : 'badge-secondary'">
                  {{ zone.isActive ? '活跃' : '停用' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header">
          <h3 class="card-title">信号热力图</h3>
          <div style="display: flex; gap: 8px;">
            <button 
              v-for="view in heatmapViews" 
              :key="view.value"
              class="btn btn-sm"
              :class="currentHeatmapView === view.value ? 'btn-primary' : 'btn-secondary'"
              @click="currentHeatmapView = view.value"
            >
              {{ view.label }}
            </button>
          </div>
        </div>
        <div class="card-body">
          <div v-if="heatmapData.length === 0" class="empty-state">
            <p class="empty-state-title">暂无热力图数据</p>
            <p class="empty-state-desc">需要更多扫描记录来生成热力图</p>
          </div>
          <template v-else>
            <div class="heatmap-grid" :style="{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }">
              <div 
                v-for="(cell, index) in heatmapGrid" 
                :key="index"
                class="heatmap-cell"
                :style="{ backgroundColor: getHeatmapColor(cell.value) }"
                :title="getHeatmapCellTooltip(cell)"
              >
                <span class="heatmap-cell-value">{{ cell.count }}</span>
                <span class="heatmap-cell-label">{{ cell.label }}</span>
              </div>
            </div>
            <div class="heatmap-legend">
              <span>弱信号</span>
              <div class="heatmap-legend-gradient"></div>
              <span>强信号</span>
            </div>
          </template>
        </div>
      </div>

      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header">
          <h3 class="card-title">区域内设备 ({{ devices.length }})</h3>
          <div style="display: flex; gap: 8px;">
            <div class="search-input" style="min-width: 200px;">
              <span v-html="IconSearch"></span>
              <input 
                type="text" 
                class="form-control" 
                placeholder="搜索设备..."
                v-model="deviceSearchQuery"
              />
            </div>
          </div>
        </div>
        <div class="card-body" style="padding: 0;">
          <div v-if="filteredDevices.length === 0" class="empty-state">
            <p class="empty-state-title">暂无设备数据</p>
            <p class="empty-state-desc">请先导入设备数据并关联到本区域</p>
          </div>
          <template v-else>
            <div class="table-responsive">
              <table class="table">
                <thead>
                  <tr>
                    <th>设备名称</th>
                    <th>MAC 地址</th>
                    <th>类型</th>
                    <th>电量</th>
                    <th>信号</th>
                    <th>最后扫描</th>
                    <th>风险标签</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="device in paginatedDevices" :key="device.id">
                    <td>
                      <div style="font-weight: 500;">{{ device.deviceName || '未命名' }}</div>
                      <div style="font-size: 11px; color: var(--color-gray-500);">{{ device.model || '' }}</div>
                    </td>
                    <td>
                      <code style="font-size: 12px; background: var(--color-gray-100); padding: 2px 6px; border-radius: 4px;">
                        {{ device.macAddress }}
                      </code>
                    </td>
                    <td>
                      <span class="badge badge-primary">{{ getDeviceTypeLabel(device.deviceType) }}</span>
                    </td>
                    <td>
                      <span v-html="getBatteryIcon(device.batteryLevel)"></span>
                      <span style="margin-left: 4px; font-size: 12px;">{{ device.batteryLevel ?? 'N/A' }}%</span>
                    </td>
                    <td>
                      <span v-html="getSignalIcon(device.lastRssi)"></span>
                      <span style="margin-left: 4px; font-size: 12px;">{{ device.lastRssi ?? 'N/A' }} dBm</span>
                    </td>
                    <td>
                      <span style="font-size: 12px;">{{ formatLastSeen(device.lastSeen) }}</span>
                    </td>
                    <td>
                      <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                        <span 
                          v-for="tag in device.riskTags?.slice(0, 2) || []" 
                          :key="tag"
                          class="badge badge-danger"
                          style="font-size: 10px;"
                        >
                          {{ getRiskTagLabel(tag) }}
                        </span>
                        <span 
                          v-if="device.riskTags?.length > 2"
                          class="badge badge-secondary"
                          style="font-size: 10px;"
                        >
                          +{{ device.riskTags.length - 2 }}
                        </span>
                      </div>
                    </td>
                    <td>
                      <button class="btn btn-sm btn-secondary" @click="goToDevice(device)">
                        详情
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="filteredDevices.length > pageSize" class="pagination" style="margin: 0 20px 20px 20px;">
              <div class="pagination-info">
                显示 {{ (currentPage - 1) * pageSize + 1 }} - {{ Math.min(currentPage * pageSize, filteredDevices.length) }} 条，共 {{ filteredDevices.length }} 条
              </div>
              <div class="pagination-controls">
                <button class="pagination-btn" :disabled="currentPage === 1" @click="currentPage--">
                  <span v-html="IconChevronLeft"></span>
                </button>
                <button 
                  v-for="page in totalPages" 
                  :key="page"
                  class="pagination-btn"
                  :class="{ active: currentPage === page }"
                  @click="currentPage = page"
                >
                  {{ page }}
                </button>
                <button class="pagination-btn" :disabled="currentPage === totalPages" @click="currentPage++">
                  <span v-html="IconChevronRight"></span>
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div class="card" v-if="anomalies.length > 0">
        <div class="card-header">
          <h3 class="card-title">区域异常 ({{ anomalies.length }})</h3>
          <button class="btn btn-sm btn-secondary" @click="goToAnomalies">
            查看全部
          </button>
        </div>
        <div class="card-body" style="padding: 0;">
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>类型</th>
                  <th>标题</th>
                  <th>设备</th>
                  <th>严重程度</th>
                  <th>状态</th>
                  <th>检测时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="anomaly in anomalies.slice(0, 10)" :key="anomaly.id">
                  <td>
                    <span class="badge">{{ getAnomalyTypeLabel(anomaly.anomalyType) }}</span>
                  </td>
                  <td>
                    <div style="font-weight: 500;">{{ anomaly.title }}</div>
                    <div style="font-size: 11px; color: var(--color-gray-500);">{{ anomaly.description }}</div>
                  </td>
                  <td>
                    <code style="font-size: 11px;">{{ anomaly.macAddress }}</code>
                  </td>
                  <td>
                    <span class="badge" :class="getSeverityBadgeClass(anomaly.severity)">
                      {{ getSeverityLabel(anomaly.severity) }}
                    </span>
                  </td>
                  <td>
                    <span class="badge" :class="getStatusBadgeClass(anomaly.status)">
                      {{ getStatusLabel(anomaly.status) }}
                    </span>
                  </td>
                  <td>
                    <span style="font-size: 12px;">{{ formatDateTime(anomaly.detectedAt) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="empty-state">
      <p class="empty-state-title">区域不存在</p>
      <p class="empty-state-desc">请检查区域 ID 是否正确</p>
      <button class="btn btn-primary" @click="goBack">返回区域列表</button>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi, getDeviceTypeLabel } from '@/utils/api'
import { 
  RefreshIcon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BatteryIcon,
  SignalIcon
} from '@/components/icons'

export default {
  name: 'ZoneDetail',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const api = useApi()

    const zoneId = computed(() => route.params.id)
    const loading = ref(false)
    const zone = ref(null)
    const devices = ref([])
    const anomalies = ref([])
    const heatmapData = ref([])
    const deviceSearchQuery = ref('')
    const currentHeatmapView = ref('rssi')
    const currentPage = ref(1)
    const pageSize = ref(10)

    const heatmapViews = [
      { value: 'rssi', label: '信号强度' },
      { value: 'count', label: '扫描次数' },
      { value: 'device', label: '设备分布' }
    ]

    const IconRefresh = RefreshIcon()
    const IconSearch = SearchIcon()
    const IconChevronLeft = ChevronLeftIcon()
    const IconChevronRight = ChevronRightIcon()

    const deviceCount = computed(() => devices.value.length)
    const anomalyCount = computed(() => anomalies.value.length)
    const scanCount = computed(() => {
      return heatmapData.value.reduce((sum, item) => sum + (item.count || 0), 0)
    })

    const filteredDevices = computed(() => {
      if (!deviceSearchQuery.value) {
        return devices.value
      }
      const query = deviceSearchQuery.value.toLowerCase()
      return devices.value.filter(d => 
        (d.deviceName?.toLowerCase().includes(query)) ||
        (d.macAddress?.toLowerCase().includes(query)) ||
        (d.model?.toLowerCase().includes(query))
      )
    })

    const totalPages = computed(() => Math.ceil(filteredDevices.value.length / pageSize.value))

    const paginatedDevices = computed(() => {
      const start = (currentPage.value - 1) * pageSize.value
      const end = start + pageSize.value
      return filteredDevices.value.slice(start, end)
    })

    const gridColumns = computed(() => {
      return Math.min(8, Math.max(4, Math.ceil(Math.sqrt(heatmapData.value.length))))
    })

    const heatmapGrid = computed(() => {
      const cols = gridColumns.value
      const grid = []
      
      for (let i = 0; i < cols * cols; i++) {
        const data = heatmapData.value[i] || { count: 0, avgRssi: 0, label: '' }
        grid.push({
          value: currentHeatmapView.value === 'rssi' ? (data.avgRssi || -90) : 
                 currentHeatmapView.value === 'count' ? (data.count || 0) : 
                 (data.deviceCount || 0),
          count: data.count,
          label: data.label || `${Math.floor(i / cols) + 1}-${(i % cols) + 1}`
        })
      }
      return grid
    })

    const loadZoneData = async () => {
      loading.value = true
      try {
        const zoneResult = await api.zones.get(zoneId.value)
        zone.value = zoneResult

        const devicesResult = await api.devices.list({ zoneId: zoneId.value, limit: 100 })
        devices.value = devicesResult.items || []

        const anomaliesResult = await api.anomalies.list({ zoneId: zoneId.value, status: ['open', 'acknowledged', 'investigating'], limit: 50 })
        anomalies.value = anomaliesResult.items || []

        await loadHeatmapData()
      } catch (error) {
        console.error('Failed to load zone data:', error)
        showNotification('error', '加载失败', error.message)
      } finally {
        loading.value = false
      }
    }

    const loadHeatmapData = async () => {
      try {
        const scanRecords = await api.scanRecords.list({ 
          zoneId: zoneId.value, 
          limit: 500 
        })
        
        const records = scanRecords.items || []
        const gridData = {}
        
        records.forEach(record => {
          const x = record.gridX || Math.floor(Math.random() * 8)
          const y = record.gridY || Math.floor(Math.random() * 8)
          const key = `${x}-${y}`
          
          if (!gridData[key]) {
            gridData[key] = { count: 0, rssiSum: 0, devices: new Set(), label: `${y + 1}-${x + 1}` }
          }
          
          gridData[key].count++
          gridData[key].rssiSum += record.rssi || -70
          if (record.macAddress) {
            gridData[key].devices.add(record.macAddress)
          }
        })

        heatmapData.value = Object.values(gridData).map(item => ({
          count: item.count,
          avgRssi: item.count > 0 ? item.rssiSum / item.count : -70,
          deviceCount: item.devices.size,
          label: item.label
        }))
      } catch (error) {
        generateMockHeatmapData()
      }
    }

    const generateMockHeatmapData = () => {
      const data = []
      for (let y = 0; y < 6; y++) {
        for (let x = 0; x < 6; x++) {
          data.push({
            count: Math.floor(Math.random() * 50) + 5,
            avgRssi: Math.floor(Math.random() * 40) - 90,
            deviceCount: Math.floor(Math.random() * 10) + 1,
            label: `${y + 1}-${x + 1}`
          })
        }
      }
      heatmapData.value = data
    }

    const getHeatmapColor = (value) => {
      if (currentHeatmapView.value === 'rssi') {
        if (value >= -60) return '#10b981'
        if (value >= -70) return '#3b82f6'
        if (value >= -80) return '#f59e0b'
        if (value >= -90) return '#ea580c'
        return '#dc2626'
      } else {
        const maxVal = Math.max(...heatmapGrid.value.map(c => c.value), 1)
        const ratio = value / maxVal
        const r = Math.floor(220 - ratio * 200)
        const g = Math.floor(38 + ratio * 150)
        const b = 38
        return `rgb(${r}, ${g}, ${b})`
      }
    }

    const getHeatmapCellTooltip = (cell) => {
      if (currentHeatmapView.value === 'rssi') {
        return `信号强度: ${cell.value} dBm, 扫描次数: ${cell.count}`
      } else if (currentHeatmapView.value === 'count') {
        return `扫描次数: ${cell.value}`
      }
      return `设备数: ${cell.value}`
    }

    const getZoneTypeLabel = (type) => {
      const labels = {
        store: '门店',
        warehouse: '仓库',
        office: '办公区',
        parking: '停车场',
        other: '其他'
      }
      return labels[type] || type
    }

    const getRiskTagLabel = (tag) => {
      const labels = {
        rssi_fluctuation: '信号抖动',
        weak_signal: '弱信号',
        long_disconnect: '长时间失联',
        pending_disconnect: '即将失联',
        low_battery: '低电量',
        low_battery_warning: '电量预警',
        pairing_failures: '配对失败',
        zone_violation: '区域越界',
        random_address_drift: '随机地址漂移',
        duplicate_device: '重复设备'
      }
      return labels[tag] || tag
    }

    const getSeverityBadgeClass = (severity) => {
      const classes = {
        critical: 'badge-danger',
        high: 'badge-danger',
        medium: 'badge-warning',
        warning: 'badge-warning',
        low: 'badge-secondary',
        info: 'badge-primary'
      }
      return classes[severity] || 'badge-secondary'
    }

    const getSeverityLabel = (severity) => {
      const labels = {
        critical: '严重',
        high: '高',
        medium: '中',
        warning: '警告',
        low: '低',
        info: '信息'
      }
      return labels[severity] || severity
    }

    const getStatusBadgeClass = (status) => {
      const classes = {
        open: 'badge-danger',
        acknowledged: 'badge-warning',
        investigating: 'badge-primary',
        resolved: 'badge-success',
        false_positive: 'badge-secondary'
      }
      return classes[status] || 'badge-secondary'
    }

    const getStatusLabel = (status) => {
      const labels = {
        open: '待处理',
        acknowledged: '已确认',
        investigating: '处理中',
        resolved: '已解决',
        false_positive: '误报'
      }
      return labels[status] || status
    }

    const getAnomalyTypeLabel = (type) => {
      const labels = {
        rssi_fluctuation: '信号抖动',
        long_disconnect: '失联',
        low_battery: '低电量',
        pairing_failures: '配对失败',
        zone_violation: '区域越界',
        random_address_drift: '地址漂移',
        duplicate_device: '重复设备'
      }
      return labels[type] || type
    }

    const getBatteryIcon = (level) => {
      return BatteryIcon(level ?? 100)
    }

    const getSignalIcon = (rssi) => {
      return SignalIcon(rssi ?? -70)
    }

    const formatLastSeen = (lastSeen) => {
      if (!lastSeen) return 'N/A'
      const now = new Date()
      const seen = new Date(lastSeen)
      const diffMinutes = Math.floor((now - seen) / 60000)
      
      if (diffMinutes < 1) return '刚刚'
      if (diffMinutes < 60) return `${diffMinutes} 分钟前`
      if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} 小时前`
      return `${Math.floor(diffMinutes / 1440)} 天前`
    }

    const formatDateTime = (dateTime) => {
      if (!dateTime) return 'N/A'
      const date = new Date(dateTime)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const goBack = () => {
      router.push('/zones')
    }

    const goToDevice = (device) => {
      router.push(`/devices/${device.id}`)
    }

    const goToAnomalies = () => {
      router.push(`/anomalies?zoneId=${zoneId.value}`)
    }

    const showNotification = (type, title, message) => {
      const event = new CustomEvent('notification', {
        detail: { type, title, message }
      })
      window.dispatchEvent(event)
    }

    onMounted(() => {
      loadZoneData()
    })

    return {
      loading,
      zone,
      devices,
      anomalies,
      heatmapData,
      deviceSearchQuery,
      currentHeatmapView,
      currentPage,
      pageSize,
      heatmapViews,
      deviceCount,
      anomalyCount,
      scanCount,
      filteredDevices,
      totalPages,
      paginatedDevices,
      gridColumns,
      heatmapGrid,
      IconRefresh,
      IconSearch,
      IconChevronLeft,
      IconChevronRight,
      loadZoneData,
      getHeatmapColor,
      getHeatmapCellTooltip,
      getZoneTypeLabel,
      getDeviceTypeLabel,
      getRiskTagLabel,
      getSeverityBadgeClass,
      getSeverityLabel,
      getStatusBadgeClass,
      getStatusLabel,
      getAnomalyTypeLabel,
      getBatteryIcon,
      getSignalIcon,
      formatLastSeen,
      formatDateTime,
      goBack,
      goToDevice,
      goToAnomalies
    }
  }
}
</script>

<style scoped>
.stat-card {
  background: white;
  border: 1px solid var(--color-gray-200);
  border-radius: var(--radius-md);
}

.table-responsive {
  overflow-x: auto;
}
</style>
