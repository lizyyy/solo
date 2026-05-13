<template>
  <div class="anomalies-page">
    <el-card class="filter-card">
      <el-form :inline="true" class="filter-form">
        <el-form-item label="状态">
          <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width: 140px" @change="loadAnomalies">
            <el-option label="待处理" value="PENDING" />
            <el-option label="已处理" value="HANDLED" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="typeFilter" placeholder="全部类型" clearable style="width: 160px" @change="loadAnomalies">
            <el-option label="充电桩故障" value="STATION_FAULT" />
            <el-option label="电池健康异常" value="BATTERY_HEALTH" />
            <el-option label="低电量报警" value="LOW_BATTERY" />
            <el-option label="波次冲突" value="WAVE_CONFLICT" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button @click="loadAnomalies">刷新</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card style="margin-top: 20px;">
      <el-table :data="anomalies" style="width: 100%">
        <el-table-column prop="severity" label="优先级" width="100">
          <template #default="{ row }">
            <el-tag :type="getSeverityType(row.severity)" size="large">
              {{ getSeverityName(row.severity) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="anomalyType" label="类型" width="140">
          <template #default="{ row }">
            {{ getTypeName(row.anomalyType) }}
          </template>
        </el-table-column>
        <el-table-column prop="anomalyCode" label="异常编号" width="160" />
        <el-table-column prop="title" label="标题" min-width="200" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'PENDING' ? 'warning' : 'success'" size="small">
              {{ row.status === 'PENDING' ? '待处理' : '已处理' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="assignedTo" label="处理人" width="100" />
        <el-table-column prop="handledBy" label="已处理人" width="100" />
        <el-table-column prop="createdAt" label="创建时间" width="160" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="text" size="small" @click="viewDetail(row)">详情</el-button>
            <el-button v-if="row.status === 'PENDING'" type="text" size="small" @click="assignAnomaly(row)">分配</el-button>
            <el-button v-if="row.status === 'PENDING'" type="text" size="small" @click="handleAnomaly(row)">处理</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="detailDialogVisible" title="异常详情" width="600px">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="异常编号">{{ currentAnomaly?.anomalyCode }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ getTypeName(currentAnomaly?.anomalyType) }}</el-descriptions-item>
        <el-descriptions-item label="优先级">
          <el-tag :type="getSeverityType(currentAnomaly?.severity)">
            {{ getSeverityName(currentAnomaly?.severity) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="标题">{{ currentAnomaly?.title }}</el-descriptions-item>
        <el-descriptions-item label="描述">{{ currentAnomaly?.description }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="currentAnomaly?.status === 'PENDING' ? 'warning' : 'success'">
            {{ currentAnomaly?.status === 'PENDING' ? '待处理' : '已处理' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="分配人">{{ currentAnomaly?.assignedTo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="处理人">{{ currentAnomaly?.handledBy || '-' }}</el-descriptions-item>
        <el-descriptions-item label="处理时间">{{ currentAnomaly?.handledAt || '-' }}</el-descriptions-item>
        <el-descriptions-item label="处理备注">{{ currentAnomaly?.handlingNotes || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ currentAnomaly?.createdAt }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog v-model="assignDialogVisible" title="分配异常" width="400px">
      <el-form label-width="80px">
        <el-form-item label="异常">
          <span>{{ currentAnomaly?.title }}</span>
        </el-form-item>
        <el-form-item label="分配给" required>
          <el-input v-model="assignee" placeholder="请输入处理人" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAssign">确认分配</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="handleDialogVisible" title="处理异常" width="500px">
      <el-form label-width="80px">
        <el-form-item label="异常">
          <span>{{ currentAnomaly?.title }}</span>
        </el-form-item>
        <el-form-item label="处理备注" required>
          <el-input type="textarea" v-model="handleNotes" :rows="4" placeholder="请输入处理说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="handleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitHandle">确认处理</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'

const anomalies = ref([])
const statusFilter = ref('')
const typeFilter = ref('')

const detailDialogVisible = ref(false)
const assignDialogVisible = ref(false)
const handleDialogVisible = ref(false)
const currentAnomaly = ref(null)
const assignee = ref('')
const handleNotes = ref('')

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

const loadAnomalies = async () => {
  let res
  if (statusFilter.value === 'PENDING') {
    res = await request.get('/anomalies/pending')
  } else if (typeFilter.value) {
    res = await request.get(`/anomalies/type/${typeFilter.value}`)
  } else {
    res = await request.get('/anomalies')
  }
  anomalies.value = res.data || []
  
  if (statusFilter.value && statusFilter.value !== 'PENDING') {
    anomalies.value = anomalies.value.filter(a => a.status === statusFilter.value)
  }
}

const viewDetail = (anomaly) => {
  currentAnomaly.value = anomaly
  detailDialogVisible.value = true
}

const assignAnomaly = (anomaly) => {
  currentAnomaly.value = anomaly
  assignee.value = ''
  assignDialogVisible.value = true
}

const submitAssign = async () => {
  if (!assignee.value.trim()) {
    ElMessage.warning('请输入处理人')
    return
  }
  await request.post(`/anomalies/${currentAnomaly.value.id}/assign`, null, {
    params: { assignee: assignee.value }
  })
  ElMessage.success('分配成功')
  assignDialogVisible.value = false
  await loadAnomalies()
}

const handleAnomaly = (anomaly) => {
  currentAnomaly.value = anomaly
  handleNotes.value = ''
  handleDialogVisible.value = true
}

const submitHandle = async () => {
  if (!handleNotes.value.trim()) {
    ElMessage.warning('请输入处理备注')
    return
  }
  await request.post(`/anomalies/${currentAnomaly.value.id}/handle`, null, {
    params: { notes: handleNotes.value }
  })
  ElMessage.success('处理成功')
  handleDialogVisible.value = false
  await loadAnomalies()
}

onMounted(() => {
  loadAnomalies()
})
</script>

<style scoped>
.anomalies-page {
  min-height: 100%;
}

.filter-card {
  margin-bottom: 20px;
}
</style>
