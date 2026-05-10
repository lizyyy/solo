<template>
  <div class="approval-page">
    <el-card class="filter-card">
      <div class="filter-row">
        <el-form :inline="true" :model="filters" class="filter-form">
          <el-form-item label="状态">
            <el-select v-model="filters.status" placeholder="全部状态" clearable @change="loadRequests">
              <el-option label="待审批" value="pending" />
              <el-option label="已通过" value="approved" />
              <el-option label="已拒绝" value="rejected" />
            </el-select>
          </el-form-item>
          <el-form-item label="日期范围">
            <el-date-picker
              v-model="filters.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              @change="loadRequests"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadRequests">
              <el-icon><Search /></el-icon>
              查询
            </el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-card>

    <el-card>
      <template #header>
        <div class="card-header">
          <span>✅ 审批管理</span>
          <div class="header-actions">
            <el-button
              type="warning"
              @click="refresh"
            >
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
            <el-button
              type="success"
              @click="exportData"
            >
              <el-icon><Download /></el-icon>
              导出Excel
            </el-button>
          </div>
        </div>
      </template>

      <el-table
        :data="requests"
        stripe
        border
        v-loading="loading"
      >
        <el-table-column type="index" label="序号" width="60" />
        
        <el-table-column prop="employee_name" label="员工" width="100">
          <template #default="{ row }">
            <el-tag type="info">{{ row.employee_name }}</el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="门店信息" width="240">
          <template #default="{ row }">
            <div class="store-info">
              <div class="store-line">
                <span class="label">原:</span>
                <span class="value original">{{ row.original_store_name }}</span>
              </div>
              <div class="store-line">
                <span class="label">→</span>
                <span class="value transfer">{{ row.to_store_name }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="date" label="日期" width="110" />
        
        <el-table-column label="时间" width="140">
          <template #default="{ row }">
            <div class="time-cell">
              <span class="time-text">{{ row.start_time }}</span>
              <span class="time-arrow">→</span>
              <span class="time-text">{{ row.end_time }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="skill_name" label="技能" width="80">
          <template #default="{ row }">
            {{ row.skill_name || '-' }}
          </template>
        </el-table-column>
        
        <el-table-column prop="reason" label="借调原因" min-width="150" show-overflow-tooltip />
        
        <el-table-column label="补贴明细" width="180">
          <template #default="{ row }">
            <el-popover
              placement="top"
              :width="200"
              trigger="hover"
            >
              <template #reference>
                <div class="allowance-preview">
                  <el-tag type="success" effect="dark">¥{{ row.transport_allowance }}</el-tag>
                </div>
              </template>
              <div class="allowance-detail-popover">
                <p><strong>申请ID:</strong> #{{ row.id }}</p>
                <p><strong>员工:</strong> {{ row.employee_name }}</p>
                <p><strong>门店:</strong> {{ row.original_store_name }} → {{ row.to_store_name }}</p>
                <p><strong>日期:</strong> {{ row.date }}</p>
                <p><strong>时间:</strong> {{ row.start_time }} - {{ row.end_time }}</p>
                <el-divider />
                <p class="total">补贴总计: <strong>¥{{ row.transport_allowance }}</strong></p>
              </div>
            </el-popover>
          </template>
        </el-table-column>
        
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag
              :type="getStatusType(row.status)"
              effect="light"
            >
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="审批信息" width="150">
          <template #default="{ row }">
            <div v-if="row.approver" class="approval-info">
              <div class="approver">{{ row.approver }}</div>
              <div class="comment" v-if="row.approval_comment" :title="row.approval_comment">
                {{ row.approval_comment }}
              </div>
            </div>
            <span v-else class="pending-text">-</span>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button-group v-if="row.status === 'pending'">
              <el-button
                type="success"
                size="small"
                @click="handleApprove(row)"
              >
                <el-icon><Check /></el-icon>
                通过
              </el-button>
              <el-button
                type="danger"
                size="small"
                @click="handleReject(row)"
              >
                <el-icon><Close /></el-icon>
                拒绝
              </el-button>
            </el-button-group>
            <el-button
              v-else
              type="info"
              size="small"
              @click="viewDetail(row)"
            >
              <el-icon><View /></el-icon>
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="summary-bar" v-if="requests.length > 0">
        <div class="summary-item">
          <span class="label">申请总数:</span>
          <span class="value">{{ requests.length }}</span>
        </div>
        <div class="summary-item">
          <span class="label">待审批:</span>
          <span class="value pending">{{ requests.filter(r => r.status === 'pending').length }}</span>
        </div>
        <div class="summary-item">
          <span class="label">已通过:</span>
          <span class="value approved">{{ requests.filter(r => r.status === 'approved').length }}</span>
        </div>
        <div class="summary-item">
          <span class="label">已拒绝:</span>
          <span class="value rejected">{{ requests.filter(r => r.status === 'rejected').length }}</span>
        </div>
        <el-divider direction="vertical" />
        <div class="summary-item total">
          <span class="label">补贴总额:</span>
          <span class="value">¥{{ totalAllowance.toFixed(2) }}</span>
        </div>
      </div>
    </el-card>

    <el-dialog
      v-model="detailDialogVisible"
      title="申请详情"
      width="500px"
    >
      <el-descriptions v-if="selectedRequest" :column="1" border>
        <el-descriptions-item label="员工">
          <el-tag type="info">{{ selectedRequest.employee_name }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="原门店">
          {{ selectedRequest.original_store_name }}
        </el-descriptions-item>
        <el-descriptions-item label="借调门店">
          {{ selectedRequest.to_store_name }}
        </el-descriptions-item>
        <el-descriptions-item label="借调日期">
          {{ selectedRequest.date }}
        </el-descriptions-item>
        <el-descriptions-item label="借调时间">
          {{ selectedRequest.start_time }} - {{ selectedRequest.end_time }}
        </el-descriptions-item>
        <el-descriptions-item label="所需技能">
          {{ selectedRequest.skill_name || '无' }}
        </el-descriptions-item>
        <el-descriptions-item label="借调原因">
          {{ selectedRequest.reason }}
        </el-descriptions-item>
        <el-descriptions-item label="交通补贴">
          <el-tag type="success" effect="dark">¥{{ selectedRequest.transport_allowance }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(selectedRequest.status)">
            {{ getStatusText(selectedRequest.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="审批人" v-if="selectedRequest.approver">
          {{ selectedRequest.approver }}
        </el-descriptions-item>
        <el-descriptions-item label="审批意见" v-if="selectedRequest.approval_comment">
          {{ selectedRequest.approval_comment }}
        </el-descriptions-item>
        <el-descriptions-item label="申请时间">
          {{ selectedRequest.created_at }}
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog
      v-model="approveDialogVisible"
      title="审批申请"
      width="400px"
    >
      <el-form :model="approvalForm" label-width="80px">
        <el-form-item label="操作">
          <el-radio-group v-model="approvalForm.action">
            <el-radio value="approve" :border="true" class="radio-item">
              <span class="radio-icon success">✓</span> 通过
            </el-radio>
            <el-radio value="reject" :border="true" class="radio-item">
              <span class="radio-icon danger">✗</span> 拒绝
            </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="审批人">
          <el-input v-model="approvalForm.approver" placeholder="请输入审批人姓名" />
        </el-form-item>
        <el-form-item label="审批意见">
          <el-input
            v-model="approvalForm.comment"
            type="textarea"
            :rows="3"
            placeholder="请输入审批意见（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approveDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="approvalLoading" @click="submitApproval">
          确认
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Download, Check, Close, View } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { transferRequests as requestsApi, exportExcel as exportApi } from '../api'

const loading = ref(false)
const approvalLoading = ref(false)
const requests = ref([])
const selectedRequest = ref(null)
const detailDialogVisible = ref(false)
const approveDialogVisible = ref(false)

const filters = ref({
  status: null,
  dateRange: [
    dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
    dayjs().add(30, 'day').format('YYYY-MM-DD')
  ]
})

const approvalForm = ref({
  action: 'approve',
  approver: '',
  comment: ''
})

const totalAllowance = computed(() => {
  return requests.value.reduce((sum, r) => sum + (r.transport_allowance || 0), 0)
})

const getStatusType = (status) => {
  const map = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    pending: '待审批',
    approved: '已通过',
    rejected: '已拒绝'
  }
  return map[status] || status
}

const loadRequests = async () => {
  loading.value = true
  try {
    const params = {}
    if (filters.value.status) params.status = filters.value.status
    if (filters.value.dateRange && filters.value.dateRange.length === 2) {
      params.startDate = filters.value.dateRange[0]
      params.endDate = filters.value.dateRange[1]
    }
    
    const res = await requestsApi.getAll(params)
    requests.value = res.data.requests
  } catch (e) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

const refresh = () => {
  loadRequests()
  ElMessage.success('数据已刷新')
}

const resetFilters = () => {
  filters.value = {
    status: null,
    dateRange: [
      dayjs().subtract(7, 'day').format('YYYY-MM-DD'),
      dayjs().add(30, 'day').format('YYYY-MM-DD')
    ]
  }
  loadRequests()
}

const viewDetail = (row) => {
  selectedRequest.value = row
  detailDialogVisible.value = true
}

const handleApprove = (row) => {
  selectedRequest.value = row
  approvalForm.value = {
    action: 'approve',
    approver: '',
    comment: ''
  }
  approveDialogVisible.value = true
}

const handleReject = (row) => {
  selectedRequest.value = row
  approvalForm.value = {
    action: 'reject',
    approver: '',
    comment: ''
  }
  approveDialogVisible.value = true
}

const submitApproval = async () => {
  if (!approvalForm.value.approver) {
    ElMessage.warning('请输入审批人姓名')
    return
  }

  approvalLoading.value = true
  try {
    if (approvalForm.value.action === 'approve') {
      await requestsApi.approve(selectedRequest.value.id, {
        approver: approvalForm.value.approver,
        comment: approvalForm.value.comment
      })
      ElMessage.success('✅ 审批通过')
    } else {
      await requestsApi.reject(selectedRequest.value.id, {
        approver: approvalForm.value.approver,
        comment: approvalForm.value.comment
      })
      ElMessage.success('已拒绝申请')
    }
    
    approveDialogVisible.value = false
    await loadRequests()
  } catch (e) {
    if (e.response?.data?.errors) {
      ElMessage.error('审批失败: ' + e.response.data.errors.join('; '))
    } else {
      ElMessage.error('操作失败')
    }
  } finally {
    approvalLoading.value = false
  }
}

const exportData = () => {
  const params = {}
  if (filters.value.status) params.status = filters.value.status
  if (filters.value.dateRange && filters.value.dateRange.length === 2) {
    params.startDate = filters.value.dateRange[0]
    params.endDate = filters.value.dateRange[1]
  }
  exportApi.download(params)
  ElMessage.success('正在导出...')
}

onMounted(() => {
  loadRequests()
})
</script>

<style scoped>
.approval-page {
  max-width: 1600px;
  margin: 0 auto;
}

.filter-card {
  margin-bottom: 20px;
}

.filter-row {
  display: flex;
  justify-content: center;
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 16px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.store-info {
  padding: 4px 0;
}

.store-line {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 2px 0;
}

.store-line .label {
  width: 16px;
  color: #909399;
  font-size: 12px;
}

.store-line .value {
  font-weight: 500;
}

.store-line .value.original {
  color: #67c23a;
}

.store-line .value.transfer {
  color: #e6a23c;
}

.time-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}

.time-text {
  font-family: 'Courier New', monospace;
  font-weight: 600;
}

.time-arrow {
  color: #909399;
}

.allowance-preview {
  cursor: pointer;
}

.allowance-detail-popover {
  line-height: 1.8;
}

.allowance-detail-popover .total {
  text-align: center;
  font-size: 16px;
}

.approval-info {
  font-size: 12px;
}

.approval-info .approver {
  font-weight: 600;
  color: #303133;
}

.approval-info .comment {
  color: #606266;
  max-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pending-text {
  color: #c0c4cc;
}

.summary-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px;
  background: #f5f7fa;
  margin-top: 20px;
  border-radius: 4px;
}

.summary-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.summary-item .label {
  color: #606266;
}

.summary-item .value {
  font-size: 18px;
  font-weight: 700;
}

.summary-item .value.pending {
  color: #e6a23c;
}

.summary-item .value.approved {
  color: #67c23a;
}

.summary-item .value.rejected {
  color: #f56c6c;
}

.summary-item.total {
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
  padding: 8px 16px;
  border-radius: 4px;
}

.summary-item.total .label {
  color: rgba(255, 255, 255, 0.9);
}

.summary-item.total .value {
  color: white;
}

.radio-item {
  margin-right: 20px;
  padding: 10px 20px;
}

.radio-icon {
  display: inline-block;
  width: 20px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  border-radius: 50%;
  margin-right: 6px;
  font-weight: bold;
  color: white;
}

.radio-icon.success {
  background: #67c23a;
}

.radio-icon.danger {
  background: #f56c6c;
}
</style>
