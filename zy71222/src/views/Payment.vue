<template>
  <div class="payment">
    <div class="page-title">回款流水</div>

    <el-row :gutter="20" class="payment-stats">
      <el-col :span="6">
        <div class="stats-card">
          <div class="stats-label">回款笔数</div>
          <div class="stats-value primary">{{ paymentStore.totalPayments }}</div>
          <div class="stats-trend">笔</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stats-card">
          <div class="stats-label">回款总金额</div>
          <div class="stats-value success">{{ formatMoney(paymentStore.totalPaymentAmount) }}</div>
          <div class="stats-trend">元</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stats-card">
          <div class="stats-label">红冲回补</div>
          <div class="stats-value warning">{{ redemptionPayments.length }}</div>
          <div class="stats-trend">笔</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stats-card">
          <div class="stats-label">红冲回款金额</div>
          <div class="stats-value danger">{{ formatMoney(redemptionPaymentAmount) }}</div>
          <div class="stats-trend">元</div>
        </div>
      </el-col>
    </el-row>

    <div class="page-container">
      <div class="filter-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索回款单号/红冲单号/发票号"
          style="width: 300px; margin-right: 16px;"
          clearable
        />
      </div>

      <el-table :data="filteredPayments" stripe border>
        <el-table-column prop="paymentNo" label="回款单号" width="160" />
        <el-table-column prop="redemptionId" label="关联红冲" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.redemptionId" type="info" size="small">{{ row.redemptionId }}</el-tag>
            <span v-else style="color: #909399;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="invoiceId" label="关联发票" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.invoiceId" type="warning" size="small">{{ row.invoiceId }}</el-tag>
            <span v-else style="color: #909399;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="回款金额" width="130">
          <template #default="{ row }">
            <span style="color: #67c23a; font-weight: 500;">{{ formatMoney(row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="paymentMethod" label="支付方式" width="100" />
        <el-table-column prop="payerName" label="付款方" min-width="160" show-overflow-tooltip />
        <el-table-column prop="bankName" label="开户银行" min-width="150" show-overflow-tooltip />
        <el-table-column prop="voucherNo" label="凭证号" width="180" />
        <el-table-column prop="paymentTime" label="回款时间" width="160">
          <template #default="{ row }">{{ formatTime(row.paymentTime) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'completed' ? 'success' : 'warning'" size="small">
              {{ row.status === 'completed' ? '已完成' : '处理中' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="120" />
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { usePaymentStore } from '@/stores/payment'
import { useRedemptionStore } from '@/stores/redemption'
import dayjs from 'dayjs'

const paymentStore = usePaymentStore()
const redemptionStore = useRedemptionStore()

const searchKeyword = ref('')

const filteredPayments = computed(() => {
  if (!searchKeyword.value) return paymentStore.payments
  
  const keyword = searchKeyword.value.toLowerCase()
  return paymentStore.payments.filter(p => 
    p.paymentNo.toLowerCase().includes(keyword) ||
    (p.redemptionId && p.redemptionId.toLowerCase().includes(keyword)) ||
    (p.invoiceId && p.invoiceId.toLowerCase().includes(keyword))
  )
})

const redemptionPayments = computed(() => {
  return paymentStore.payments.filter(p => p.redemptionId)
})

const redemptionPaymentAmount = computed(() => {
  return redemptionPayments.value.reduce((sum, p) => sum + p.amount, 0)
})

function formatMoney(value) {
  return '¥' + Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatTime(value) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
}
</script>

<style lang="scss" scoped>
.payment {
  .payment-stats {
    margin-bottom: 20px;
  }

  .filter-bar {
    margin-bottom: 16px;
  }
}
</style>
