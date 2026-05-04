import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api'

export const useSystemStore = defineStore('system', () => {
  const departments = ref([])
  const beds = ref([])
  const ambulances = ref([])
  const logs = ref([])
  const ruleResults = ref(null)
  const systemInfo = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const stats = computed(() => ({
    departments: departments.value.length,
    totalBeds: beds.value.length,
    availableBeds: beds.value.filter(b => b.status === 'available').length,
    occupiedBeds: beds.value.filter(b => b.status === 'occupied').length,
    logs: logs.value.length
  }))

  const bedUsageRate = computed(() => {
    if (stats.value.totalBeds === 0) return 0
    return Math.round((stats.value.occupiedBeds / stats.value.totalBeds) * 100)
  })

  const departmentsWithCapacity = computed(() => {
    return departments.value.map(dept => {
      const deptBeds = beds.value.filter(b => b.departmentId === dept.id)
      const available = deptBeds.filter(b => b.status === 'available').length
      const total = deptBeds.length
      return {
        ...dept,
        bedsCount: total,
        availableBeds: available,
        capacityRatio: total > 0 ? available / total : 0
      }
    })
  })

  async function fetchDepartments() {
    loading.value = true
    error.value = null
    try {
      const response = await api.departments.getAll()
      departments.value = response.data
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || '获取科室列表失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchBeds(params = {}) {
    loading.value = true
    error.value = null
    try {
      const response = await api.beds.getAll(params)
      beds.value = response.data
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || '获取床位列表失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchAmbulances() {
    loading.value = true
    error.value = null
    try {
      const response = await api.ambulances.getAll()
      ambulances.value = response.data
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || '获取救护车列表失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchLogs(params = {}) {
    loading.value = true
    error.value = null
    try {
      const response = await api.logs.getAll(params)
      logs.value = response.data
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || '获取日志列表失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchSystemInfo() {
    loading.value = true
    error.value = null
    try {
      const response = await api.getSystemInfo()
      systemInfo.value = response.data
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || '获取系统信息失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function runRulesCheck() {
    loading.value = true
    error.value = null
    try {
      const response = await api.rules.check()
      ruleResults.value = response.data
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || '规则检查失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function createSampleData() {
    loading.value = true
    error.value = null
    try {
      const response = await api.sampleData.create()
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || '创建示例数据失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function clearAllData() {
    loading.value = true
    error.value = null
    try {
      const response = await api.sampleData.clear()
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || '清除数据失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  function updateRuleResults(results) {
    ruleResults.value = results
  }

  function addLogEntry(log) {
    logs.value.unshift(log)
    if (logs.value.length > 500) {
      logs.value = logs.value.slice(0, 500)
    }
  }

  function getSeverityColor(severity) {
    const colors = {
      debug: '#6b7280',
      info: '#3b82f6',
      warning: '#eab308',
      error: '#ef4444',
      critical: '#dc2626'
    }
    return colors[severity] || '#6b7280'
  }

  function getSeverityLabel(severity) {
    const labels = {
      debug: '调试',
      info: '信息',
      warning: '警告',
      error: '错误',
      critical: '严重'
    }
    return labels[severity] || severity
  }

  function getBedStatusColor(status) {
    const colors = {
      available: '#22c55e',
      occupied: '#ef4444',
      maintenance: '#eab308'
    }
    return colors[status] || '#6b7280'
  }

  function getBedStatusLabel(status) {
    const labels = {
      available: '可用',
      occupied: '已占用',
      maintenance: '维护中'
    }
    return labels[status] || status
  }

  return {
    departments,
    beds,
    ambulances,
    logs,
    ruleResults,
    systemInfo,
    loading,
    error,
    stats,
    bedUsageRate,
    departmentsWithCapacity,
    fetchDepartments,
    fetchBeds,
    fetchAmbulances,
    fetchLogs,
    fetchSystemInfo,
    runRulesCheck,
    createSampleData,
    clearAllData,
    updateRuleResults,
    addLogEntry,
    getSeverityColor,
    getSeverityLabel,
    getBedStatusColor,
    getBedStatusLabel
  }
})
