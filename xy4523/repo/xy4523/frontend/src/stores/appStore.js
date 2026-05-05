import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'
import {
  greenhouseApi,
  seedbedApi,
  assessmentApi,
  plantBatchApi
} from '@/utils/api'

export const useAppStore = defineStore('app', () => {
  const currentDate = ref(dayjs().format('YYYY-MM-DD'))
  const greenhouses = ref([])
  const seedbeds = ref([])
  const currentGreenhouse = ref(null)
  const currentSeedbed = ref(null)
  const assessments = ref([])
  const assessmentSummary = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const notifications = ref([])

  const riskTypeLabels = {
    suitable: '适合授粉',
    temperature_risk: '温度风险',
    humidity_risk: '湿度风险',
    cross_pollination: '串粉风险',
    before_flowering: '未到花期',
    missed_flowering: '花期已过',
    isolation_open: '隔离开放',
    no_operator: '无操作员',
    multiple_risks: '多重风险'
  }

  const suitableCount = computed(() => 
    assessments.value.filter(a => a.is_suitable_pollination).length
  )

  const atRiskCount = computed(() => 
    assessments.value.filter(a => !a.is_suitable_pollination).length
  )

  const groupedByGreenhouse = computed(() => {
    const groups = {}
    assessments.value.forEach(a => {
      if (!groups[a.greenhouse_name]) {
        groups[a.greenhouse_name] = { seedbeds: {}, total: 0, suitable: 0 }
      }
      if (!groups[a.greenhouse_name].seedbeds[a.seedbed_code]) {
        groups[a.greenhouse_name].seedbeds[a.seedbed_code] = { items: [], total: 0, suitable: 0 }
      }
      groups[a.greenhouse_name].seedbeds[a.seedbed_code].items.push(a)
      groups[a.greenhouse_name].seedbeds[a.seedbed_code].total++
      groups[a.greenhouse_name].total++
      
      if (a.is_suitable_pollination) {
        groups[a.greenhouse_name].seedbeds[a.seedbed_code].suitable++
        groups[a.greenhouse_name].suitable++
      }
    })
    return groups
  })

  const groupedByRiskType = computed(() => {
    const groups = {}
    assessments.value.forEach(a => {
      if (!groups[a.risk_type]) {
        groups[a.risk_type] = { label: riskTypeLabels[a.risk_type] || a.risk_type, items: [], count: 0 }
      }
      groups[a.risk_type].items.push(a)
      groups[a.risk_type].count++
    })
    return groups
  })

  const addNotification = (message, type = 'info') => {
    const id = Date.now()
    notifications.value.push({ id, message, type })
    setTimeout(() => {
      removeNotification(id)
    }, 5000)
  }

  const removeNotification = (id) => {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  const setCurrentDate = (date) => {
    currentDate.value = date
  }

  const fetchGreenhouses = async () => {
    try {
      const response = await greenhouseApi.getAll()
      greenhouses.value = response.data
      return greenhouses.value
    } catch (e) {
      error.value = e.message
      addNotification('获取温室列表失败', 'error')
      throw e
    }
  }

  const fetchSeedbeds = async (greenhouseId = null) => {
    try {
      const response = await seedbedApi.getAll(greenhouseId)
      seedbeds.value = response.data
      return seedbeds.value
    } catch (e) {
      error.value = e.message
      addNotification('获取苗床列表失败', 'error')
      throw e
    }
  }

  const runAssessment = async (date = currentDate.value) => {
    loading.value = true
    error.value = null
    try {
      const response = await assessmentApi.run(date)
      addNotification(`评估完成: 共${response.data.total_assessed}个批次, ${response.data.suitable}个适合授粉`, 'success')
      await fetchAssessments(date)
      return response.data
    } catch (e) {
      error.value = e.message
      addNotification('运行评估失败: ' + e.message, 'error')
      throw e
    } finally {
      loading.value = false
    }
  }

  const fetchAssessments = async (date = currentDate.value, params = {}) => {
    loading.value = true
    error.value = null
    try {
      const response = await assessmentApi.get({
        date,
        ...params
      })
      assessments.value = response.data.assessments
      assessmentSummary.value = response.data.summary
      return response.data
    } catch (e) {
      error.value = e.message
      addNotification('获取评估结果失败', 'error')
      throw e
    } finally {
      loading.value = false
    }
  }

  const updateAssessment = async (plantBatchId, data) => {
    try {
      const response = await assessmentApi.update(plantBatchId, {
        date: currentDate.value,
        ...data
      })
      addNotification('更新成功', 'success')
      await fetchAssessments()
      return response.data
    } catch (e) {
      error.value = e.message
      addNotification('更新失败: ' + e.message, 'error')
      throw e
    }
  }

  const fetchPlantBatches = async (params = {}) => {
    try {
      const response = await plantBatchApi.getAll(params)
      return response.data
    } catch (e) {
      error.value = e.message
      addNotification('获取植物批次失败', 'error')
      throw e
    }
  }

  const createGreenhouse = async (data) => {
    try {
      const response = await greenhouseApi.create(data)
      addNotification(response.data.message, 'success')
      await fetchGreenhouses()
      return response.data
    } catch (e) {
      error.value = e.message
      addNotification('创建温室失败: ' + (e.response?.data?.error || e.message), 'error')
      throw e
    }
  }

  const createSeedbed = async (data) => {
    try {
      const response = await seedbedApi.create(data)
      addNotification(response.data.message, 'success')
      await fetchSeedbeds()
      return response.data
    } catch (e) {
      error.value = e.message
      addNotification('创建苗床失败: ' + (e.response?.data?.error || e.message), 'error')
      throw e
    }
  }

  const initializeData = async () => {
    loading.value = true
    try {
      await fetchGreenhouses()
      await fetchSeedbeds()
    } catch (e) {
      console.error('初始化数据失败:', e)
    } finally {
      loading.value = false
    }
  }

  return {
    currentDate,
    greenhouses,
    seedbeds,
    currentGreenhouse,
    currentSeedbed,
    assessments,
    assessmentSummary,
    loading,
    error,
    notifications,
    riskTypeLabels,
    suitableCount,
    atRiskCount,
    groupedByGreenhouse,
    groupedByRiskType,
    setCurrentDate,
    fetchGreenhouses,
    fetchSeedbeds,
    runAssessment,
    fetchAssessments,
    updateAssessment,
    fetchPlantBatches,
    createGreenhouse,
    createSeedbed,
    initializeData,
    addNotification,
    removeNotification
  }
})
