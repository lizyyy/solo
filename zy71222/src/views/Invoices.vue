<template>
  <div class="invoices">
    <div class="page-title">发票管理</div>

    <div class="page-container">
      <el-table :data="invoiceStore.invoices" stripe border>
        <el-table-column prop="invoiceNo" label="发票号码" width="180">
          <template #default="{ row }">
            <el-link type="primary" @click="handleViewDetail(row)">{{ row.invoiceNo }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="invoiceType" label="发票类型" width="140" />
        <el-table-column prop="amount" label="金额" width="120">
          <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
        </el-table-column>
        <el-table-column prop="taxAmount" label="税额" width="120">
          <template #default="{ row }">{{ formatMoney(row.taxAmount) }}</template>
        </el-table-column>
        <el-table-column prop="totalAmount" label="价税合计" width="140">
          <template #default="{ row }">{{ formatMoney(row.totalAmount) }}</template>
        </el-table-column>
        <el-table-column prop="buyerName" label="买方名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="invoiceDate" label="开票日期" width="120" />
        <el-table-column prop="dueDate" label="到期日期" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'normal' ? 'success' : 'danger'" size="small">
              {{ row.status === 'normal' ? '正常' : '已作废' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="红冲记录" width="100">
          <template #default="{ row }">
            <el-badge :value="getRedemptionCount(row.id)" :max="99">
              <el-button type="primary" link size="small" @click="handleViewRedemptions(row)">
                查看
              </el-button>
            </el-badge>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="detailDialogVisible" title="发票详情" width="800px">
      <el-descriptions v-if="currentInvoice" :column="2" border>
        <el-descriptions-item label="发票号码">{{ currentInvoice.invoiceNo }}</el-descriptions-item>
        <el-descriptions-item label="发票代码">{{ currentInvoice.invoiceCode }}</el-descriptions-item>
        <el-descriptions-item label="发票类型">{{ currentInvoice.invoiceType }}</el-descriptions-item>
        <el-descriptions-item label="开票日期">{{ currentInvoice.invoiceDate }}</el-descriptions-item>
        <el-descriptions-item label="金额">{{ formatMoney(currentInvoice.amount) }}</el-descriptions-item>
        <el-descriptions-item label="税额">{{ formatMoney(currentInvoice.taxAmount) }}</el-descriptions-item>
        <el-descriptions-item label="价税合计" :span="2">
          <span style="font-weight: 600;">{{ formatMoney(currentInvoice.totalAmount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="买方名称" :span="2">{{ currentInvoice.buyerName }}</el-descriptions-item>
        <el-descriptions-item label="买方税号" :span="2">{{ currentInvoice.buyerTaxNo }}</el-descriptions-item>
        <el-descriptions-item label="卖方名称" :span="2">{{ currentInvoice.sellerName }}</el-descriptions-item>
        <el-descriptions-item label="卖方税号" :span="2">{{ currentInvoice.sellerTaxNo }}</el-descriptions-item>
        <el-descriptions-item label="到期日期">{{ currentInvoice.dueDate }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="currentInvoice.status === 'normal' ? 'success' : 'danger'">
            {{ currentInvoice.status === 'normal' ? '正常' : '已作废' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ currentInvoice.remark }}</el-descriptions-item>
        <el-descriptions-item label="操作人">{{ currentInvoice.operator }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatTime(currentInvoice.createTime) }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog v-model="redemptionsDialogVisible" title="关联红冲记录" width="900px">
      <el-table :data="relatedRedemptions" stripe size="small">
        <el-table-column prop="redemptionNo" label="红冲单号" width="140" />
        <el-table-column prop="amount" label="红冲金额" width="120">
          <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
        </el-table-column>
        <el-table-column prop="reason" label="红冲原因" min-width="150" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="applicant" label="申请人" width="120" />
        <el-table-column label="异常" width="100">
          <template #default="{ row }">
            <div v-if="row.anomalies && row.anomalies.length > 0">
              <el-tag 
                v-for="anomaly in row.anomalies" 
                :key="anomaly.type"
                :type="getAnomalyTagType(anomaly.type)"
                size="small"
                style="margin-right: 4px;"
              >
                {{ getAnomalyLabel(anomaly.type) }}
              </el-tag>
            </div>
            <span v-else style="color: #909399;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="申请时间" width="160">
          <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useInvoiceStore } from '@/stores/invoice'
import { useRedemptionStore } from '@/stores/redemption'
import { REDEMPTION_STATUS_LABEL, ANOMALY_LABELS } from '@/stores/redemption'
import dayjs from 'dayjs'

const invoiceStore = useInvoiceStore()
const redemptionStore = useRedemptionStore()

const detailDialogVisible = ref(false)
const redemptionsDialogVisible = ref(false)
const currentInvoice = ref(null)
const relatedRedemptions = ref([])

function formatMoney(value) {
  return '¥' + Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatTime(value) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
}

function getStatusLabel(status) {
  return REDEMPTION_STATUS_LABEL[status] || status
}

function getStatusTagType(status) {
  const typeMap = {
    draft: 'info',
    submitted: 'warning',
    buyer_confirmed: 'primary',
    processing: 'primary',
    completed: 'success',
    rejected: 'danger'
  }
  return typeMap[status] || 'info'
}

function getAnomalyLabel(type) {
  return ANOMALY_LABELS[type] || type
}

function getAnomalyTagType(type) {
  const typeMap = {
    duplicate: 'danger',
    early_release: 'warning',
    unconfirmed: 'danger'
  }
  return typeMap[type] || 'warning'
}

function getRedemptionCount(invoiceId) {
  return redemptionStore.redemptions.filter(r => r.invoiceId === invoiceId).length
}

function handleViewDetail(row) {
  currentInvoice.value = row
  detailDialogVisible.value = true
}

function handleViewRedemptions(row) {
  relatedRedemptions.value = redemptionStore.redemptions.filter(r => r.invoiceId === row.id)
  redemptionsDialogVisible.value = true
}
</script>

<style lang="scss" scoped>
.invoices {
}
</style>
