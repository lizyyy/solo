<template>
  <div class="history-page">
    <el-card class="filter-card">
      <el-form :inline="true" class="filter-form" :model="filters">
        <el-form-item label="实体类型">
          <el-select v-model="filters.entityType" placeholder="全部类型" clearable style="width: 180px" @change="loadHistory">
            <el-option label="充电桩" value="ChargingStation" />
            <el-option label="电池" value="Battery" />
            <el-option label="作业波次" value="WorkWave" />
            <el-option label="充电任务" value="ChargingTask" />
            <el-option label="异常记录" value="AnomalyRecord" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作人">
          <el-input v-model="filters.operator" placeholder="请输入操作人" clearable style="width: 150px" />
        </el-form-item>
        <el-form-item label="时间段">
          <el-date-picker
            v-model="filters.timeRange"
            type="datetimerange"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            format="YYYY-MM-DD HH:mm"
            value-format="YYYY-MM-DDTHH:mm:ss"
            style="width: 380px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadHistory">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="summary-card">
      <el-row :gutter="20">
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">充电桩变更</div>
            <div class="stat-value">{{ stationCount }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">电池变更</div>
            <div class="stat-value">{{ batteryCount }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">波次变更</div>
            <div class="stat-value">{{ waveCount }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-item">
            <div class="stat-label">任务变更</div>
            <div class="stat-value">{{ taskCount }}</div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card style="margin-top: 20px;">
      <el-table :data="historyRecords" style="width: 100%">
        <el-table-column prop="entityType" label="实体类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getEntityColor(row.entityType)" size="small">
              {{ getEntityName(row.entityType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="entityId" label="实体ID" width="80" />
        <el-table-column prop="fieldName" label="变更字段" width="120">
          <template #default="{ row }">{{ getFieldDisplayName(row.entityType, row.fieldName) }}</template>
        </el-table-column>
        <el-table-column prop="oldValue" label="修改前" min-width="180">
          <template #default="{ row }">
            <span v-if="row.oldValue !== null && row.oldValue !== undefined" :class="['value-cell', 'old-value']">
              {{ formatValue(row.oldValue, row.fieldName) }}
            </span>
            <span v-else class="value-cell empty">无</span>
          </template>
        </el-table-column>
        <el-table-column prop="newValue" label="修改后" min-width="180">
          <template #default="{ row }">
            <span v-if="row.newValue !== null && row.newValue !== undefined" :class="['value-cell', 'new-value']">
              {{ formatValue(row.newValue, row.fieldName) }}
            </span>
            <span v-else class="value-cell empty">无</span>
          </template>
        </el-table-column>
        <el-table-column prop="operation" label="操作" width="100">
          <template #default="{ row }">
            <el-tag :type="getOperationColor(row.operation)" size="small">
              {{ getOperationName(row.operation) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="100" />
        <el-table-column prop="remarks" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="变更时间" width="160" />
      </el-table>
    </el-card>

    <el-dialog v-model="detailDialogVisible" title="变更详情" width="600px">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="实体类型">
          <el-tag :type="getEntityColor(currentRecord?.entityType)" size="small">
            {{ getEntityName(currentRecord?.entityType) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="实体ID">{{ currentRecord?.entityId }}</el-descriptions-item>
        <el-descriptions-item label="变更字段">
          {{ getFieldDisplayName(currentRecord?.entityType, currentRecord?.fieldName) }}
        </el-descriptions-item>
        <el-descriptions-item label="修改前">
          <span v-if="currentRecord?.oldValue !== null && currentRecord?.oldValue !== undefined" class="old-value">
            {{ currentRecord?.oldValue }}
          </span>
          <span v-else style="color: #909399">无</span>
        </el-descriptions-item>
        <el-descriptions-item label="修改后">
          <span v-if="currentRecord?.newValue !== null && currentRecord?.newValue !== undefined" class="new-value">
            {{ currentRecord?.newValue }}
          </span>
          <span v-else style="color: #909399">无</span>
        </el-descriptions-item>
        <el-descriptions-item label="操作类型">
          <el-tag :type="getOperationColor(currentRecord?.operation)" size="small">
            {{ getOperationName(currentRecord?.operation) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="操作人">{{ currentRecord?.operator || '系统' }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ currentRecord?.remarks || '-' }}</el-descriptions-item>
        <el-descriptions-item label="变更时间">{{ currentRecord?.createdAt }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'

const filters = ref({
  entityType: '',
  operator: '',
  timeRange: []
})
const historyRecords = ref([])
const detailDialogVisible = ref(false)
const currentRecord = ref(null)

const stationCount = computed(() => historyRecords.value.filter(h => h.entityType === 'ChargingStation').length)
const batteryCount = computed(() => historyRecords.value.filter(h => h.entityType === 'Battery').length)
const waveCount = computed(() => historyRecords.value.filter(h => h.entityType === 'WorkWave').length)
const taskCount = computed(() => historyRecords.value.filter(h => h.entityType === 'ChargingTask').length)

const getEntityName = (type) => {
  const map = {
    'ChargingStation': '充电桩',
    'Battery': '电池',
    'WorkWave': '作业波次',
    'ChargingTask': '充电任务',
    'AnomalyRecord': '异常记录'
  }
  return map[type] || type
}

const getEntityColor = (type) => {
  const map = {
    'ChargingStation': 'primary',
    'Battery': 'success',
    'WorkWave': 'warning',
    'ChargingTask': 'info',
    'AnomalyRecord': 'danger'
  }
  return map[type] || 'info'
}

const getOperationName = (op) => {
  const map = {
    'CREATE': '创建',
    'UPDATE': '更新',
    'DELETE': '删除',
    'ASSIGN': '分配',
    'CANCEL': '取消',
    'COMPLETE': '完成',
    'MANUAL': '人工调整'
  }
  return map[op] || op
}

const getOperationColor = (op) => {
  const map = {
    'CREATE': 'success',
    'UPDATE': 'warning',
    'DELETE': 'danger',
    'ASSIGN': 'primary',
    'CANCEL': 'info',
    'COMPLETE': 'success',
    'MANUAL': 'danger'
  }
  return map[op] || 'info'
}

const getFieldDisplayName = (entityType, fieldName) => {
  const fieldMaps = {
    'ChargingStation': {
      'status': '状态',
      'isFaulty': '故障状态',
      'currentTaskId': '当前任务',
      'lastMaintenanceDate': '上次维护时间'
    },
    'Battery': {
      'healthStatus': '健康状态',
      'healthScore': '健康分数',
      'soc': '当前电量',
      'forkliftCode': '关联叉车'
    },
    'WorkWave': {
      'status': '状态',
      'startTime': '开始时间',
      'endTime': '结束时间',
      'priority': '优先级',
      'forkliftsRequired': '需求叉车数'
    },
    'ChargingTask': {
      'status': '状态',
      'priority': '优先级',
      'stationId': '充电桩',
      'targetSoc': '目标电量',
      'assignedOperator': '责任人'
    }
  }
  const map = fieldMaps[entityType] || {}
  return map[fieldName] || fieldName
}

const formatValue = (value, fieldName) => {
  if (fieldName === 'status' || fieldName === 'healthStatus') {
    const statusMaps = {
      'AVAILABLE': '可用', 'OCCUPIED': '占用', 'FAULTY': '故障',
      'GOOD': '良好', 'WARNING': '预警', 'REPLACE': '需更换',
      'PENDING': '待分配', 'ASSIGNED': '已分配', 'CHARGING': '充电中',
      'COMPLETED': '已完成', 'CANCELLED': '已取消',
      'PLANNED': '计划中', 'ACTIVE': '进行中', 'FINISHED': '已完成', 'CANCELLED': '已取消'
    }
    return statusMaps[value] || value
  }
  if (fieldName === 'isFaulty') {
    return value === 'true' || value === true ? '是' : '否'
  }
  if (fieldName === 'soc' || fieldName === 'targetSoc' || fieldName === 'healthScore') {
    return value + '%'
  }
  return value
}

const loadHistory = async () => {
  try {
    let res
    if (filters.value.entityType) {
      res = await request.get(`/history/${filters.value.entityType}`)
    } else {
      res = await request.get('/history')
    }
    let data = res.data || []
    
    if (filters.value.operator) {
      data = data.filter(h => (h.operator || '').includes(filters.value.operator))
    }
    
    if (filters.value.timeRange && filters.value.timeRange.length === 2) {
      const start = new Date(filters.value.timeRange[0]).getTime()
      const end = new Date(filters.value.timeRange[1]).getTime()
      data = data.filter(h => {
        const t = new Date(h.createdAt).getTime()
        return t >= start && t <= end
      })
    }
    
    historyRecords.value = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  } catch (e) {
    ElMessage.error('加载失败: ' + (e.message || '未知错误'))
  }
}

const viewDetail = (record) => {
  currentRecord.value = record
  detailDialogVisible.value = true
}

onMounted(() => {
  loadHistory()
})
</script>

<style scoped>
.history-page {
  min-height: 100%;
}

.filter-card {
  margin-bottom: 20px;
}

.summary-card {
  margin-bottom: 20px;
}

.stat-item {
  text-align: center;
  padding: 10px;
  background: #F5F7FA;
  border-radius: 8px;
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 5px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #409EFF;
}

.value-cell {
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.old-value {
  background: #FEF0F0;
  color: #F56C6C;
  text-decoration: line-through;
}

.new-value {
  background: #F0F9EB;
  color: #67C23A;
  font-weight: bold;
}

.empty {
  color: #909399;
  font-style: italic;
}
</style>
