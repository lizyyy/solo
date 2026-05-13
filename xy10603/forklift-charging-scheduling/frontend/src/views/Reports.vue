<template>
  <div class="reports-page">
    <el-card class="filter-card">
      <template #header>
        <div class="card-header">
          <span>历史记录查询</span>
          <div>
            <el-button type="primary" @click="loadReport">查询</el-button>
            <el-button type="success" @click="exportReport" :loading="exporting">
              <el-icon><Download /></el-icon>
              导出报告
            </el-button>
          </div>
        </div>
      </template>
      <el-form :inline="true" class="filter-form" :model="filters">
        <el-form-item label="责任人">
          <el-input v-model="filters.assignedOperator" placeholder="请输入责任人" clearable style="width: 150px" />
        </el-form-item>
        <el-form-item label="处理人">
          <el-input v-model="filters.handledBy" placeholder="请输入处理人" clearable style="width: 150px" />
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker
            v-model="filters.startTime"
            type="datetime"
            placeholder="选择开始时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DDTHH:mm:ss"
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker
            v-model="filters.endTime"
            type="datetime"
            placeholder="选择结束时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DDTHH:mm:ss"
            style="width: 200px"
          />
        </el-form-item>
      </el-form>
    </el-card>

    <el-tabs v-model="activeTab" style="margin-top: 20px;">
      <el-tab-pane label="任务记录" name="tasks">
        <el-card>
          <el-table :data="taskRecords" style="width: 100%">
            <el-table-column prop="taskCode" label="任务编号" width="160" />
            <el-table-column prop="batteryCode" label="电池编号" width="120" />
            <el-table-column prop="stationCode" label="充电桩" width="100" />
            <el-table-column prop="waveCode" label="波次编号" width="120" />
            <el-table-column prop="targetSoc" label="目标电量" width="100">
              <template #default="{ row }">{{ row.targetSoc }}%</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getTaskStatusType(row.status)" size="small">
                  {{ getTaskStatusName(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="priority" label="优先级" width="80">
              <template #default="{ row }">P{{ row.priority }}</template>
            </el-table-column>
            <el-table-column prop="assignedOperator" label="责任人" width="100" />
            <el-table-column prop="createdAt" label="创建时间" width="160" />
            <el-table-column prop="completedAt" label="完成时间" width="160" />
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button type="text" size="small" @click="viewTaskHistory(row)">变更</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
      <el-tab-pane label="异常处理记录" name="anomalies">
        <el-card>
          <el-table :data="anomalyRecords" style="width: 100%">
            <el-table-column prop="anomalyCode" label="异常编号" width="160" />
            <el-table-column prop="anomalyType" label="类型" width="140">
              <template #default="{ row }">{{ getTypeName(row.anomalyType) }}</template>
            </el-table-column>
            <el-table-column prop="severity" label="优先级" width="80">
              <template #default="{ row }">
                <el-tag :type="getSeverityType(row.severity)" size="small">
                  {{ getSeverityName(row.severity) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="title" label="标题" min-width="200" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'HANDLED' ? 'success' : 'warning'" size="small">
                  {{ row.status === 'HANDLED' ? '已处理' : '待处理' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="assignedTo" label="责任人" width="100" />
            <el-table-column prop="handledBy" label="处理人" width="100" />
            <el-table-column prop="createdAt" label="创建时间" width="160" />
            <el-table-column prop="handledAt" label="处理时间" width="160" />
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="historyDialogVisible" title="任务变更历史" width="700px">
      <el-table :data="taskHistory" style="width: 100%">
        <el-table-column prop="fieldName" label="字段" width="120">
          <template #default="{ row }">{{ getFieldName(row.fieldName) }}</template>
        </el-table-column>
        <el-table-column prop="oldValue" label="修改前" min-width="180" />
        <el-table-column prop="newValue" label="修改后" min-width="180" />
        <el-table-column prop="operation" label="操作类型" width="100" />
        <el-table-column prop="operator" label="操作人" width="100" />
        <el-table-column prop="createdAt" label="时间" width="160" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'

const activeTab = ref('tasks')
const exporting = ref(false)
const taskRecords = ref([])
const anomalyRecords = ref([])
const historyDialogVisible = ref(false)
const taskHistory = ref([])

const filters = ref({
  assignedOperator: '',
  handledBy: '',
  startTime: '',
  endTime: ''
})

const getTaskStatusType = (status) => {
  const map = {
    'PENDING': 'info',
    'ASSIGNED': 'warning',
    'CHARGING': 'primary',
    'COMPLETED': 'success',
    'CANCELLED': 'danger'
  }
  return map[status] || 'info'
}

const getTaskStatusName = (status) => {
  const map = {
    'PENDING': '待分配',
    'ASSIGNED': '已分配',
    'CHARGING': '充电中',
    'COMPLETED': '已完成',
    'CANCELLED': '已取消'
  }
  return map[status] || status
}

const getSeverityType = (severity) => {
  const map = { 'HIGH': 'danger', 'MEDIUM': 'warning', 'LOW': 'info' }
  return map[severity] || 'info'
}

const getSeverityName = (severity) => {
  const map = { 'HIGH': '高', 'MEDIUM': '中', 'LOW': '低' }
  return map[severity] || severity
}

const getTypeName = (type) => {
  const map = {
    'STATION_FAULT': '充电桩故障',
    'BATTERY_HEALTH': '电池健康异常',
    'LOW_BATTERY': '低电量报警',
    'WAVE_CONFLICT': '波次冲突'
  }
  return map[type] || type
}

const getFieldName = (field) => {
  const map = {
    'status': '状态',
    'priority': '优先级',
    'stationId': '充电桩',
    'targetSoc': '目标电量',
    'assignedOperator': '责任人'
  }
  return map[field] || field
}

const loadReport = async () => {
  const params = {}
  if (filters.value.assignedOperator) params.assignedOperator = filters.value.assignedOperator
  if (filters.value.handledBy) params.handledBy = filters.value.handledBy
  if (filters.value.startTime) params.startTime = filters.value.startTime
  if (filters.value.endTime) params.endTime = filters.value.endTime
  
  const tasksRes = await request.get('/reports/charge-history', { params })
  taskRecords.value = tasksRes.data || []
  
  const anomaliesRes = await request.get('/anomalies')
  anomalyRecords.value = anomaliesRes.data || []
}

const exportReport = async () => {
  exporting.value = true
  try {
    const params = {}
    if (filters.value.assignedOperator) params.assignedOperator = filters.value.assignedOperator
    if (filters.value.handledBy) params.handledBy = filters.value.handledBy
    if (filters.value.startTime) params.startTime = filters.value.startTime
    if (filters.value.endTime) params.endTime = filters.value.endTime
    
    const response = await request.get('/reports/export', {
      params,
      responseType: 'blob'
    })
    
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `充电报告_${new Date().toISOString().slice(0, 10)}.xlsx`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    ElMessage.success('导出成功')
  } catch (e) {
    ElMessage.error('导出失败: ' + (e.message || '未知错误'))
  } finally {
    exporting.value = false
  }
}

const viewTaskHistory = async (task) => {
  const res = await request.get(`/history/ChargingTask/${task.id}`)
  taskHistory.value = res.data || []
  historyDialogVisible.value = true
}

onMounted(() => {
  loadReport()
})
</script>

<style scoped>
.reports-page {
  min-height: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-card {
  margin-bottom: 20px;
}
</style>
