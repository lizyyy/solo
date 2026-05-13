<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6" v-for="item in statsCards" :key="item.title">
        <el-card class="stat-card" :body-style="{ padding: '20px' }">
          <div class="stat-content">
            <div class="stat-info">
              <div class="stat-value" :style="{ color: item.color }">{{ stats[item.key] || 0 }}</div>
              <div class="stat-label">{{ item.title }}</div>
            </div>
            <el-icon :size="40" :color="item.color">
              <component :is="item.icon" />
            </el-icon>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>待处理异常</span>
              <el-button type="primary" size="small" @click="refreshAnomalies">刷新</el-button>
            </div>
          </template>
          <el-table :data="pendingAnomalies" height="300" style="width: 100%">
            <el-table-column prop="severity" label="优先级" width="80">
              <template #default="{ row }">
                <el-tag :type="getSeverityType(row.severity)" size="small">
                  {{ row.severity === 'HIGH' ? '高' : row.severity === 'MEDIUM' ? '中' : '低' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="anomalyType" label="类型" width="120">
              <template #default="{ row }">
                {{ getAnomalyTypeName(row.anomalyType) }}
              </template>
            </el-table-column>
            <el-table-column prop="title" label="标题" />
            <el-table-column prop="createdAt" label="创建时间" width="160" />
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button type="text" size="small" @click="handleAnomaly(row)">处理</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>紧急充电任务</span>
              <el-tag type="danger">{{ urgentTasks.length }}</el-tag>
            </div>
          </template>
          <el-table :data="urgentTasks" height="300" style="width: 100%">
            <el-table-column prop="taskCode" label="任务编号" width="140" />
            <el-table-column prop="priority" label="优先级" width="80">
              <template #default="{ row }">
                <el-tag :type="row.priority <= 3 ? 'danger' : 'warning'" size="small">
                  P{{ row.priority }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="batteryCode" label="电池" width="100" />
            <el-table-column prop="forkliftCode" label="叉车" width="100" />
            <el-table-column prop="currentSoc" label="电量" width="80">
              <template #default="{ row }">
                <el-progress :percentage="row.currentSoc || 0" :stroke-width="10" />
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)" size="small">
                  {{ getStatusName(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>充电桩状态</span>
              <el-button type="text" @click="$router.push('/stations')">查看全部</el-button>
            </div>
          </template>
          <div class="station-grid">
            <div v-for="station in stations" :key="station.id" class="station-item"
                 :class="`station-${station.status.toLowerCase()}`">
              <div class="station-code">{{ station.stationCode }}</div>
              <div class="station-name">{{ station.stationName }}</div>
              <el-progress :percentage="station.healthScore" :stroke-width="6" />
              <div class="station-status">
                <el-tag :type="getStationStatusType(station.status)" size="small">
                  {{ getStationStatusName(station.status) }}
                </el-tag>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>电量预测汇总</span>
            </div>
          </template>
          <div class="power-forecast">
            <div class="power-summary">
              <div class="power-item">
                <div class="power-value">{{ powerForecast.totalPower || 0 }}</div>
                <div class="power-label">总功率 (kW)</div>
              </div>
              <div class="power-item">
                <div class="power-value">{{ powerForecast.chargingCount || 0 }}</div>
                <div class="power-label">充电中数量</div>
              </div>
            </div>
            <el-table :data="powerForecast.details || []" height="200" style="width: 100%">
              <el-table-column prop="stationCode" label="充电桩" width="100" />
              <el-table-column prop="batteryCode" label="电池" width="100" />
              <el-table-column prop="power" label="功率 (kW)" width="100" />
              <el-table-column label="进度" min-width="120">
                <template #default="{ row }">
                  <el-progress :percentage="row.currentSoc || 0" :stroke-width="8" />
                </template>
              </el-table-column>
              <el-table-column prop="estimatedEnd" label="预计完成" width="160" />
            </el-table>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="handleDialogVisible" title="处理异常" width="500px">
      <el-form label-width="100px">
        <el-form-item label="异常类型">
          <span>{{ currentAnomaly?.anomalyType }}</span>
        </el-form-item>
        <el-form-item label="标题">
          <span>{{ currentAnomaly?.title }}</span>
        </el-form-item>
        <el-form-item label="描述">
          <span>{{ currentAnomaly?.description }}</span>
        </el-form-item>
        <el-form-item label="处理备注">
          <el-input type="textarea" v-model="handleNotes" :rows="3" placeholder="请输入处理说明" />
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

const stats = ref({})
const pendingAnomalies = ref([])
const urgentTasks = ref([])
const stations = ref([])
const powerForecast = ref({})
const handleDialogVisible = ref(false)
const currentAnomaly = ref(null)
const handleNotes = ref('')

const statsCards = [
  { title: '可用充电桩', key: 'availableStations', icon: 'Connection', color: '#67C23A' },
  { title: '低电量电池', key: 'lowBatteries', icon: 'Warning', color: '#E6A23C' },
  { title: '待处理异常', key: 'pendingAnomalies', icon: 'Bell', color: '#F56C6C' },
  { title: '充电中任务', key: 'chargingTasks', icon: 'Lightning', color: '#409EFF' }
]

const getSeverityType = (severity) => {
  return severity === 'HIGH' ? 'danger' : severity === 'MEDIUM' ? 'warning' : 'info'
}

const getAnomalyTypeName = (type) => {
  const map = {
    'STATION_FAULT': '充电桩故障',
    'BATTERY_HEALTH': '电池健康异常',
    'LOW_BATTERY': '低电量报警',
    'WAVE_CONFLICT': '波次冲突'
  }
  return map[type] || type
}

const getStatusType = (status) => {
  const map = {
    'PENDING': 'info',
    'ASSIGNED': 'warning',
    'CHARGING': 'primary',
    'COMPLETED': 'success',
    'CANCELLED': 'danger'
  }
  return map[status] || 'info'
}

const getStatusName = (status) => {
  const map = {
    'PENDING': '待分配',
    'ASSIGNED': '已分配',
    'CHARGING': '充电中',
    'COMPLETED': '已完成',
    'CANCELLED': '已取消'
  }
  return map[status] || status
}

const getStationStatusType = (status) => {
  const map = {
    'AVAILABLE': 'success',
    'OCCUPIED': 'primary',
    'FAULTY': 'danger'
  }
  return map[status] || 'info'
}

const getStationStatusName = (status) => {
  const map = {
    'AVAILABLE': '可用',
    'OCCUPIED': '占用',
    'FAULTY': '故障'
  }
  return map[status] || status
}

const loadStats = async () => {
  const res = await request.get('/dashboard/stats')
  stats.value = res.data || {}
}

const refreshAnomalies = async () => {
  const res = await request.get('/anomalies/pending')
  pendingAnomalies.value = res.data || []
}

const loadUrgentTasks = async () => {
  const res = await request.get('/tasks/urgent')
  urgentTasks.value = res.data || []
}

const loadStations = async () => {
  const res = await request.get('/stations')
  stations.value = (res.data || []).slice(0, 6)
}

const loadPowerForecast = async () => {
  const res = await request.get('/tasks/power-forecast')
  powerForecast.value = res.data || {}
}

const handleAnomaly = (row) => {
  currentAnomaly.value = row
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
  await refreshAnomalies()
  await loadStats()
}

const loadAll = async () => {
  await Promise.all([
    loadStats(),
    refreshAnomalies(),
    loadUrgentTasks(),
    loadStations(),
    loadPowerForecast()
  ])
}

onMounted(() => {
  loadAll()
})
</script>

<style scoped>
.dashboard {
  min-height: 100%;
}

.stat-card {
  margin-bottom: 20px;
}

.stat-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.station-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
}

.station-item {
  padding: 15px;
  border-radius: 8px;
  border: 2px solid #EBEEF5;
  text-align: center;
}

.station-item.station-available {
  border-color: #67C23A;
  background: #f0f9eb;
}

.station-item.station-occupied {
  border-color: #409EFF;
  background: #ecf5ff;
}

.station-item.station-faulty {
  border-color: #F56C6C;
  background: #fef0f0;
}

.station-code {
  font-size: 16px;
  font-weight: bold;
  color: #303133;
}

.station-name {
  font-size: 12px;
  color: #909399;
  margin: 5px 0 10px;
}

.station-status {
  margin-top: 10px;
}

.power-forecast {
  .power-summary {
    display: flex;
    gap: 40px;
    margin-bottom: 20px;
    padding-bottom: 20px;
    border-bottom: 1px solid #EBEEF5;
  }
  
  .power-item {
    text-align: center;
    
    .power-value {
      font-size: 28px;
      font-weight: bold;
      color: #409EFF;
    }
    
    .power-label {
      font-size: 14px;
      color: #909399;
      margin-top: 5px;
    }
  }
}
</style>
