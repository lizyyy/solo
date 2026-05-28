<template>
  <div class="redemption-detail">
    <el-descriptions :column="2" border>
      <el-descriptions-item label="红冲单号">{{ redemption.redemptionNo }}</el-descriptions-item>
      <el-descriptions-item label="发票号码">{{ redemption.invoiceNo }}</el-descriptions-item>
      <el-descriptions-item label="买方名称" :span="2">{{ redemption.buyerName }}</el-descriptions-item>
      <el-descriptions-item label="红冲金额">
        <span style="color: #f56c6c; font-weight: 600;">{{ formatMoney(redemption.amount) }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="税额">{{ formatMoney(redemption.taxAmount) }}</el-descriptions-item>
      <el-descriptions-item label="价税合计">{{ formatMoney(redemption.totalAmount) }}</el-descriptions-item>
      <el-descriptions-item label="红冲原因" :span="2">{{ redemption.reason }}</el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag :type="getStatusTagType(redemption.status)">
          {{ getStatusLabel(redemption.status) }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="申请人">{{ redemption.applicant }}</el-descriptions-item>
      <el-descriptions-item label="提交时间">{{ formatTime(redemption.submitTime) }}</el-descriptions-item>
      <el-descriptions-item label="买方确认时间">{{ formatTime(redemption.buyerConfirmTime) }}</el-descriptions-item>
      <el-descriptions-item label="额度释放时间">{{ formatTime(redemption.creditReleaseTime) }}</el-descriptions-item>
      <el-descriptions-item label="完成时间">{{ formatTime(redemption.completedTime) }}</el-descriptions-item>
      <el-descriptions-item label="备注" :span="2">{{ redemption.remark }}</el-descriptions-item>
    </el-descriptions>

    <div v-if="redemption.anomalies && redemption.anomalies.length > 0" class="anomaly-section">
      <div class="section-title">
        <el-icon><Warning /></el-icon>
        <span>异常检测</span>
        <el-tag type="danger" size="small" style="margin-left: 10px;">{{ redemption.anomalies.length }} 项异常</el-tag>
      </div>
      <div class="anomaly-list">
        <div 
          v-for="anomaly in redemption.anomalies" 
          :key="anomaly.type" 
          class="anomaly-item"
          :class="`anomaly-${anomaly.type}`"
        >
          <div class="anomaly-header">
            <el-tag :type="getAnomalyTagType(anomaly.type)" size="small">
              {{ getAnomalyLabel(anomaly.type) }}
            </el-tag>
          </div>
          <div class="reason-box">{{ anomaly.reason }}</div>
          <div class="anomaly-evidence">
            <span class="evidence-label">证据依据：</span>
            {{ anomaly.evidence }}
          </div>
        </div>
      </div>
    </div>

    <div class="timeline-section">
      <div class="section-title">
        <el-icon><Time /></el-icon>
        <span>状态流转历史</span>
      </div>
      <el-timeline>
        <el-timeline-item
          v-for="(item, index) in sortedHistory"
          :key="item.id"
          :timestamp="formatTime(item.operateTime)"
          :type="getTimelineType(index)"
        >
          <div class="timeline-content">
            <div class="timeline-status">
              <el-tag size="small">{{ getStatusLabel(item.toStatus) }}</el-tag>
            </div>
            <div class="timeline-remark">{{ item.remark }}</div>
            <div class="timeline-operator">操作人：{{ item.operator }}</div>
          </div>
        </el-timeline-item>
      </el-timeline>
    </div>

    <div v-if="relatedPayments.length > 0" class="payment-section">
      <div class="section-title">
        <el-icon><Money /></el-icon>
        <span>关联回款流水</span>
      </div>
      <el-table :data="relatedPayments" size="small" border>
        <el-table-column prop="paymentNo" label="回款单号" width="160" />
        <el-table-column prop="amount" label="回款金额" width="120">
          <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
        </el-table-column>
        <el-table-column prop="paymentMethod" label="支付方式" width="100" />
        <el-table-column prop="paymentTime" label="回款时间" width="160">
          <template #default="{ row }">{{ formatTime(row.paymentTime) }}</template>
        </el-table-column>
        <el-table-column prop="voucherNo" label="凭证号" width="180" />
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePaymentStore } from '@/stores/payment'
import { REDEMPTION_STATUS_LABEL, ANOMALY_LABELS } from '@/stores/redemption'
import dayjs from 'dayjs'

const props = defineProps({
  redemption: {
    type: Object,
    required: true
  }
})

const paymentStore = usePaymentStore()

const sortedHistory = computed(() => {
  const history = props.redemption.statusHistory || []
  return [...history].sort((a, b) => new Date(a.operateTime) - new Date(b.operateTime))
})

const relatedPayments = computed(() => {
  return paymentStore.getPaymentsByRedemptionId(props.redemption.id)
})

function formatMoney(value) {
  if (!value) return '-'
  return '¥' + Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatTime(value) {
  if (!value) return '-'
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

function getTimelineType(index) {
  if (index === 0) return 'primary'
  if (index === sortedHistory.value.length - 1) return 'success'
  return ''
}
</script>

<style lang="scss" scoped>
.redemption-detail {
  .anomaly-section,
  .timeline-section,
  .payment-section {
    margin-top: 24px;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #ebeef5;
  }

  .anomaly-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .anomaly-item {
    padding: 16px;
    border-radius: 8px;

    &.anomaly-duplicate {
      background: #fef0f0;
      border: 1px solid #fde2e2;
    }

    &.anomaly-early_release {
      background: #fdf6ec;
      border: 1px solid #faecd8;
    }

    &.anomaly-unconfirmed {
      background: #fef0f0;
      border: 1px solid #fde2e2;
    }

    .anomaly-header {
      margin-bottom: 8px;
    }

    .reason-box {
      background: #fff;
      border-left: 4px solid #409eff;
      padding: 12px 16px;
      border-radius: 0 4px 4px 0;
      font-size: 14px;
      color: #606266;
      margin-bottom: 8px;
    }

    .anomaly-evidence {
      font-size: 13px;
      color: #909399;

      .evidence-label {
        font-weight: 500;
        color: #606266;
      }
    }
  }

  .timeline-content {
    .timeline-status {
      margin-bottom: 4px;
    }

    .timeline-remark {
      font-size: 14px;
      color: #606266;
      margin-bottom: 4px;
    }

    .timeline-operator {
      font-size: 12px;
      color: #909399;
    }
  }
}
</style>
