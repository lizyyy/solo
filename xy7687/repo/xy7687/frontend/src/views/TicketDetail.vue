<template>
  <div class="detail-container">
    <el-card shadow="never" class="detail-card">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <el-button :icon="ArrowLeft" text @click="goBack">返回</el-button>
            <span class="ticket-no">工单: {{ ticket.ticket_no }}</span>
            <el-tag :type="getStatusTagType(ticket.status)" size="large">
              {{ ticket.statusLabel }}
            </el-tag>
          </div>
          <div class="header-right">
            <el-button
              v-if="ticket.status !== 'completed' && ticket.status !== 'cancelled'"
              type="primary"
              :icon="Edit"
              @click="editTicket"
            >
              编辑工单
            </el-button>
          </div>
        </div>
      </template>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="客户姓名">
          <span class="highlight">{{ ticket.customer_name }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="联系电话">
          <span class="highlight">{{ ticket.customer_phone }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="设备型号">
          <span class="highlight">{{ ticket.device_model }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="报价金额">
          <span class="price" v-if="ticket.quote_amount > 0">¥{{ ticket.quote_amount }}</span>
          <span class="text-muted" v-else>未报价</span>
        </el-descriptions-item>
        <el-descriptions-item label="维修配件">
          {{ ticket.repair_parts || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="预计取机时间">
          {{ ticket.estimated_pickup_time || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="故障描述" :span="2">
          {{ ticket.fault_description || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">
          {{ ticket.notes || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ ticket.created_at }}
        </el-descriptions-item>
        <el-descriptions-item label="更新时间">
          {{ ticket.updated_at }}
        </el-descriptions-item>
      </el-descriptions>

      <el-divider content-position="left">状态流转</el-divider>

      <div class="status-transition">
        <div class="current-status-info">
          <span class="label">当前状态:</span>
          <el-tag :type="getStatusTagType(ticket.status)" size="large">
            {{ ticket.statusLabel }}
          </el-tag>
        </div>
        
        <div class="transition-buttons" v-if="ticket.nextStatuses && ticket.nextStatuses.length > 0">
          <span class="label">可流转到:</span>
          <div class="buttons">
            <template v-for="nextStatus in ticket.nextStatuses" :key="nextStatus.value">
              <el-tooltip
                :disabled="!isTransitionDisabled(ticket.status, nextStatus.value)"
                :content="getTransitionDisabledReason(ticket.status, nextStatus.value)"
                placement="top"
              >
                <el-button
                  :type="nextStatus.value === 'cancelled' ? 'danger' : 'primary'"
                  :icon="getTransitionIcon(nextStatus.value)"
                  :disabled="isTransitionDisabled(ticket.status, nextStatus.value)"
                  @click="handleTransition(nextStatus.value)"
                >
                  {{ nextStatus.label }}
                </el-button>
              </el-tooltip>
            </template>
          </div>
        </div>
        
        <div class="no-transition" v-else>
          <el-alert
            :title="ticket.status === 'completed' ? '工单已完成，无法继续流转' : '工单已取消，无法继续流转'"
            :type="ticket.status === 'completed' ? 'success' : 'info'"
            :closable="false"
            show-icon
          />
        </div>
      </div>

      <el-divider content-position="left">操作记录</el-divider>

      <el-timeline>
        <el-timeline-item
          v-for="log in ticket.statusLogs"
          :key="log.id"
          :type="getStatusTimelineType(log.to_status)"
          :timestamp="log.created_at"
          placement="top"
        >
          <el-card shadow="hover">
            <div class="log-item">
              <div class="log-status">
                <el-tag :type="getStatusTagType(log.to_status)" size="small">
                  {{ log.toStatusLabel }}
                </el-tag>
                <span class="log-arrow" v-if="log.from_status">
                  ← {{ log.fromStatusLabel }}
                </span>
              </div>
              <div class="log-reason">{{ log.reason }}</div>
              <div class="log-operator">操作人: {{ log.operator }}</div>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Edit, Search, Tools, Box, Check, Close } from '@element-plus/icons-vue'
import { ticketApi } from '../api'

const route = useRoute()
const router = useRouter()
const ticket = ref({
  statusLogs: []
})

const STATUS_INFO = {
  pending_inspection: { canTransition: ['quoting', 'cancelled'] },
  quoting: { canTransition: ['repairing', 'cancelled'] },
  repairing: { canTransition: ['pending_pickup', 'cancelled'] },
  pending_pickup: { canTransition: ['completed', 'cancelled'] },
  completed: { canTransition: [] },
  cancelled: { canTransition: [] }
}

const loadTicket = async () => {
  const id = route.params.id
  if (!id) return
  
  try {
    const res = await ticketApi.getDetail(id)
    ticket.value = res.data
  } catch (error) {
    console.error('加载工单详情失败:', error)
  }
}

const getStatusTagType = (status) => {
  const typeMap = {
    pending_inspection: 'warning',
    quoting: 'primary',
    repairing: 'danger',
    pending_pickup: 'info',
    completed: 'success',
    cancelled: 'info'
  }
  return typeMap[status] || 'info'
}

const getStatusTimelineType = (status) => {
  const typeMap = {
    pending_inspection: 'warning',
    quoting: 'primary',
    repairing: 'danger',
    pending_pickup: '',
    completed: 'success',
    cancelled: 'info'
  }
  return typeMap[status] || ''
}

const getTransitionIcon = (status) => {
  const iconMap = {
    quoting: Search,
    repairing: Tools,
    pending_pickup: Box,
    completed: Check,
    cancelled: Close
  }
  return iconMap[status]
}

const isTransitionDisabled = (fromStatus, toStatus) => {
  if (fromStatus === 'completed' || fromStatus === 'cancelled') {
    return true
  }
  const info = STATUS_INFO[fromStatus]
  if (!info || !info.canTransition.includes(toStatus)) {
    return true
  }
  return false
}

const getTransitionDisabledReason = (fromStatus, toStatus) => {
  if (fromStatus === 'completed') {
    return '工单已完成，无法修改状态'
  }
  if (fromStatus === 'cancelled') {
    return '工单已取消，无法修改状态'
  }
  
  const info = STATUS_INFO[fromStatus]
  if (!info || !info.canTransition.includes(toStatus)) {
    if (info && info.canTransition.length === 0) {
      return `当前状态无法继续流转`
    }
    const validLabels = []
    const labelMap = {
      quoting: '报价中',
      repairing: '维修中',
      pending_pickup: '待取机',
      completed: '已完成',
      cancelled: '已取消'
    }
    if (info) {
      info.canTransition.forEach(s => {
        validLabels.push(labelMap[s] || s)
      })
    }
    return `只能流转到：${validLabels.join('、')}`
  }
  return null
}

const handleTransition = async (targetStatus) => {
  try {
    let confirmMessage = ''
    const statusLabels = {
      quoting: '报价中',
      repairing: '维修中',
      pending_pickup: '待取机',
      completed: '已完成',
      cancelled: '已取消'
    }
    
    if (targetStatus === 'cancelled') {
      confirmMessage = `确定要取消此工单吗？取消后将无法恢复。`
    } else if (targetStatus === 'completed') {
      confirmMessage = `确定要将工单标记为已完成吗？完成后将无法修改。`
    } else {
      confirmMessage = `确定要将工单状态从"${ticket.value.statusLabel}"变更为"${statusLabels[targetStatus]}"吗？`
    }

    await ElMessageBox.confirm(confirmMessage, '确认状态变更', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: targetStatus === 'cancelled' ? 'warning' : 'info'
    })

    const res = await ticketApi.transition(ticket.value.id, targetStatus)
    ElMessage.success(res.message || '状态更新成功')
    loadTicket()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('状态流转失败:', error)
    }
  }
}

const goBack = () => {
  router.push('/')
}

const editTicket = () => {
  router.push(`/ticket/edit/${ticket.value.id}`)
}

onMounted(() => {
  loadTicket()
})
</script>

<style scoped>
.detail-container {
  max-width: 1000px;
  margin: 0 auto;
}

.detail-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ticket-no {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.highlight {
  font-weight: 600;
  color: #303133;
}

.price {
  font-size: 18px;
  font-weight: 600;
  color: #f56c6c;
}

.text-muted {
  color: #909399;
}

.status-transition {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 20px;
}

.current-status-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.current-status-info .label {
  color: #606266;
  font-weight: 500;
}

.transition-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.transition-buttons .label {
  color: #606266;
}

.transition-buttons .buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.no-transition {
  margin-top: 12px;
}

.log-item {
  padding: 4px 0;
}

.log-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.log-arrow {
  font-size: 12px;
  color: #909399;
}

.log-reason {
  color: #303133;
  font-size: 14px;
  margin-bottom: 4px;
}

.log-operator {
  font-size: 12px;
  color: #909399;
}

:deep(.el-timeline-item__tail) {
  border-left-style: dashed;
}
</style>
