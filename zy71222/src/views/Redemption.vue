<template>
  <div class="redemption">
    <div class="page-title">红冲申请</div>

    <div class="page-container">
      <div class="filter-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索红冲单号/发票号/买方名称"
          style="width: 300px; margin-right: 16px;"
          clearable
        />
        <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 150px; margin-right: 16px;">
          <el-option label="草稿" value="draft" />
          <el-option label="已提交" value="submitted" />
          <el-option label="买方已确认" value="buyer_confirmed" />
          <el-option label="处理中" value="processing" />
          <el-option label="已完成" value="completed" />
          <el-option label="已拒绝" value="rejected" />
        </el-select>
        <el-select v-model="anomalyFilter" placeholder="异常筛选" clearable style="width: 150px;">
          <el-option label="重复红冲" value="duplicate" />
          <el-option label="额度提前释放" value="early_release" />
          <el-option label="买方未确认" value="unconfirmed" />
        </el-select>
      </div>

      <el-table :data="filteredRedemptions" stripe border>
        <el-table-column prop="redemptionNo" label="红冲单号" width="140">
          <template #default="{ row }">
            <el-link type="primary" @click="handleViewDetail(row)">{{ row.redemptionNo }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="invoiceNo" label="发票号码" width="180" />
        <el-table-column prop="buyerName" label="买方名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="amount" label="红冲金额" width="120">
          <template #default="{ row }">
            <span style="color: #f56c6c;">{{ formatMoney(row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="红冲原因" min-width="150" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="异常" width="180">
          <template #default="{ row }">
            <div v-if="row.anomalies && row.anomalies.length > 0" style="display: flex; gap: 4px; flex-wrap: wrap;">
              <el-tag 
                v-for="anomaly in row.anomalies" 
                :key="anomaly.type"
                :type="getAnomalyTagType(anomaly.type)"
                size="small"
                @click="showAnomalyDetail(anomaly)"
                style="cursor: pointer;"
              >
                {{ getAnomalyLabel(anomaly.type) }}
              </el-tag>
            </div>
            <span v-else style="color: #909399;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="历史一致" width="100">
          <template #default="{ row }">
            <el-tooltip 
              v-if="row.statusHistoryValid === false" 
              :content="row.statusHistoryErrors?.join('；') || '状态历史不一致'" 
              placement="top"
            >
              <el-tag type="danger" size="small" style="cursor: pointer;">
                <el-icon><Warning /></el-icon>
                不一致
              </el-tag>
            </el-tooltip>
            <el-tag v-else type="success" size="small">
              <el-icon><CircleCheck /></el-icon>
              一致
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="applicant" label="申请人" width="120" />
        <el-table-column prop="createTime" label="申请时间" width="160">
          <template #default="{ row }">{{ formatTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleViewDetail(row)">详情</el-button>
            <el-button 
              v-if="row.status === 'draft'" 
              type="success" 
              link 
              size="small"
              @click="handleSubmit(row)"
            >
              提交
            </el-button>
            <el-button 
              v-if="row.status === 'submitted'" 
              type="primary" 
              link 
              size="small"
              @click="handleBuyerConfirm(row)"
            >
              买方确认
            </el-button>
            <el-button 
              v-if="row.status === 'buyer_confirmed'" 
              type="primary" 
              link 
              size="small"
              @click="handleStartProcess(row)"
            >
              开始处理
            </el-button>
            <el-button 
              v-if="row.status === 'processing'" 
              type="success" 
              link 
              size="small"
              @click="handleComplete(row)"
            >
              完成
            </el-button>
            <el-button 
              v-if="['draft', 'submitted'].includes(row.status)" 
              type="danger" 
              link 
              size="small"
              @click="handleReject(row)"
            >
              拒绝
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="detailDialogVisible" title="红冲申请详情" width="900px">
      <RedemptionDetail v-if="currentRedemption" :redemption="currentRedemption" />
    </el-dialog>

    <el-dialog v-model="anomalyDialogVisible" title="异常详情" width="600px">
      <div v-if="currentAnomaly">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="异常类型">
            <el-tag :type="getAnomalyTagType(currentAnomaly.type)">
              {{ getAnomalyLabel(currentAnomaly.type) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="判断理由">
            <div class="reason-box">{{ currentAnomaly.reason }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="证据依据">
            <div style="color: #606266; font-size: 14px;">{{ currentAnomaly.evidence }}</div>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>

    <el-dialog v-model="rejectDialogVisible" title="拒绝申请" width="500px">
      <el-form :model="rejectForm" label-width="80px">
        <el-form-item label="拒绝原因">
          <el-input
            v-model="rejectForm.reason"
            type="textarea"
            :rows="4"
            placeholder="请输入拒绝原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmReject">确认拒绝</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRedemptionStore } from '@/stores/redemption'
import { REDEMPTION_STATUS_LABEL, ANOMALY_LABELS } from '@/stores/redemption'
import { ElMessage } from 'element-plus'
import RedemptionDetail from '@/components/RedemptionDetail.vue'
import dayjs from 'dayjs'

const redemptionStore = useRedemptionStore()

const searchKeyword = ref('')
const statusFilter = ref('')
const anomalyFilter = ref('')
const detailDialogVisible = ref(false)
const anomalyDialogVisible = ref(false)
const rejectDialogVisible = ref(false)
const currentRedemption = ref(null)
const currentAnomaly = ref(null)
const currentRejectItem = ref(null)
const rejectForm = ref({ reason: '' })

const filteredRedemptions = computed(() => {
  let result = redemptionStore.redemptions

  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(r => 
      r.redemptionNo.toLowerCase().includes(keyword) ||
      r.invoiceNo.toLowerCase().includes(keyword) ||
      r.buyerName.toLowerCase().includes(keyword)
    )
  }

  if (statusFilter.value) {
    result = result.filter(r => r.status === statusFilter.value)
  }

  if (anomalyFilter.value) {
    result = result.filter(r => 
      r.anomalies?.some(a => a.type === anomalyFilter.value)
    )
  }

  return result
})

function formatMoney(value) {
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

function handleViewDetail(row) {
  currentRedemption.value = row
  detailDialogVisible.value = true
}

function showAnomalyDetail(anomaly) {
  currentAnomaly.value = anomaly
  anomalyDialogVisible.value = true
}

function handleSubmit(row) {
  const result = redemptionStore.submitRedemption(row.id, '当前用户')
  if (result.success) {
    ElMessage.success('提交成功')
  } else {
    ElMessage.error(result.message)
  }
}

function handleBuyerConfirm(row) {
  const result = redemptionStore.confirmByBuyer(row.id, '买方-采购经理')
  if (result.success) {
    ElMessage.success('买方确认成功')
  } else {
    ElMessage.error(result.message)
  }
}

function handleStartProcess(row) {
  const result = redemptionStore.startProcessing(row.id, '当前用户')
  if (result.success) {
    ElMessage.success('开始处理')
  } else {
    ElMessage.error(result.message)
  }
}

function handleComplete(row) {
  const result = redemptionStore.completeRedemption(row.id, '当前用户')
  if (result.success) {
    ElMessage.success('红冲完成，额度已回补')
  } else {
    ElMessage.error(result.message)
  }
}

function handleReject(row) {
  currentRejectItem.value = row
  rejectForm.value.reason = ''
  rejectDialogVisible.value = true
}

function confirmReject() {
  if (!rejectForm.value.reason) {
    ElMessage.warning('请输入拒绝原因')
    return
  }
  const result = redemptionStore.rejectRedemption(currentRejectItem.value.id, '当前用户', rejectForm.value.reason)
  if (result.success) {
    ElMessage.success('已拒绝')
    rejectDialogVisible.value = false
  } else {
    ElMessage.error(result.message)
  }
}
</script>

<style lang="scss" scoped>
.redemption {
  .filter-bar {
    margin-bottom: 16px;
    display: flex;
    align-items: center;
  }

  .reason-box {
    background: #f8f9fa;
    border-left: 4px solid #409eff;
    padding: 12px 16px;
    border-radius: 0 4px 4px 0;
    font-size: 14px;
    color: #606266;
  }
}
</style>
