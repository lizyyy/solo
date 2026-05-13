<template>
  <div class="stations-page">
    <el-card class="filter-card">
      <el-form :inline="true" class="filter-form">
        <el-form-item>
          <el-button type="primary" @click="createDialogVisible = true">新增充电桩</el-button>
          <el-button @click="loadStations">刷新</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-row :gutter="20">
      <el-col :span="8" v-for="station in stations" :key="station.id">
        <el-card class="station-card" :body-style="{ padding: '20px' }">
          <div class="station-header">
            <div class="station-title">
              <el-icon :size="24"><Connection /></el-icon>
              <span class="station-code">{{ station.stationCode }}</span>
            </div>
            <el-tag :type="getStatusType(station.status)" size="large">
              {{ getStatusName(station.status) }}
            </el-tag>
          </div>
          <div class="station-info">
            <div class="info-row">
              <span class="label">名称:</span>
              <span>{{ station.stationName }}</span>
            </div>
            <div class="info-row">
              <span class="label">位置:</span>
              <span>{{ station.location }}</span>
            </div>
            <div class="info-row">
              <span class="label">功率:</span>
              <span>{{ station.maxPower }} kW</span>
            </div>
            <div class="info-row">
              <span class="label">健康:</span>
              <el-progress :percentage="station.healthScore" :stroke-width="10" :color="getHealthColor(station.healthScore)" />
            </div>
            <div class="info-row" v-if="station.lastMaintenanceTime">
              <span class="label">维护时间:</span>
              <span>{{ station.lastMaintenanceTime }}</span>
            </div>
          </div>
          <div class="station-actions">
            <el-button type="text" size="small" @click="viewHistory(station)">变更记录</el-button>
            <el-button v-if="station.status !== 'FAULTY'" type="text" size="small" style="color: #E6A23C" @click="markFaulty(station)">标记故障</el-button>
            <el-button type="text" size="small" @click="editStation(station)">编辑</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="createDialogVisible" title="新增充电桩" width="500px">
      <el-form :model="newStation" label-width="100px">
        <el-form-item label="编号" required>
          <el-input v-model="newStation.stationCode" placeholder="如 CS-001" />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="newStation.stationName" placeholder="充电桩名称" />
        </el-form-item>
        <el-form-item label="位置">
          <el-input v-model="newStation.location" placeholder="位置描述" />
        </el-form-item>
        <el-form-item label="功率" required>
          <el-input-number v-model="newStation.maxPower" :min="10" :max="200" :step="10" />
          <span style="margin-left: 10px;">kW</span>
        </el-form-item>
        <el-form-item label="健康分数">
          <el-slider v-model="newStation.healthScore" :min="0" :max="100" show-input />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editDialogVisible" title="编辑充电桩" width="500px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="编号">
          <span>{{ editForm.stationCode }}</span>
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="editForm.stationName" />
        </el-form-item>
        <el-form-item label="位置">
          <el-input v-model="editForm.location" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="editForm.status">
            <el-option label="可用" value="AVAILABLE" />
            <el-option label="占用" value="OCCUPIED" />
            <el-option label="故障" value="FAULTY" />
          </el-select>
        </el-form-item>
        <el-form-item label="健康分数">
          <el-slider v-model="editForm.healthScore" :min="0" :max="100" show-input />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="faultyDialogVisible" title="标记故障" width="400px">
      <el-form label-width="100px">
        <el-form-item label="充电桩">
          <span>{{ currentStation?.stationCode }} - {{ currentStation?.stationName }}</span>
        </el-form-item>
        <el-form-item label="故障原因" required>
          <el-input type="textarea" v-model="faultyReason" :rows="3" placeholder="请说明故障原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="faultyDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="submitFaulty">确认标记</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="historyDialogVisible" title="变更历史" width="700px">
      <el-table :data="historyData" style="width: 100%">
        <el-table-column prop="fieldName" label="字段" width="120" />
        <el-table-column prop="oldValue" label="修改前" min-width="150" />
        <el-table-column prop="newValue" label="修改后" min-width="150" />
        <el-table-column prop="operation" label="操作" width="120" />
        <el-table-column prop="operator" label="操作人" width="100" />
        <el-table-column prop="remarks" label="备注" min-width="150" />
        <el-table-column prop="createdAt" label="时间" width="160" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/utils/request'

const stations = ref([])
const createDialogVisible = ref(false)
const editDialogVisible = ref(false)
const faultyDialogVisible = ref(false)
const historyDialogVisible = ref(false)

const newStation = ref({
  stationCode: '',
  stationName: '',
  location: '',
  maxPower: 60,
  healthScore: 100
})

const editForm = ref({})
const currentStation = ref(null)
const faultyReason = ref('')
const historyData = ref([])

const getStatusType = (status) => {
  const map = {
    'AVAILABLE': 'success',
    'OCCUPIED': 'primary',
    'FAULTY': 'danger'
  }
  return map[status] || 'info'
}

const getStatusName = (status) => {
  const map = {
    'AVAILABLE': '可用',
    'OCCUPIED': '占用',
    'FAULTY': '故障'
  }
  return map[status] || status
}

const getHealthColor = (score) => {
  if (score >= 80) return '#67C23A'
  if (score >= 60) return '#E6A23C'
  return '#F56C6C'
}

const loadStations = async () => {
  const res = await request.get('/stations')
  stations.value = res.data || []
}

const submitCreate = async () => {
  if (!newStation.value.stationCode || !newStation.value.stationName) {
    ElMessage.warning('请填写必填项')
    return
  }
  await request.post('/stations', { ...newStation.value, status: 'AVAILABLE' })
  ElMessage.success('创建成功')
  createDialogVisible.value = false
  newStation.value = { stationCode: '', stationName: '', location: '', maxPower: 60, healthScore: 100 }
  await loadStations()
}

const editStation = (station) => {
  editForm.value = { ...station }
  editDialogVisible.value = true
}

const submitEdit = async () => {
  await request.put(`/stations/${editForm.value.id}`, editForm.value)
  ElMessage.success('更新成功')
  editDialogVisible.value = false
  await loadStations()
}

const markFaulty = (station) => {
  currentStation.value = station
  faultyReason.value = ''
  faultyDialogVisible.value = true
}

const submitFaulty = async () => {
  if (!faultyReason.value.trim()) {
    ElMessage.warning('请说明故障原因')
    return
  }
  await ElMessageBox.confirm('确认标记该充电桩为故障状态？', '提示', { type: 'warning' })
  await request.post(`/stations/${currentStation.value.id}/mark-faulty`, null, {
    params: { reason: faultyReason.value }
  })
  ElMessage.success('已标记为故障')
  faultyDialogVisible.value = false
  await loadStations()
}

const viewHistory = async (station) => {
  const res = await request.get(`/reports/change-history/entity/CHARGING_STATION/${station.id}`)
  historyData.value = res.data || []
  historyDialogVisible.value = true
}

onMounted(() => {
  loadStations()
})
</script>

<style scoped>
.stations-page {
  min-height: 100%;
}

.filter-card {
  margin-bottom: 20px;
}

.station-card {
  margin-bottom: 20px;
}

.station-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.station-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.station-code {
  font-size: 18px;
  font-weight: bold;
  color: #303133;
}

.station-info {
  margin-top: 15px;
}

.info-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  
  .label {
    width: 70px;
    color: #909399;
    flex-shrink: 0;
  }
  
  .el-progress {
    flex: 1;
  }
}

.station-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #EBEEF5;
}
</style>
