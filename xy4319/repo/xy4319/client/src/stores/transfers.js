import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api'

export const useTransfersStore = defineStore('transfers', () => {
  const transfers = ref([])
  const loading = ref(false)
  const error = ref(null)

  const statusOptions = [
    { value: 'pending', label: '等待中', color: '#eab308' },
    { value: 'in_progress', label: '进行中', color: '#3b82f6' },
    { value: 'completed', label: '已完成', color: '#22c55e' },
    { value: 'cancelled', label: '已取消', color: '#6b7280' }
  ]

  const pendingTransfers = computed(() => 
    transfers.value.filter(t => t.status === 'pending')
  )

  const inProgressTransfers = computed(() => 
    transfers.value.filter(t => t.status === 'in_progress')
  )

  const completedTransfers = computed(() => 
    transfers.value.filter(t => t.status === 'completed')
  )

  const stats = computed(() => ({
    total: transfers.value.length,
    pending: pendingTransfers.value.length,
    inProgress: inProgressTransfers.value.length,
    completed: completedTransfers.value.length
  }))

  async function fetchTransfers(params = {}) {
    loading.value = true
    error.value = null
    try {
      const response = await api.transfers.getAll(params)
      transfers.value = response.data
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || '获取转运队列失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function createTransfer(data) {
    loading.value = true
    error.value = null
    try {
      const response = await api.transfers.create(data)
      transfers.value.unshift(response.data)
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || '创建转运请求失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateTransfer(id, data) {
    loading.value = true
    error.value = null
    try {
      const response = await api.transfers.update(id, data)
      const index = transfers.value.findIndex(t => t.id === id)
      if (index !== -1) {
        transfers.value[index] = response.data
      }
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || '更新转运请求失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function reorderTransfers(transfersList) {
    loading.value = true
    error.value = null
    try {
      const response = await api.transfers.reorder(transfersList)
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || '重新排序失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  function addTransferToList(transfer) {
    const exists = transfers.value.find(t => t.id === transfer.id)
    if (!exists) {
      transfers.value.unshift(transfer)
    }
  }

  function updateTransferInList(transfer) {
    const index = transfers.value.findIndex(t => t.id === transfer.id)
    if (index !== -1) {
      transfers.value[index] = transfer
    }
  }

  function removeTransferFromList(id) {
    transfers.value = transfers.value.filter(t => t.id !== id)
  }

  function getStatusLabel(status) {
    const option = statusOptions.find(o => o.value === status)
    return option?.label || status
  }

  function getStatusColor(status) {
    const option = statusOptions.find(o => o.value === status)
    return option?.color || '#6b7280'
  }

  function getPriorityLabel(priority) {
    const labels = {
      1: '低',
      2: '中',
      3: '高'
    }
    return labels[priority] || '未知'
  }

  function getPriorityColor(priority) {
    const colors = {
      1: '#22c55e',
      2: '#eab308',
      3: '#ef4444'
    }
    return colors[priority] || '#6b7280'
  }

  return {
    transfers,
    loading,
    error,
    statusOptions,
    pendingTransfers,
    inProgressTransfers,
    completedTransfers,
    stats,
    fetchTransfers,
    createTransfer,
    updateTransfer,
    reorderTransfers,
    addTransferToList,
    updateTransferInList,
    removeTransferFromList,
    getStatusLabel,
    getStatusColor,
    getPriorityLabel,
    getPriorityColor
  }
})
