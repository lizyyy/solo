<template>
  <el-drawer
    v-model="visible"
    title="发票详情"
    direction="rtl"
    size="800px"
    :before-close="handleClose"
  >
    <div v-loading="loading" class="detail-content">
      <el-descriptions title="基本信息" :column="2" border>
        <el-descriptions-item label="发票号码">{{ invoice?.invoice_number || '-' }}</el-descriptions-item>
        <el-descriptions-item label="发票代码">{{ invoice?.invoice_code || '-' }}</el-descriptions-item>
        <el-descriptions-item label="税号">{{ invoice?.tax_number || '-' }}</el-descriptions-item>
        <el-descriptions-item label="金额">
          <span class="amount-text">¥{{ formatAmount(invoice?.amount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="开票日期">{{ invoice?.invoice_date || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(invoice?.status)">{{ getStatusText(invoice?.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="销售方" :span="2">{{ invoice?.seller_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="购买方" :span="2">{{ invoice?.buyer_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="置信度" :span="2">
          <el-progress 
            :percentage="Math.round((invoice?.confidence || 0) * 100)" 
            :stroke-width="10"
            :color="getConfidenceColor(invoice?.confidence)"
          />
        </el-descriptions-item>
      </el-descriptions>

      <div v-if="invoice?.duplicates && invoice.duplicates.length > 0" class="section">
        <h4><el-icon type="warning"><Warning /></el-icon> 重复票据警告</h4>
        <el-alert
          v-for="(dup, idx) in invoice.duplicates"
          :key="idx"
          :title="`与发票 ${dup.duplicate_with.slice(0, 8)}... 重复`"
          :type="'warning'"
          :closable="false"
          style="margin-bottom: 10px"
        >
          <template #default>
            <p>原因: {{ dup.reason }}</p>
          </template>
        </el-alert>
      </div>

      <div class="section">
        <div class="section-header">
          <h4>操作时间线</h4>
          <el-button size="small" @click="recalculate">
            <el-icon><Refresh /></el-icon>
            重新校验
          </el-button>
        </div>
        <el-timeline>
          <el-timeline-item
            v-for="(log, idx) in auditLogs"
            :key="idx"
            :timestamp="log.created_at"
            :type="getTimelineType(log.status_to)"
            :hollow="idx === 0"
          >
            <el-card shadow="hover" class="timeline-card">
              <div class="log-header">
                <span class="log-action">{{ getStatusText(log.status_to) }}</span>
                <el-tag size="small" :type="getTimelineType(log.status_to)">
                  {{ log.operator || 'system' }}
                </el-tag>
              </div>
              <p v-if="log.reason" class="log-reason">{{ log.reason }}</p>
              <p v-if="log.fields_changed" class="log-fields">
                字段变更: {{ log.fields_changed }}
              </p>
            </el-card>
          </el-timeline-item>
        </el-timeline>
      </div>

      <div v-if="invoice?.status === 'review_pending'" class="action-footer">
        <el-button type="primary" size="large" @click="openReview">
          <el-icon><Check /></el-icon>
          开始审核
        </el-button>
      </div>
    </div>

    <ReviewDrawer 
      v-model:visible="showReview" 
      :invoice="invoice"
      @reviewed="handleReviewed"
    />
  </el-drawer>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getInvoice, recalculateInvoice } from '../api'
import ReviewDrawer from './ReviewDrawer.vue'

const props = defineProps({
  visible: Boolean,
  invoice: Object
})

const emit = defineEmits(['update:visible', 'updated'])

const loading = ref(false)
const auditLogs = ref([])
const showReview = ref(false)

const statusMap = {
  pending: { text: '待处理', type: 'info' },
  uploaded: { text: '已上传', type: 'info' },
  ocr_processing: { text: '识别中', type: 'warning' },
  ocr_failed: { text: '识别失败', type: 'danger' },
  ocr_success: { text: '识别成功', type: 'success' },
  tax_validating: { text: '校验中', type: 'warning' },
  tax_invalid: { text: '税号无效', type: 'danger' },
  duplicate_checking: { text: '查重中', type: 'warning' },
  duplicate_found: { text: '重复票据', type: 'danger' },
  review_pending: { text: '待审核', type: 'warning' },
  review_approved: { text: '审核通过', type: 'success' },
  review_rejected: { text: '审核驳回', type: 'danger' },
  export_ready: { text: '待导出', type: 'success' },
  exported: { text: '已导出', type: 'success' }
}

watch(() => props.visible, async (val) => {
  if (val && props.invoice?.id) {
    await loadDetail(props.invoice.id)
  }
})

async function loadDetail(id) {
  loading.value = true
  try {
    const res = await getInvoice(id)
    auditLogs.value = res.data.auditLogs || []
  } catch (error) {
    ElMessage.error('加载详情失败')
  } finally {
    loading.value = false
  }
}

async function recalculate() {
  try {
    await recalculateInvoice(props.invoice.id)
    ElMessage.success('重新校验完成')
    await loadDetail(props.invoice.id)
    emit('updated')
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '重新校验失败')
  }
}

function getStatusText(status) {
  return statusMap[status]?.text || status
}

function getStatusType(status) {
  return statusMap[status]?.type || 'info'
}

function getTimelineType(status) {
  const type = getStatusType(status)
  if (type === 'danger') return 'danger'
  if (type === 'success') return 'success'
  if (type === 'warning') return 'warning'
  return 'primary'
}

function getConfidenceColor(confidence) {
  if (!confidence) return '#909399'
  if (confidence >= 0.9) return '#67c23a'
  if (confidence >= 0.7) return '#e6a23c'
  return '#f56c6c'
}

function formatAmount(amount) {
  return parseFloat(amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function openReview() {
  showReview.value = true
}

function handleReviewed() {
  emit('updated')
  handleClose()
}

function handleClose() {
  emit('update:visible', false)
}
</script>

<style scoped>
.detail-content {
  padding: 0 20px 20px;
}

.amount-text {
  font-weight: 700;
  color: #f56c6c;
  font-size: 18px;
}

.section {
  margin-top: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section h4 {
  margin: 0 0 16px;
  font-size: 16px;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 8px;
}

.timeline-card {
  max-width: 500px;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.log-action {
  font-weight: 600;
  color: #303133;
}

.log-reason {
  margin: 8px 0 0;
  color: #606266;
  font-size: 14px;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;
}

.log-fields {
  margin: 8px 0 0;
  color: #909399;
  font-size: 12px;
}

.action-footer {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
  text-align: center;
}
</style>
