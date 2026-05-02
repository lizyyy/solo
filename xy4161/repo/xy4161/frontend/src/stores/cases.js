import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { caseApi, dashboardApi } from '../api'

export const useCaseStore = defineStore('cases', () => {
  const cases = ref([])
  const currentCase = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const dashboardStats = ref(null)

  const caseById = computed(() => (id) => {
    return cases.value.find(c => c.id === id)
  })

  const fetchCases = async (params = {}) => {
    loading.value = true
    error.value = null
    try {
      const response = await caseApi.getAll(params)
      cases.value = response.data
    } catch (e) {
      error.value = e.response?.data?.error || e.message
    } finally {
      loading.value = false
    }
  }

  const fetchCaseById = async (id) => {
    loading.value = true
    error.value = null
    try {
      const response = await caseApi.getById(id)
      currentCase.value = response.data
      return response.data
    } catch (e) {
      error.value = e.response?.data?.error || e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  const createCase = async (data) => {
    loading.value = true
    error.value = null
    try {
      const response = await caseApi.create(data)
      cases.value.unshift(response.data)
      return response.data
    } catch (e) {
      error.value = e.response?.data?.error || e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  const transitionCase = async (id, data) => {
    loading.value = true
    error.value = null
    try {
      const response = await caseApi.transition(id, data)
      const index = cases.value.findIndex(c => c.id === id)
      if (index !== -1) {
        cases.value[index].status = response.data.newStatus
      }
      return response.data
    } catch (e) {
      error.value = e.response?.data?.error || e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  const fetchDashboardStats = async () => {
    loading.value = true
    error.value = null
    try {
      const response = await dashboardApi.getStats()
      dashboardStats.value = response.data
      return response.data
    } catch (e) {
      error.value = e.response?.data?.error || e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    cases,
    currentCase,
    loading,
    error,
    dashboardStats,
    caseById,
    fetchCases,
    fetchCaseById,
    createCase,
    transitionCase,
    fetchDashboardStats
  }
})
