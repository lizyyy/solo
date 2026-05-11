<template>
  <div class="transactions-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>流水记录</span>
          <div style="display: flex; align-items: center; gap: 10px;">
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
            />
            <el-button type="primary" @click="loadTransactions">查询</el-button>
          </div>
        </div>
      </template>
      
      <el-row :gutter="20" style="margin-bottom: 20px;">
        <el-col :span="6">
          <el-statistic title="总收入" :value="totalIncome">
            <template #suffix>
              元
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="6">
          <el-statistic title="总退款" :value="totalRefund" suffix="元" value-style="color: #f56c6c;" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="净收入" :value="netIncome" suffix="元" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="交易笔数" :value="transactionsCount" suffix="笔" />
        </el-col>
      </el-row>
      
      <el-table :data="transactions" style="width: 100%;" v-loading="loading">
        <el-table-column prop="created_at" label="时间" width="180" />
        <el-table-column prop="customer_name" label="客户" width="120" />
        <el-table-column prop="package_name" label="套餐" width="200" />
        <el-table-column label="类型" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.type === 'payment' || scope.row.type === 'initial_payment' ? 'success' : 'danger'">
              {{ scope.row.type === 'payment' ? '缴费' : scope.row.type === 'initial_payment' ? '套餐费' : '退款' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="120">
          <template #default="scope">
            <span :style="{ color: scope.row.type === 'refund' ? '#f56c6c' : '#67c23a', fontWeight: 'bold' }">
              {{ scope.row.type === 'refund' ? '-' : '+' }}¥{{ scope.row.amount }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" width="200" />
        <el-table-column prop="staff_name" label="操作人" width="120" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { paymentApi } from '../api'

const loading = ref(false)
const transactions = ref([])
const dateRange = ref([])

const totalIncome = computed(() => {
  return transactions.value
    .filter(t => t.type === 'payment' || t.type === 'initial_payment')
    .reduce((sum, t) => sum + t.amount, 0)
    .toFixed(2)
})

const totalRefund = computed(() => {
  return transactions.value
    .filter(t => t.type === 'refund')
    .reduce((sum, t) => sum + t.amount, 0)
    .toFixed(2)
})

const netIncome = computed(() => {
  return (parseFloat(totalIncome.value) - parseFloat(totalRefund.value)).toFixed(2)
})

const transactionsCount = computed(() => {
  return transactions.value.length
})

const loadTransactions = async () => {
  loading.value = true
  try {
    const params = {}
    if (dateRange.value && dateRange.value.length === 2) {
      params.start_date = dateRange.value[0]
      params.end_date = dateRange.value[1]
    }
    
    const res = await paymentApi.getTransactions(params)
    transactions.value = res.data
  } catch (error) {
    console.error('加载流水记录失败:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTransactions()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
