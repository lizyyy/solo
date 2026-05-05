import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DashboardStatistics } from '@/types'
import { getDashboardStatistics } from '@/api/dashboard'

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(false)
  const currentRoute = ref('/dashboard')
  const loading = ref(false)
  
  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }
  
  const setCurrentRoute = (route: string) => {
    currentRoute.value = route
  }
  
  const setLoading = (value: boolean) => {
    loading.value = value
  }
  
  return {
    sidebarCollapsed,
    currentRoute,
    loading,
    toggleSidebar,
    setCurrentRoute,
    setLoading,
  }
})

export const useDashboardStore = defineStore('dashboard', () => {
  const statistics = ref<DashboardStatistics | null>(null)
  const loading = ref(false)
  
  const fetchStatistics = async () => {
    loading.value = true
    try {
      statistics.value = await getDashboardStatistics()
    } catch (error) {
      console.error('获取仪表盘数据失败:', error)
    } finally {
      loading.value = false
    }
  }
  
  const totalRisks = computed(() => {
    if (!statistics.value) return 0
    return (
      statistics.value.critical_risks +
      statistics.value.high_risks +
      statistics.value.medium_risks +
      statistics.value.low_risks
    )
  })
  
  const highRiskCount = computed(() => {
    if (!statistics.value) return 0
    return statistics.value.critical_risks + statistics.value.high_risks
  })
  
  return {
    statistics,
    loading,
    totalRisks,
    highRiskCount,
    fetchStatistics,
  }
})
