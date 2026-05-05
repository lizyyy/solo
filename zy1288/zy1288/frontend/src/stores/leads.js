import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { leadApi } from '@/api/leads'

export const useLeadsStore = defineStore('leads', () => {
  const leads = ref([])
  const currentLead = ref(null)
  const currentLeadHistory = ref([])
  const metadata = ref({
    statuses: [],
    courses: [],
    responsibles: [],
    status_flow: {}
  })
  const pagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })
  const filters = ref({
    status: '',
    responsible: ''
  })
  const loading = ref(false)
  const error = ref(null)

  const getStatusLabel = (status) => {
    const statusOption = metadata.value.statuses.find(s => s.value === status)
    return statusOption ? statusOption.label : status
  }

  const getStatusType = (status) => {
    const statusTypes = {
      'new': 'primary',
      'contacting': 'warning',
      'appointed': 'info',
      'attended': 'success',
      'no_show': 'danger',
      'cancelled': 'warning',
      'converted': 'success',
      'not_interested': 'info',
      'lost': 'danger',
      'reappointed': 'warning'
    }
    return statusTypes[status] || 'info'
  }

  const getAllowedStatuses = (currentStatus) => {
    const flow = metadata.value.status_flow[currentStatus]
    if (!flow) return []
    return [currentStatus, ...flow]
  }

  const fetchMetadata = async () => {
    try {
      const result = await leadApi.getMetadata()
      metadata.value = result.data
    } catch (err) {
      error.value = err.message
      console.error('获取元数据失败:', err)
    }
  }

  const fetchLeads = async (newFilters = null, newPagination = null) => {
    loading.value = true
    error.value = null

    try {
      if (newFilters) {
        filters.value = { ...filters.value, ...newFilters }
      }
      if (newPagination) {
        pagination.value = { ...pagination.value, ...newPagination }
      }

      const params = {
        page: pagination.value.page,
        limit: pagination.value.limit
      }

      if (filters.value.status) {
        params.status = filters.value.status
      }
      if (filters.value.responsible) {
        params.responsible = filters.value.responsible
      }

      const result = await leadApi.getLeads(params)
      leads.value = result.data.leads
      pagination.value = result.data.pagination
    } catch (err) {
      error.value = err.message
      console.error('获取线索列表失败:', err)
    } finally {
      loading.value = false
    }
  }

  const fetchLeadById = async (id) => {
    loading.value = true
    error.value = null

    try {
      const result = await leadApi.getLeadById(id)
      currentLead.value = result.data.lead
      currentLeadHistory.value = result.data.history
      return result.data
    } catch (err) {
      error.value = err.message
      console.error('获取线索详情失败:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const createLead = async (data) => {
    loading.value = true
    error.value = null

    try {
      const result = await leadApi.createLead(data)
      await fetchLeads()
      return result.data.lead
    } catch (err) {
      error.value = err.message
      console.error('创建线索失败:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateLead = async (id, data) => {
    loading.value = true
    error.value = null

    try {
      const result = await leadApi.updateLead(id, data)
      
      if (currentLead.value && currentLead.value.id === id) {
        currentLead.value = result.data.lead
      }

      const listIndex = leads.value.findIndex(lead => lead.id === id)
      if (listIndex !== -1) {
        leads.value[listIndex] = result.data.lead
        leads.value = [...leads.value]
      }

      if (currentLead.value && currentLead.value.id === id) {
        const detailResult = await leadApi.getLeadById(id)
        currentLeadHistory.value = detailResult.data.history
      }

      return result.data
    } catch (err) {
      error.value = err.message
      console.error('更新线索失败:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteLead = async (id) => {
    loading.value = true
    error.value = null

    try {
      await leadApi.deleteLead(id)
      leads.value = leads.value.filter(lead => lead.id !== id)
      
      if (currentLead.value && currentLead.value.id === id) {
        currentLead.value = null
        currentLeadHistory.value = []
      }

      return true
    } catch (err) {
      error.value = err.message
      console.error('删除线索失败:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const exportMarkdownReport = async (id) => {
    loading.value = true
    error.value = null

    try {
      const blob = await leadApi.exportMarkdown(id)
      
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `lead_${id}_report.md`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      return true
    } catch (err) {
      error.value = err.message
      console.error('导出报告失败:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const setCurrentLead = (lead) => {
    currentLead.value = lead
  }

  const clearCurrentLead = () => {
    currentLead.value = null
    currentLeadHistory.value = []
  }

  const setFilters = (newFilters) => {
    filters.value = { ...filters.value, ...newFilters }
    pagination.value.page = 1
  }

  const resetFilters = () => {
    filters.value = {
      status: '',
      responsible: ''
    }
    pagination.value.page = 1
  }

  return {
    leads,
    currentLead,
    currentLeadHistory,
    metadata,
    pagination,
    filters,
    loading,
    error,
    getStatusLabel,
    getStatusType,
    getAllowedStatuses,
    fetchMetadata,
    fetchLeads,
    fetchLeadById,
    createLead,
    updateLead,
    deleteLead,
    exportMarkdownReport,
    setCurrentLead,
    clearCurrentLead,
    setFilters,
    resetFilters
  }
})
