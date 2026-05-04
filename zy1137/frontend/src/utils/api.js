import axios from 'axios'
import dayjs from 'dayjs'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    const message = error.response?.data?.error?.message || error.message || '网络请求失败'
    const formattedError = new Error(message)
    formattedError.response = error.response
    return Promise.reject(formattedError)
  }
)

export const useApi = () => {
  return {
    get: api.get,
    post: api.post,
    put: api.put,
    delete: api.delete,
    patch: api.patch,

    devices: {
      list: (params) => api.get('/devices', { params }),
      get: (id) => api.get(`/devices/${id}`),
      update: (id, data) => api.put(`/devices/${id}`, data),
      stats: () => api.get('/devices/stats'),
      timeline: (id, params) => api.get(`/devices/${id}/timeline`, { params }),
      scanStats: (id, params) => api.get(`/devices/${id}/scan-stats`, { params })
    },

    zones: {
      list: (params) => api.get('/zones', { params }),
      get: (id) => api.get(`/zones/${id}`),
      create: (data) => api.post('/zones', data),
      update: (id, data) => api.put(`/zones/${id}`, data),
      delete: (id) => api.delete(`/zones/${id}`),
      stats: () => api.get('/zones/stats'),
      heatmap: (id, params) => api.get(`/zones/${id}/heatmap`, { params }),
      devices: (id, params) => api.get(`/zones/${id}/devices`, { params })
    },

    anomalies: {
      list: (params) => api.get('/anomalies', { params }),
      get: (id) => api.get(`/anomalies/${id}`),
      update: (id, data) => api.put(`/anomalies/${id}`, data),
      handle: (id, data) => api.post(`/anomalies/${id}/handle`, data),
      stats: () => api.get('/anomalies/stats')
    },

    import: {
      devices: (file, options) => {
        const formData = new FormData()
        formData.append('file', file)
        if (options?.updateExisting !== undefined) {
          formData.append('updateExisting', options.updateExisting.toString())
        }
        return api.post('/import/devices', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      },
      bleScans: (file, options) => {
        const formData = new FormData()
        formData.append('file', file)
        if (options?.linkToDevice !== undefined) {
          formData.append('linkToDevice', options.linkToDevice.toString())
        }
        return api.post('/import/ble-scans', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      },
      pairingEvents: (file, options) => {
        const formData = new FormData()
        formData.append('file', file)
        if (options?.linkToDevice !== undefined) {
          formData.append('linkToDevice', options.linkToDevice.toString())
        }
        return api.post('/import/pairing-events', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      },
      zones: (file, options) => {
        const formData = new FormData()
        formData.append('file', file)
        if (options?.updateExisting !== undefined) {
          formData.append('updateExisting', options.updateExisting.toString())
        }
        return api.post('/import/zones', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      },
      batch: (files) => {
        const formData = new FormData()
        if (files.devices) formData.append('devices', files.devices)
        if (files.bleScans) formData.append('bleScans', files.bleScans)
        if (files.pairingEvents) formData.append('pairingEvents', files.pairingEvents)
        if (files.zones) formData.append('zones', files.zones)
        return api.post('/import/batch', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
      },
      analyze: (options) => api.post('/import/analyze', options)
    },

    reports: {
      get: (params) => api.get('/reports', { params }),
      preview: (params) => api.get('/reports/preview', { params }),
      email: (data) => api.post('/reports/email', data)
    },

    scanRecords: {
      list: (params) => api.get('/devices/scans', { params }),
      get: (id) => api.get(`/devices/scans/${id}`)
    },

    health: () => api.get('/health'),
    stats: () => api.get('/stats')
  }
}

export const formatDateTime = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  if (!date) return '-'
  return dayjs(date).format(format)
}

export const formatRelativeTime = (date) => {
  if (!date) return '-'
  const now = dayjs()
  const target = dayjs(date)
  const diffSeconds = now.diff(target, 'second')
  
  if (diffSeconds < 60) return '刚刚'
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}分钟前`
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}小时前`
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}天前`
  
  return formatDateTime(date, 'YYYY-MM-DD')
}

export const getDeviceTypeLabel = (type) => {
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

export const getDeviceTypeColor = (type) => {
  const colors = {
    'esl': '#3b82f6',
    'printer': '#10b981',
    'beacon': '#8b5cf6',
    'scanner': '#f59e0b',
    'headset': '#ec4899',
    'other': '#6b7280'
  }
  return colors[type] || '#6b7280'
}

export const getSeverityColor = (severity) => {
  const colors = {
    'critical': '#dc2626',
    'high': '#ea580c',
    'medium': '#ca8a04',
    'low': '#2563eb',
    'info': '#16a34a'
  }
  return colors[severity] || '#6b7280'
}

export const getSeverityLabel = (severity) => {
  const labels = {
    'critical': '严重',
    'high': '高危',
    'medium': '中等',
    'low': '低',
    'info': '信息'
  }
  return labels[severity] || severity
}

export const getAnomalyTypeLabel = (type) => {
  const labels = {
    'rssi_fluctuation': 'RSSI信号波动',
    'long_disconnect': '长时间失联',
    'duplicate_device': '重复设备',
    'random_address_drift': '随机地址漂移',
    'low_battery': '低电量',
    'pairing_failures': '配对失败',
    'zone_violation': '区域越界',
    'scan_failure': '扫描失败',
    'connection_drop': '连接断开',
    'unknown': '未知异常'
  }
  return labels[type] || type
}

export const getStatusLabel = (status) => {
  const labels = {
    'open': '待处理',
    'acknowledged': '已确认',
    'investigating': '调查中',
    'resolved': '已解决',
    'false_positive': '误报',
    'active': '活跃',
    'inactive': '停用',
    'maintenance': '维护中',
    'missing': '丢失'
  }
  return labels[status] || status
}

export const getBatteryStatus = (level) => {
  if (level === null || level === undefined) return { status: 'unknown', color: '#6b7280' }
  if (level < 10) return { status: 'critical', color: '#dc2626' }
  if (level < 20) return { status: 'warning', color: '#f59e0b' }
  if (level < 50) return { status: 'low', color: '#3b82f6' }
  return { status: 'good', color: '#10b981' }
}

export const getRSSIStatus = (rssi) => {
  if (rssi === null || rssi === undefined) return { status: 'unknown', color: '#6b7280' }
  if (rssi >= -60) return { status: 'excellent', color: '#10b981', label: '极佳' }
  if (rssi >= -70) return { status: 'good', color: '#3b82f6', label: '良好' }
  if (rssi >= -80) return { status: 'fair', color: '#f59e0b', label: '一般' }
  if (rssi >= -90) return { status: 'poor', color: '#ea580c', label: '较差' }
  return { status: 'critical', color: '#dc2626', label: '极差' }
}

export { api }
export default api
