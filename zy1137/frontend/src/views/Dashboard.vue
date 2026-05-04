<template>
  <div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card-header">
          <div>
            <div class="stat-card-title">设备总数</div>
            <div class="stat-card-value">{{ stats.totalDevices || 0 }}</div>
          </div>
          <div class="stat-card-icon" style="background: rgba(59, 130, 246, 0.1);">
            <span v-html="IconDevicesHTML"></span>
          </div>
        </div>
        <div class="stat-card-change neutral">
          <span>活跃: {{ stats.activeDevices || 0 }} 台</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <div>
            <div class="stat-card-title">待处理异常</div>
            <div class="stat-card-value">{{ stats.openAnomalies || 0 }}</div>
          </div>
          <div class="stat-card-icon" style="background: rgba(220, 38, 38, 0.1);">
            <span v-html="IconAnomaliesHTML"></span>
          </div>
        </div>
        <div class="stat-card-change negative" v-if="stats.criticalAnomalies > 0">
          <span>严重: {{ stats.criticalAnomalies }} 个</span>
        </div>
        <div class="stat-card-change neutral" v-else>
          <span>暂无严重异常</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <div>
            <div class="stat-card-title">低电量设备</div>
            <div class="stat-card-value">{{ stats.lowBattery || 0 }}</div>
          </div>
          <div class="stat-card-icon" style="background: rgba(245, 158, 11, 0.1);">
            <span v-html="IconBatteryHTML"></span>
          </div>
        </div>
        <div class="stat-card-change" :class="stats.lowBattery > 0 ? 'warning' : 'positive'">
          <span>{{ stats.lowBattery > 0 ? '需要更换电池' : '电量充足' }}</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-card-header">
          <div>
            <div class="stat-card-title">区域数量</div>
            <div class="stat-card-value">{{ stats.totalZones || 0 }}</div>
          </div>
          <div class="stat-card-icon" style="background: rgba(16, 185, 129, 0.1);">
            <span v-html="IconZonesHTML"></span>
          </div>
        </div>
        <div class="stat-card-change neutral">
          <span>覆盖范围正常</span>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 24px;">
      <div class="card-header">
        <h3 class="card-title">设备类型分布</h3>
        <button class="btn btn-sm btn-secondary" @click="loadStats">
          <span v-html="IconRefreshHTML"></span> 刷新
        </button>
      </div>
      <div class="card-body">
        <div class="chart-container" v-if="deviceTypeStats.length > 0">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 16px;">
            <div v-for="item in deviceTypeStats" :key="item.type" 
                 class="stat-card" 
                 style="padding: 16px; cursor: pointer;"
                 @click="filterByType(item.type)">
              <div class="stat-card-title" style="margin-bottom: 8px;">{{ item.label }}</div>
              <div class="stat-card-value" style="font-size: 24px;">{{ item.count }}</div>
            </div>
          </div>
        </div>
        <div class="empty-state" v-else>
          <p class="empty-state-title">暂无设备数据</p>
          <p class="empty-state-desc">请先导入设备数据</p>
          <router-link to="/import" class="btn btn-primary">前往导入</router-link>
        </div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px;">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">最新异常</h3>
          <router-link to="/anomalies" class="btn btn-sm btn-secondary">查看全部</router-link>
        </div>
        <div class="card-body">
          <div v-if="loading" class="loading">
            <div class="spinner"></div>
          </div>
          <div v-else-if="recentAnomalies.length > 0" class="timeline">
            <div v-for="anomaly in recentAnomalies" :key="anomaly.id" class="timeline-item">
              <div class="timeline-dot" :class="getSeverityClass(anomaly.severity)"></div>
              <div class="timeline-content">
                <div class="timeline-time">{{ formatTime(anomaly.createdAt) }}</div>
                <div class="timeline-title">{{ getAnomalyTypeLabel(anomaly.anomalyType) }}</div>
                <div class="timeline-description">
                  {{ anomaly.affectedDeviceName || '未知设备' }}
                  <span class="badge" :class="getStatusBadgeClass(anomaly.status)">
                    {{ getStatusLabel(anomaly.status) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="empty-state" style="padding: 24px;">
            <p class="empty-state-title">暂无异常</p>
            <p class="empty-state-desc">所有设备运行正常</p>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">扫描记录趋势</h3>
        </div>
        <div class="card-body">
          <div v-if="loading" class="loading">
            <div class="spinner"></div>
          </div>
          <div v-else class="chart-container" style="height: 250px;">
            <div v-if="scanStats.length > 0" style="display: flex; flex-direction: column; gap: 8px; height: 100%;">
              <div v-for="(stat, index) in scanStats" :key="index" style="display: flex; align-items: center; gap: 12px;">
                <span style="width: 80px; font-size: 12px; color: var(--color-gray-600);">{{ stat.label }}</span>
                <div style="flex: 1; background: var(--color-gray-100); border-radius: 4px; height: 24px; position: relative; overflow: hidden;">
                  <div 
                    style="position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; transition: width 0.3s ease;"
                    :style="{ width: stat.percent + '%', background: getRSSIColor(stat.avgRSSI) }"
                  ></div>
                  <span style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); font-size: 12px; color: var(--color-gray-600);">
                    {{ stat.avgRSSI }} dBm ({{ stat.count }} 次)
                  </span>
                </div>
              </div>
            </div>
            <div v-else class="empty-state" style="padding: 24px;">
              <p class="empty-state-title">暂无扫描数据</p>
              <p class="empty-state-desc">请先导入扫描记录</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top: 24px;">
      <div class="card-header">
        <h3 class="card-title">快速操作</h3>
      </div>
      <div class="card-body">
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <router-link to="/import" class="btn btn-primary">
            <span v-html="IconUploadHTML"></span> 导入数据
          </router-link>
          <button class="btn btn-secondary" @click="runAnalysis">
            <span v-html="IconRefreshHTML"></span> 重新分析
          </button>
          <router-link to="/reports" class="btn btn-success">
            <span v-html="IconDownloadHTML"></span> 生成报告
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useApi, formatRelativeTime, getAnomalyTypeLabel, getStatusLabel } from '@/utils/api'
import { 
  DevicesIcon,
  ZonesIcon,
  AnomaliesIcon,
  RefreshIcon,
  UploadIcon,
  DownloadIcon,
  BatteryIcon
} from '@/components/icons'

