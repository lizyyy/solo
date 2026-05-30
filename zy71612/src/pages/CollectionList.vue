<template>
  <div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">托收管理</div>
        <div class="flex gap-8">
          <button class="btn btn-success" @click="exportCollections">导出Excel</button>
        </div>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <span>加载中...</span>
      </div>
      <div v-else-if="collections.length === 0" class="empty-state">
        <div class="icon">🏦</div>
        <p>暂无托收数据</p>
      </div>
      <div v-else class="table-container">
        <table>
          <thead>
          <tr>
            <th>票据号</th>
            <th>申请日期</th>
            <th>托收银行</th>
            <th>托收金额</th>
            <th>状态</th>
            <th>预计到账日</th>
            <th>实际到账日</th>
            <th>实际到账金额</th>
            <th>手续费</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="item in collections" :key="item.id">
            <td>{{ item.billNo }}</td>
            <td>{{ item.applyDate }}</td>
            <td>{{ item.bank }}</td>
            <td class="amount">¥{{ formatAmount(item.amount) }}</td>
            <td>
              <span :class="getStatusBadgeClass(item.status)">
                {{ getStatusText(item.status) }}
              </span>
            </td>
            <td>{{ item.expectedDate || '-' }}</td>
            <td>{{ item.actualDate || '-' }}</td>
            <td class="amount">{{ item.actualAmount ? '¥' + formatAmount(item.actualAmount) : '-' }}</td>
            <td class="amount">{{ item.fee ? '¥' + formatAmount(item.fee) : '-' }}</td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import collectionService from '../services/CollectionService.js'
import exportService from '../services/ExportService.js'
import { CollectionStatusText } from '../models/types.js'

const collections = ref([])
const loading = ref(false)

const formatAmount = (amount) => {
  return Number(amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const getStatusBadgeClass = (status) => {
  if (status === 'paid') return 'badge badge-success'
  if (status === 'rejected') return 'badge badge-danger'
  if (status === 'accepted') return 'badge badge-warning'
  return 'badge badge-primary'
}

const getStatusText = (status) => CollectionStatusText[status] || status

const loadCollections = async () => {
  loading.value = true
  try {
    collections.value = await collectionService.getAllCollections()
  } catch (error) {
    console.error('加载托收列表失败:', error)
  } finally {
    loading.value = false
  }
}

const exportCollections = async () => {
  try {
    await exportService.exportCollections(collections.value)
  } catch (error) {
    console.error('导出失败:', error)
    alert('导出失败')
  }
}

onMounted(() => {
  loadCollections()
})
</script>
