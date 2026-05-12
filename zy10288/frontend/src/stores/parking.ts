import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as api from '../api'

export const useParkingStore = defineStore('parking', () => {
  const statistics = ref<any>({})
  const cards = ref<any[]>([])
  const anomalies = ref<any[]>([])
  const selectedCard = ref<any>(null)
  const selectedAnomaly = ref<any>(null)
  const syncLogs = ref<any[]>([])
  const anomalyHistory = ref<any[]>([])
  const loading = ref(false)

  const openAnomaliesCount = computed(() => 
    anomalies.value.filter(a => a.status === 'open').length
  )

  const failedSyncCount = computed(() => 
    cards.value.filter(c => c.syncStatus === 'failed').length
  )

  async function fetchStatistics() {
    try {
      const res = await api.getStatistics()
      statistics.value = res.data.data
    } catch (e) {
      console.error('获取统计数据失败', e)
    }
  }

  async function fetchCards(params?: any) {
    try {
      const res = await api.getCards(params)
      cards.value = res.data.data.list
      return res.data.data
    } catch (e) {
      console.error('获取卡片列表失败', e)
      return { list: [], total: 0 }
    }
  }

  async function fetchAnomalies(params?: any) {
    try {
      const res = await api.getAnomalies(params)
      anomalies.value = res.data.data.list
      return res.data.data
    } catch (e) {
      console.error('获取异常列表失败', e)
      return { list: [], total: 0 }
    }
  }

  async function fetchCardDetail(id: string) {
    try {
      const res = await api.getCardById(id)
      selectedCard.value = res.data.data
      return res.data.data
    } catch (e) {
      console.error('获取卡片详情失败', e)
      return null
    }
  }

  async function fetchCardSyncLogs(id: string) {
    try {
      const res = await api.getCardSyncLogs(id)
      syncLogs.value = res.data.data
      return res.data.data
    } catch (e) {
      console.error('获取同步日志失败', e)
      return []
    }
  }

  async function fetchAnomalyHistory(id: string) {
    try {
      const res = await api.getAnomalyHistory(id)
      anomalyHistory.value = res.data.data
      return res.data.data
    } catch (e) {
      console.error('获取处理历史失败', e)
      return []
    }
  }

  async function doSyncCard(id: string, simulateSuccess = true) {
    loading.value = true
    try {
      const res = await api.syncCard(id, simulateSuccess)
      await Promise.all([fetchStatistics(), fetchCards(), fetchAnomalies()])
      return res.data.data
    } finally {
      loading.value = false
    }
  }

  async function doProcessAnomaly(id: string, data: any) {
    loading.value = true
    try {
      const res = await api.processAnomaly(id, data)
      await Promise.all([fetchStatistics(), fetchAnomalies()])
      return res.data.data
    } finally {
      loading.value = false
    }
  }

  return {
    statistics,
    cards,
    anomalies,
    selectedCard,
    selectedAnomaly,
    syncLogs,
    anomalyHistory,
    loading,
    openAnomaliesCount,
    failedSyncCount,
    fetchStatistics,
    fetchCards,
    fetchAnomalies,
    fetchCardDetail,
    fetchCardSyncLogs,
    fetchAnomalyHistory,
    doSyncCard,
    doProcessAnomaly
  }
})
