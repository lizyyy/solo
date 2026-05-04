<template>
  <div>
    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
      <router-link to="/devices" class="btn btn-sm btn-secondary">
        <span v-html="IconChevronLeft"></span> 返回列表
      </router-link>
      <h2 style="margin: 0; font-size: 20px; font-weight: 600;">{{ device?.deviceName || '设备详情' }}</h2>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <template v-else-if="device">
      <div class="stats-grid" style="margin-bottom: 24px;">
        <div class="stat-card">
          <div class="stat-card-header">
            <div>
              <div class="stat-card-title">设备状态</div>
              <div class="stat-card-value">
                <span class="badge" :class="getStatusBadgeClass(device.status)" style="font-size: 16px;">
                  {{ getStatusLabel(device.status) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <div>
              <div class="stat-card-title">电量</div>
              <div class="stat-card-value" :style="{ color: getBatteryColor(device.batteryLevel) }">
                {{ device.batteryLevel !== null && device.batteryLevel !== undefined ? device.batteryLevel + '%' : '未知' }}
              </div>
            </div>
            <div class="stat-card-icon" :style="{ background: getBatteryBgColor(device.batteryLevel) }">
              <span v-html="IconBattery(device.batteryLevel || 50)"></span>
            </div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <div>
              <div class="stat-card-title">信号强度</div>
              <div class="stat-card-value" :style="{ color: getRSSIColor(device.lastRSSI) }">
                {{ device.lastRSSI !== null && device.lastRSSI !== undefined ? device.lastRSSI + ' dBm' : '未知' }}
              </div>
            </div>
            <div class="stat-card-icon" :style="{ background: getRSSIBgColor(device.lastRSSI) }">
              <span v-html="IconSignal(device.lastRSSI || -70)"></span>
            </div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <div>
              <div class="stat-card-title">最后扫描</div>
              <div class="stat-card-value" style="font-size: 16px;">
                {{ device.lastSeenAt ? formatTime(device.lastSeenAt) : '从未' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px; margin-bottom: 24px;">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">基本信息</h3>
          </div>
          <div class="card-body">
            <table class="info-table">
              <tr>
                <td class="label">设备名称</td>
                <td class="value">{{ device.deviceName || '未命名' }}</td>
              </tr>
              <tr>
                <td class="label">MAC 地址</td>
                <td class="value"><code>{{ device.macAddress }}</code></td>
              </tr>
              <tr>
                <td class="label">设备类型</td>
                <td class="value">
                  <span class="badge" :style="getDeviceTypeBadgeStyle(device.deviceType)">
                    {{ getDeviceTypeLabel(device.deviceType) }}
                  </span>
                </td>
              </tr>
              <tr>
                <td class="label">序列号</td>
                <td class="value">{{ device.serialNumber || '-' }}</td>
              </tr>
              <tr>
                <td class="label">型号</td>
                <td class="value">{{ device.model || '-' }}</td>
              </tr>
              <tr>
                <td class="label">所属区域</td>
                <td class="value">
                  <router-link v-if="device.zoneId" :to="`/zones/${device.zoneId}`" class="zone-link">
                    {{ device.zoneName || '查看区域' }}
                  </router-link>
                  <span v-else>-</span>
                </td>
              </tr>
              <tr>
                <td class="label">创建时间</td>
                <td class="value">{{ formatDateTime(device.createdAt) }}</td>
              </tr>
              <tr>
                <td class="label">更新时间</td>
                <td class="value">{{ formatDateTime(device.updatedAt) }}</td>
              </tr>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">风险标签</h3>
            <button class="btn btn-sm btn-secondary" @click="reanalyze">
              <span v-html="IconRefresh"></span> 重新分析
            </button>
          </div>
          <div class="card-body">
            <div v-if="(device.riskTags || []).length > 0" class="risk-tags-detail">
              <div v-for="tag in device.riskTags" :key="tag" class="risk-tag-item">
                <span class="badge badge-danger" style="font-size: 12px;">
                  {{ getRiskTagLabel(tag) }}
                </span>
                <span class="risk-tag-desc">{{ getRiskTagDescription(tag) }}</span>
              </div>
            </div>
            <div v-else class="empty-state" style="padding: 24px;">
              <p class="empty-state-title">无风险标签</p>
              <p class="empty-state-desc">该设备运行正常</p>
            </div>

            <div v-if="device.notes" style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--color-gray-200);">
              <h4 style="font-size: 13px; font-weight: 600; color: var(--color-gray-600); margin-bottom: 8px;">备注</h4>
              <p style="color: var(--color-gray-700); white-space: pre-wrap;">{{ device.notes }}</p>
            </div>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px; margin-bottom: 24px;">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">RSSI 信号趋势</h3>
          </div>
          <div class="card-body">
            <div class="chart-container" style="height: 250px;">
              <div v-if="scanStats.length > 0" class="signal-chart">
                <div v-for="(stat, index) in scanStats" :key="index" class="signal-bar">
                  <div class="signal-bar-label">{{ stat.label }}</div>
                  <div class="signal-bar-track">
                    <div 
                      class="signal-bar-fill"
                      :style="{ 
                        width: getBarWidth(stat.avgRSSI) + '%',
                        background: getRSSIColor(stat.avgRSSI)
                      }"
                    ></div>
                  </div>
                  <div class="signal-bar-value" :style="{ color: getRSSIColor(stat.avgRSSI) }">
                    {{ stat.avgRSSI }} dBm
                  </div>
                </div>
              </div>
              <div v-else class="empty-state" style="padding: 24px;">
                <p class="empty-state-title">暂无扫描数据</p>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">配对事件统计</h3>
          </div>
          <div class="card-body">
            <div class="pairing-stats">
              <div class="pairing-stat-item">
                <div class="pairing-stat-value success">{{ pairingStats.successCount || 0 }}</div>
                <div class="pairing-stat-label">成功</div>
              </div>
              <div class="pairing-stat-item">
                <div class="pairing-stat-value danger">{{ pairingStats.failedCount || 0 }}</div>
                <div class="pairing-stat-label">失败</div>
              </div>
              <div class="pairing-stat-item">
                <div class="pairing-stat-value info">{{ pairingStats.totalCount || 0 }}</div>
                <div class="pairing-stat-label">总计</div>
              </div>
            </div>
            <div v-if="pairingStats.recentFailures && pairingStats.recentFailures.length > 0" style="margin-top: 16px;">
              <h4 style="font-size: 13px; font-weight: 600; color: var(--color-gray-600); margin-bottom: 8px;">最近失败记录</h4>
              <div class="recent-failures">
                <div v-for="failure in pairingStats.recentFailures.slice(0, 3)" :key="failure.id" class="failure-item">
                  <span class="failure-time">{{ formatTime(failure.eventTime) }}</span>
                  <span class="failure-error">{{ failure.errorMessage || '连接失败' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">时间线</h3>
          <div style="display: flex; gap: 8px;">
            <select class="form-control form-select" style="width: auto;" v-model="timelineFilter">
              <option value="">全部类型</option>
              <option value="scan">扫描记录</option>
              <option value="pairing">配对事件</option>
              <option value="anomaly">异常事件</option>
              <option value="handling">处理记录</option>
            </select>
            <button class="btn btn-sm btn-secondary" @click="loadTimeline">
              <span v-html="IconRefresh"></span> 刷新
            </button>
          </div>
        </div>
        <div class="card-body">
          <div v-if="loadingTimeline" class="loading">
            <div class="spinner"></div>
          </div>
          <div v-else-if="timeline.length > 0" class="timeline">
            <div v-for="item in timeline" :key="item.id" class="timeline-item">
              <div class="timeline-dot" :class="getTimelineDotClass(item.type)"></div>
              <div class="timeline-content">
                <div class="timeline-time">{{ formatTime(item.time) }}</div>
                <div class="timeline-title">{{ item.title }}</div>
                <div class="timeline-description">{{ item.description }}</div>
                <div v-if="item.details" class="timeline-details" style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--color-gray-200);">
                  <pre style="font-size: 12px; white-space: pre-wrap; color: var(--color-gray-600); margin: 0;">
                    {{ JSON.stringify(item.details, null, 2) }}
                  </pre>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="empty-state" style="padding: 24px;">
            <p class="empty-state-title">暂无时间线数据</p>
            <p class="empty-state-desc">该设备暂无事件记录</p>
          </div>
        </div>
      </div>

      <div v-if="anomalies.length > 0" class="card" style="margin-top: 24px;">
        <div class="card-header">
          <h3 class="card-title">相关异常</h3>
        </div>
        <div class="card-body" style="padding: 0;">
          <table class="table">
            <thead>
              <tr>
                <th>异常类型</th>
                <th>严重程度</th>
                <th>状态</th>
                <th>风险分数</th>
                <th>发现时间</th>
                <th style="width: 120px;">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="anomaly in anomalies" :key="anomaly.id">
                <td>
                  <span class="badge" :class="getAnomalyBadgeClass(anomaly.anomalyType)">
                    {{ getAnomalyTypeLabel(anomaly.anomalyType) }}
                  </span>
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
                  <span :style="{ color: getRiskScoreColor(anomaly.riskScore) }" style="font-weight: 600;">
                    {{ anomaly.riskScore }}
                  </span>
                </td>
                <td>{{ formatTime(anomaly.discoveredAt) }}</td>
                <td>
                  <button class="btn btn-sm btn-primary" @click="handleAnomaly(anomaly)">处理</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <div v-else class="empty-state">
      <p class="empty-state-title">设备不存在</p>
      <router-link to="/devices" class="btn btn-primary">返回设备列表</router-link>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi, formatRelativeTime, formatDateTime, getStatusLabel, getDeviceTypeLabel, getAnomalyTypeLabel, getSeverityLabel } from '@/utils/api'
import { 
  RefreshIcon,
  ChevronLeftIcon,
  BatteryIcon,
  SignalIcon
} from '@/components/icons'

export default {
  name: 'DeviceDetail',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const api = useApi()

    const loading = ref(false)
    const loadingTimeline = ref(false)
    const device = ref(null)
    const scanStats = ref([])
    const pairingStats = ref({})
    const timeline = ref([])
    const anomalies = ref([])
    const timelineFilter = ref('')

    const IconRefresh = RefreshIcon()
    const IconChevronLeft = ChevronLeftIcon()

    const loadDevice = async () => {
      loading.value = true
      try {
        const [deviceResult, scanResult, timelineResult, anomaliesResult] = await Promise.all([
          api.devices.get(route.params.id).catch(() => null),
          api.devices.scanStats(route.params.id, { limit: 10 }).catch(() => ({ items: [] })),
          api.devices.timeline(route.params.id, { limit: 50 }).catch(() => ({ items: [] })),
          api.anomalies.list({ deviceId: route.params.id, limit: 20 }).catch(() => ({ items: [] }))
        ])

        device.value = deviceResult
        scanStats.value = scanResult.items || []
        timeline.value = timelineResult.items || []
        anomalies.value = anomaliesResult.items || []

        if (timeline.value.length > 0) {
          const pairingEvents = timeline.value.filter(t => t.type === 'pairing')
          pairingStats.value = {
            successCount: pairingEvents.filter(p => p.success).length,
            failedCount: pairingEvents.filter(p => !p.success).length,
            totalCount: pairingEvents.length,
            recentFailures: pairingEvents.filter(p => !p.success).slice(0, 5)
          }
        }
      } catch (error) {
        console.error('Failed to load device:', error)
        showNotification('error', '加载失败', error.message)
      } finally {
        loading.value = false
      }
    }

    const loadTimeline = async () => {
      loadingTimeline.value = true
      try {
        const params = { limit: 50 }
        if (timelineFilter.value) {
          params.type = timelineFilter.value
        }
        const result = await api.devices.timeline(route.params.id, params)
        timeline.value = result.items || []
      } catch (error) {
        console.error('Failed to load timeline:', error)
      } finally {
        loadingTimeline.value = false
      }
    }

    const reanalyze = async () => {
      try {
        await api.import.analyze({ deviceIds: [route.params.id] })
        showNotification('success', '分析完成', '设备风险分析已重新执行')
        loadDevice()
      } catch (error) {
        showNotification('error', '分析失败', error.message)
      }
    }

    const handleAnomaly = (anomaly) => {
      router.push({ path: '/anomalies', query: { id: anomaly.id } })
    }

    const formatTime = (date) => formatRelativeTime(date)

    const getStatusBadgeClass = (status) => {
      const classes = {
        'active': 'badge-success',
        'inactive': 'badge-secondary',
        'maintenance': 'badge-warning',
        'missing': 'badge-danger',
        'open': 'badge-danger',
        'acknowledged': 'badge-warning',
        'investigating': 'badge-primary',
        'resolved': 'badge-success',
        'false_positive': 'badge-secondary'
      }
      return classes[status] || 'badge-secondary'
    }

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

    const getBatteryColor = (level) => {
      if (level === null || level === undefined) return '#6b7280'
      if (level < 10) return '#dc2626'
      if (level < 20) return '#f59e0b'
      if (level < 50) return '#3b82f6'
      return '#10b981'
    }

    const getBatteryBgColor = (level) => {
      const color = getBatteryColor(level)
      return `rgba(${parseInt(color.slice(1,3),16)}, ${parseInt(color.slice(3,5),16)}, ${parseInt(color.slice(5,7),16)}, 0.1)`
    }

    const getRSSIColor = (rssi) => {
      if (rssi === null || rssi === undefined) return '#6b7280'
      if (rssi >= -60) return '#10b981'
      if (rssi >= -70) return '#3b82f6'
      if (rssi >= -80) return '#f59e0b'
      if (rssi >= -90) return '#ea580c'
      return '#dc2626'
    }

    const getRSSIBgColor = (rssi) => {
      const color = getRSSIColor(rssi)
      return `rgba(${parseInt(color.slice(1,3),16)}, ${parseInt(color.slice(3,5),16)}, ${parseInt(color.slice(5,7),16)}, 0.1)`
    }

    const getRiskTagLabel = (tag) => {
      const labels = {
        'rssi_fluctuation': 'RSSI信号波动',
        'long_disconnect': '长时间失联',
        'duplicate_device': '重复设备',
        'random_address_drift': '随机地址漂移',
        'low_battery': '低电量',
        'pairing_failures': '配对失败',
        'zone_violation': '区域越界'
      }
      return labels[tag] || tag
    }

    const getRiskTagDescription = (tag) => {
      const descriptions = {
        'rssi_fluctuation': '信号强度波动超过阈值，可能存在干扰或遮挡',
        'long_disconnect': '超过失联时间阈值未被扫描到',
        'duplicate_device': '存在相同名称或序列号的其他设备',
        'random_address_drift': '检测到MAC地址频繁变化，可能是随机地址',
        'low_battery': '电池电量低于告警阈值',
        'pairing_failures': '配对失败次数超过阈值',
        'zone_violation': '设备类型不允许出现在当前区域'
      }
      return descriptions[tag] || ''
    }

    const getBarWidth = (rssi) => {
      if (!rssi) return 0
      const normalized = Math.max(0, 100 + rssi)
      return Math.min(100, normalized)
    }

    const getTimelineDotClass = (type) => {
      const classes = {
        'scan': 'primary',
        'pairing': 'success',
        'anomaly': 'danger',
        'handling': 'warning'
      }
      return classes[type] || 'primary'
    }

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

    const getRiskScoreColor = (score) => {
      if (score >= 80) return '#dc2626'
      if (score >= 60) return '#ea580c'
      if (score >= 40) return '#f59e0b'
      if (score >= 20) return '#3b82f6'
      return '#10b981'
    }

    const IconBattery = (level) => BatteryIcon(level)
    const IconSignal = (rssi) => SignalIcon(rssi)

    const showNotification = (type, title, message) => {
      const event = new CustomEvent('notification', {
        detail: { type, title, message }
      })
      window.dispatchEvent(event)
    }

    onMounted(() => {
      loadDevice()
    })

    return {
      loading,
      loadingTimeline,
      device,
      scanStats,
      pairingStats,
      timeline,
      anomalies,
      timelineFilter,
      IconRefresh,
      IconChevronLeft,
      IconBattery,
      IconSignal,
      loadDevice,
      loadTimeline,
      reanalyze,
      handleAnomaly,
      formatTime,
      formatDateTime,
      getStatusLabel,
      getDeviceTypeLabel,
      getAnomalyTypeLabel,
      getSeverityLabel,
      getStatusBadgeClass,
      getDeviceTypeBadgeStyle,
      getBatteryColor,
      getBatteryBgColor,
      getRSSIColor,
      getRSSIBgColor,
      getRiskTagLabel,
      getRiskTagDescription,
      getBarWidth,
      getTimelineDotClass,
      getAnomalyBadgeClass,
      getSeverityBadgeClass,
      getRiskScoreColor
    }
  }
}
</script>

<style scoped>
.info-table {
  width: 100%;
}

.info-table tr {
  border-bottom: 1px solid var(--color-gray-100);
}

.info-table tr:last-child {
  border-bottom: none;
}

.info-table td {
  padding: 12px 0;
}

.info-table .label {
  width: 100px;
  font-size: 13px;
  color: var(--color-gray-500);
  vertical-align: top;
}

.info-table .value {
  font-size: 14px;
  color: var(--color-gray-900);
  font-weight: 500;
}

.info-table code {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
  background: var(--color-gray-100);
  padding: 2px 8px;
  border-radius: 4px;
}

.zone-link {
  color: var(--color-primary);
  text-decoration: none;
}

.zone-link:hover {
  text-decoration: underline;
}

.risk-tags-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.risk-tag-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--color-gray-50);
  border-radius: var(--radius-md);
}