export default {
  name: 'Dashboard',
  setup() {
    const router = useRouter()
    const api = useApi()
    
    const loading = ref(false)
    const stats = ref({})
    const recentAnomalies = ref([])
    const scanStats = ref([])
    const deviceTypeStats = ref([])

    const IconDevicesHTML = DevicesIcon()
    const IconZonesHTML = ZonesIcon()
    const IconAnomaliesHTML = AnomaliesIcon()
    const IconRefreshHTML = RefreshIcon()
    const IconUploadHTML = UploadIcon()
    const IconDownloadHTML = DownloadIcon()

    const loadStats = async () => {
      loading.value = true
      try {
        const [statsResult, anomaliesResult] = await Promise.all([
          api.stats().catch(() => ({})),
          api.anomalies.list({ limit: 5, status: 'open' }).catch(() => ({ items: [] }))
        ])
        
        stats.value = statsResult || {}
        recentAnomalies.value = anomaliesResult.items || []
        
        if (statsResult.deviceTypes) {
          deviceTypeStats.value = Object.entries(statsResult.deviceTypes).map(([type, count]) => ({
            type,
            count,
            label: getDeviceTypeLabel(type)
          }))
        }
        
        if (statsResult.recentScans) {
          scanStats.value = statsResult.recentScans
        }
      } catch (error) {
        console.error('Failed to load stats:', error)
      } finally {
        loading.value = false
      }
    }

    const runAnalysis = async () => {
      loading.value = true
      try {
        await api.import.analyze({ reanalyzeExisting: true })
        await loadStats()
        showNotification('success', '分析完成', '风险分析已重新执行')
      } catch (error) {
        showNotification('error', '分析失败', error.message)
      } finally {
        loading.value = false
      }
    }

    const filterByType = (type) => {
      router.push({ path: '/devices', query: { type } })
    }

    const formatTime = (date) => formatRelativeTime(date)
    const getDeviceTypeLabel = (type) => {
      const labels = {
        'esl': '电子价签',
        'printer': '小票打印机',
        'beacon': 'Beacon信标',
        'scanner': '扫码枪',
        'headset': '员工耳机',
        'other': '其他设备'
      }
      return labels[type] || type
    }

    const getSeverityClass = (severity) => {
      const classes = {
        'critical': 'danger',
        'high': 'warning',
        'medium': 'primary',
        'low': 'success',
        'info': 'success'
      }
      return classes[severity] || 'primary'
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

    const getRSSIColor = (rssi) => {
      if (!rssi) return '#6b7280'
      if (rssi >= -60) return '#10b981'
      if (rssi >= -70) return '#3b82f6'
      if (rssi >= -80) return '#f59e0b'
      if (rssi >= -90) return '#ea580c'
      return '#dc2626'
    }

    const IconBatteryHTML = computed(() => BatteryIcon(80))

    const showNotification = (type, title, message) => {
      const event = new CustomEvent('notification', {
        detail: { type, title, message }
      })
      window.dispatchEvent(event)
    }

    onMounted(() => {
      loadStats()
    })

    return {
      loading,
      stats,
      recentAnomalies,
      scanStats,
      deviceTypeStats,
      IconDevicesHTML,
      IconZonesHTML,
      IconAnomaliesHTML,
      IconRefreshHTML,
      IconUploadHTML,
      IconDownloadHTML,
      IconBatteryHTML,
      loadStats,
      runAnalysis,
      filterByType,
      formatTime,
      getDeviceTypeLabel,
      getSeverityClass,
      getStatusBadgeClass,
      getAnomalyTypeLabel,
      getStatusLabel,
      getRSSIColor
    }
  }
}
</script>

<style scoped>
.badge-warning {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}
</style>
