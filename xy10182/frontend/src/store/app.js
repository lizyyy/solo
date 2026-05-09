import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getOverview, getAlerts } from '../api/alert'

export const useAppStore = defineStore('app', () => {
  const overview = ref(null)
  const alerts = ref([])
  const alertStats = ref({})
  const loading = ref(false)

  const totalAlerts = computed(() => alerts.value.length)

  async function fetchOverview() {
    loading.value = true
    try {
      const res = await getOverview()
      overview.value = res.data
    } catch (e) {
      console.error('获取概览失败', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchAlerts() {
    try {
      const res = await getAlerts()
      alerts.value = res.data || []
      alertStats.value = res.stats || {}
    } catch (e) {
      console.error('获取预警失败', e)
    }
  }

  async function refreshAll() {
    await Promise.all([fetchOverview(), fetchAlerts()])
  }

  return {
    overview,
    alerts,
    alertStats,
    loading,
    totalAlerts,
    fetchOverview,
    fetchAlerts,
    refreshAll
  }
})