.risk-tag-desc {
  font-size: 13px;
  color: var(--color-gray-600);
}

.signal-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  padding: 8px 0;
}

.signal-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.signal-bar-label {
  width: 60px;
  font-size: 12px;
  color: var(--color-gray-500);
}

.signal-bar-track {
  flex: 1;
  height: 20px;
  background: var(--color-gray-100);
  border-radius: 10px;
  position: relative;
  overflow: hidden;
}

.signal-bar-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: 10px;
  transition: width 0.3s ease;
}

.signal-bar-value {
  width: 80px;
  font-size: 12px;
  font-weight: 600;
  text-align: right;
}

.pairing-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
}

.pairing-stat-item {
  text-align: center;
}

.pairing-stat-value {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 4px;
}

.pairing-stat-value.success {
  color: var(--color-success);
}

.pairing-stat-value.danger {
  color: var(--color-danger);
}

.pairing-stat-value.info {
  color: var(--color-primary);
}

.pairing-stat-label {
  font-size: 13px;
  color: var(--color-gray-500);
}

.recent-failures {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.failure-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(220, 38, 38, 0.05);
  border-radius: var(--radius-md);
  font-size: 13px;
}

.failure-time {
  color: var(--color-gray-500);
}

.failure-error {
  color: var(--color-danger);
  font-weight: 500;
}
</style>
