<template>
  <div class="tasks-page">
    <el-card class="filter-card">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 140px" @change="loadTasks">
            <el-option label="待分配" value="PENDING" />
            <el-option label="已分配" value="ASSIGNED" />
            <el-option label="充电中" value="CHARGING" />
            <el-option label="已完成" value="COMPLETED" />
            <el-option label="已取消" value="CANCELLED" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="createTask">新建任务</el-button>
          <el-button @click="loadTasks">刷新</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card style="margin-top: 20px;">
      <el-table :data="tasks" style="width: 100%" v-loading="loading">
        <el-table-column prop="taskCode" label="任务编号" width="160" />
        <el-table-column label="紧急状态" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.isUrgent" type="danger" size="small">紧急</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="priority" label="优先级" width="80">
          <template #default="{ row }">
            <el-tag :type="row.priority <= 3 ? 'danger' : row.priority <= 6 ? 'warning' : 'info'" size="small">
              P{{ row.priority }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="batteryCode" label="电池编号" width="120" />
        <el-table-column prop="forkliftCode" label="叉车编号" width="120" />
        <el-table-column label="电量" width="120">
          <template #default="{ row }">
            <el-progress :percentage="row.currentSoc || 0" :stroke-width="8" />
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusName(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="assignedOperator" label="操作员" width="100" />
        <el-table-column prop="createdBy" label="创建人" width="100" />
        <el-table-column prop="createdAt" label="创建时间" width="160" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button type="text" size="small" @click="viewHistory(row)">变更记录</el-button>
            <el-button v-if="row.status === 'PENDING'" type="text" size="small" @click="assignStation(row)">分配桩位</el-button>
            <el-button v-if="row.status === 'ASSIGNED'" type="text" size="small" @click="startCharging(row)">开始充电</el-button>
            <el-button v-if="row.status === 'CHARGING'" type="text" size="small" @click="completeCharging(row)">完成充电</el-button>
            <el-button v-if="['PENDING', 'ASSIGNED', 'CHARGING'].includes(row.status)" type="text" size="small" @click="adjustPriority(row)">调整优先级</el-button>
            <el-button v-if="['PENDING', 'ASSIGNED', 'CHARGING'].includes(row.status)" type="text" size="small" style="color: #F56C6C" @click="cancelTask(row)">取消</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="createDialogVisible" title="新建充电任务" width="600px">
      <el-form :model="newTask" label-width="100px">
        <el-form-item label="电池" required>
          <el-select v-model="newTask.batteryId" placeholder="请选择电池" style="width: 100%" @change="onBatteryChange">
            <el-option v-for="b in batteries" :key="b.id" :label="`${b.batteryCode} (${b.currentSoc}%)`" :value="b.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联波次">
          <el-select v-model="newTask.waveId" placeholder="可选作业波次" style="width: 100%" clearable>
            <el-option v-for="w in waves" :key="w.id" :label="`${w.waveName} (${w.startTime}~${w.endTime})`" :value="w.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-slider v-model="newTask.priority" :min="1" :max="10" show-input />
        </el-form-item>
        <el-form-item label="紧急任务">
          <el-switch v-model="newTask.isUrgent" />
        </el-form-item>
        <el-form-item label="目标电量">
          <el-slider v-model="newTask.targetSoc" :min="50" :max="100" show-input />
        </el-form-item>
        <el-form-item label="分配操作员">
          <el-input v-model="newTask.assignedOperator" placeholder="请输入操作员" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input type="textarea" v-model="newTask.remarks" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="assignDialogVisible" title="分配充电桩" width="500px">
      <el-form label-width="100px">
        <el-form-item label="任务编号">
          <span>{{ currentTask?.taskCode }}</span>
        </el-form-item>
        <el-form-item label="选择充电桩" required>
          <el-select v-model="selectedStationId" placeholder="请选择可用充电桩" style="width: 100%">
            <el-option v-for="s in availableStations" :key="s.id" 
                       :label="`${s.stationName} (${s.location})`" :value="s.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAssign">确认分配</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="completeDialogVisible" title="完成充电" width="400px">
      <el-form label-width="100px">
        <el-form-item label="最终电量" required>
          <el-slider v-model="finalSoc" :min="0" :max="100" show-input />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="completeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitComplete">确认完成</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="priorityDialogVisible" title="调整优先级" width="500px">
      <el-form label-width="100px">
        <el-form-item label="新优先级">
          <el-slider v-model="newPriority" :min="1" :max="10" show-input />
        </el-form-item>
        <el-form-item label="调整原因" required>
          <el-input type="textarea" v-model="priorityReason" :rows="2" placeholder="请说明调整原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="priorityDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitPriority">确认调整</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="cancelDialogVisible" title="取消任务" width="400px">
      <el-form label-width="100px">
        <el-form-item label="取消原因" required>
          <el-input type="textarea" v-model="cancelReason" :rows="3" placeholder="请输入取消原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cancelDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="submitCancel">确认取消</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="historyDialogVisible" title="变更历史" width="700px">
      <el-table :data="taskHistory" style="width: 100%">
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

const loading = ref(false)
const tasks = ref([])
const batteries = ref([])
const waves = ref([])
const availableStations = ref([])
const filters = ref({ status: '' })

const createDialogVisible = ref(false)
const newTask = ref({
  batteryId: null,
  waveId: null,
  priority: 5,
  isUrgent: false,
  targetSoc: 100,
  assignedOperator: '',
  remarks: ''
})

const assignDialogVisible = ref(false)
const currentTask = ref(null)
const selectedStationId = ref(null)

const completeDialogVisible = ref(false)
const finalSoc = ref(100)

const priorityDialogVisible = ref(false)
const newPriority = ref(5)
const priorityReason = ref('')

const cancelDialogVisible = ref(false)
const cancelReason = ref('')

const historyDialogVisible = ref(false)
const taskHistory = ref([])

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

const loadTasks = async () => {
  loading.value = true
  try {
    let res
    if (filters.value.status) {
      res = await request.get(`/tasks/status/${filters.value.status}`)
    } else {
      res = await request.get('/tasks')
    }
    tasks.value = res.data || []
  } finally {
    loading.value = false
  }
}

const loadBatteries = async () => {
  const res = await request.get('/batteries')
  batteries.value = res.data || []
}

const loadWaves = async () => {
  const res = await request.get('/waves/active')
  waves.value = res.data || []
}

const loadAvailableStations = async () => {
  const res = await request.get('/stations/available')
  availableStations.value = res.data || []
}

const createTask = () => {
  newTask.value = {
    batteryId: null,
    waveId: null,
    priority: 5,
    isUrgent: false,
    targetSoc: 100,
    assignedOperator: '',
    remarks: ''
  }
  createDialogVisible.value = true
}

const onBatteryChange = () => {
  const battery = batteries.value.find(b => b.id === newTask.value.batteryId)
  if (battery && battery.currentSoc >= 95) {
    ElMessage.warning('该电池电量充足，无需充电')
  }
}

const submitCreate = async () => {
  if (!newTask.value.batteryId) {
    ElMessage.warning('请选择电池')
    return
  }
  await request.post('/tasks', newTask.value)
  ElMessage.success('创建成功')
  createDialogVisible.value = false
  await loadTasks()
}

const assignStation = async (row) => {
  currentTask.value = row
  selectedStationId.value = null
  await loadAvailableStations()
  if (availableStations.value.length === 0) {
    ElMessage.warning('暂无可分配的充电桩')
    return
  }
  assignDialogVisible.value = true
}

const submitAssign = async () => {
  if (!selectedStationId.value) {
    ElMessage.warning('请选择充电桩')
    return
  }
  await request.post(`/tasks/${currentTask.value.id}/assign-station/${selectedStationId.value}`)
  ElMessage.success('分配成功')
  assignDialogVisible.value = false
  await loadTasks()
}

const startCharging = async (row) => {
  await ElMessageBox.confirm('确认开始充电？', '提示', { type: 'warning' })
  await request.post(`/tasks/${row.id}/start`)
  ElMessage.success('已开始充电')
  await loadTasks()
}

const completeCharging = (row) => {
  currentTask.value = row
  finalSoc.value = 100
  completeDialogVisible.value = true
}

const submitComplete = async () => {
  await request.post(`/tasks/${currentTask.value.id}/complete`, null, {
    params: { finalSoc: finalSoc.value }
  })
  ElMessage.success('充电已完成')
  completeDialogVisible.value = false
  await loadTasks()
}

const adjustPriority = (row) => {
  currentTask.value = row
  newPriority.value = row.priority
  priorityReason.value = ''
  priorityDialogVisible.value = true
}

const submitPriority = async () => {
  if (!priorityReason.value.trim()) {
    ElMessage.warning('请说明调整原因')
    return
  }
  await request.post(`/tasks/${currentTask.value.id}/adjust-priority`, null, {
    params: { newPriority: newPriority.value, reason: priorityReason.value }
  })
  ElMessage.success('优先级已调整')
  priorityDialogVisible.value = false
  await loadTasks()
}

const cancelTask = (row) => {
  currentTask.value = row
  cancelReason.value = ''
  cancelDialogVisible.value = true
}

const submitCancel = async () => {
  if (!cancelReason.value.trim()) {
    ElMessage.warning('请输入取消原因')
    return
  }
  await request.post(`/tasks/${currentTask.value.id}/cancel`, null, {
    params: { reason: cancelReason.value }
  })
  ElMessage.success('任务已取消')
  cancelDialogVisible.value = false
  await loadTasks()
}

const viewHistory = async (row) => {
  const res = await request.get(`/reports/change-history/entity/CHARGING_TASK/${row.id}`)
  taskHistory.value = res.data || []
  historyDialogVisible.value = true
}

onMounted(() => {
  loadTasks()
  loadBatteries()
  loadWaves()
})
</script>

<style scoped>
.tasks-page {
  min-height: 100%;
}

.filter-card {
  margin-bottom: 20px;
}

.filter-form {
  margin: 0;
}
</style>
