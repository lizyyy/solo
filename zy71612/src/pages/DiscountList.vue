<template>
  <div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">贴现管理</div>
        <div class="flex gap-8">
          <button class="btn btn-success" @click="exportDiscounts">导出Excel</button>
        </div>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <span>加载中...</span>
      </div>
      <div v-else-if="discounts.length === 0" class="empty-state">
        <div class="icon">💰</div>
        <p>暂无贴现数据</p>
      </div>
      <div v-else class="table-container">
        <table>
          <thead>
          <tr>
            <th>票据号</th>
            <th>申请日期</th>
            <th>贴现银行</th>
            <th>票面金额</th>
            <th>贴现利率</th>
            <th>贴现利息</th>
            <th>实付金额</th>
            <th>状态</th>
            <th>放款日期</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="item in discounts" :key="item.id">
            <td>{{ item.billNo }}</td>
            <td>{{ item.applyDate }}</td>
            <td>{{ item.bank }}</td>
            <td class="amount">¥{{ formatAmount(item.amount) }}</td>
            <td>{{ item.discountRate }}%</td>
            <td class="amount">¥{{ formatAmount(item.discountAmount) }}</td>
            <td class="amount">¥{{ formatAmount(item.actualAmount) }}</td>
            <td>
              <span :class="getStatusBadgeClass(item.status)">
                {{ getStatusText(item.status) }}
              </span>
            </td>
            <td>{{ item.actualDate || '-' }}</td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import discountService from '../services/DiscountService.js'
import exportService from '../services/ExportService.js'
import { DiscountStatusText } from '../models/types.js'

const discounts = ref([])
const loading = ref(false)

const formatAmount = (amount) => {
  return Number(amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const getStatusBadgeClass = (status) => {
  if (status === 'paid') return 'badge badge-success'
  if (status === 'rejected') return 'badge badge-danger'
  if (status === 'approved') return 'badge badge-warning'
  return 'badge badge-primary'
}

const getStatusText = (status) => DiscountStatusText[status] || status

const loadDiscounts = async () => {
  loading.value = true
  try {
    discounts.value = await discountService.getAllDiscounts()
  } catch (error) {
    console.error('加载贴现列表失败:', error)
  } finally {
    loading.value = false
  }
}

const exportDiscounts = async () => {
  try {
    await exportService.exportDiscounts(discounts.value)
  } catch (error) {
    console.error('导出失败:', error)
    alert('导出失败')
  }
}

onMounted(() => {
  loadDiscounts()
})
</script>
