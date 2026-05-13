<template>
  <div class="waves-page">
    <el-card class="filter-card">
      <el-form :inline="true" class="filter-form">
        <el-form-item label="状态">
          <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width: 140px" @change="loadWaves">
            <el-option label="计划中" value="PLANNED" />
            <el-option label="进行中" value="IN_PROGRESS" />
            <el-option label="已完成" value="COMPLETED" />
            <el-option label="已取消" value="CANCELLED" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="createDialogVisible = true">新增波次</el-button>
          <el-button @click="loadWaves">刷新</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card style="margin-top: 20px;">
      <el-table :data="waves" style="width: 100%">
        <el-table-column prop="waveCode" label="波次编号" width="120" />
        <el-table-column prop="waveName" label="波次名称" width="200" />
        <el-table-column prop="startTime" label="开始时间" width="160" />
        <el-table-column prop="endTime" label="结束时间" width="160" />
        <el-table-column prop="priority" label="优先级" width="80">
          <template #default="{ row }">
            <el-tag :type="row.priority <= 3 ? 'danger' : row.priority <= 6 ? 'warning' : 'info'" size="small">
              P{{ row.priority }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="叉车需求" width="140">
          <template #default="{ row }">
            <el-progress :percentage="(row.actualForklifts / row.requiredForklifts) * 100" :stroke-width="10">
              <template #default="{ percentage }">
                <span style="font-size: 12px">{{ row.actualForklifts }}/{{ row.requiredForklifts }}</span>
              </template>
            </el-progress>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusName(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button type="text" size="small" @click="viewHistory(row)">变更记录</el-button>
            <el-button type="text" size="small" @click="viewTasks(row)">关联任务</el-button>
            <el-button type="text" size="small" @click="editWave(row)">编辑</el-button>
            <el-button v-if="row.status === 'PLANNED'" type="text" size="small" @click="startWave(row)">开始</el-button>
            <el-button v-if="row.status === 'IN_PROGRESS'" type="text" size="small" @click="completeWave(row)">完成</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="createDialogVisible" title="新增作业波次" width="600px">
      <el-form :model="newWave" label-width="100px">
        <el-form-item label="波次编号" required>
          <el-input v-model="newWave.waveCode" placeholder="如 WAVE-001" />
        </el-form-item>
        <el-form-item label="波次名称" required>
          <el-input v-model="newWave.waveName" placeholder="如 早班拣货波次" />
        </el-form-item>
        <el-form-item label="开始时间" required>
          <el-date-picker v-model="newWave.startTime" type="datetime" placeholder="选择开始时间" style="width: 100%" />
        </el-form-item>
        <el-form-item label="结束时间" required>
          <el-date-picker v-model="newWave.endTime" type="datetime" placeholder="选择结束时间" style="width: 100%" />
        </el-form-item>
        <el-form-item label="优先级">
          <el-slider v-model="newWave.priority" :min="1" :max="10" show-input />
        </el-form-item>
        <el-form-item label="需求叉车数">
          <el-input-number v-model="newWave.requiredForklifts" :min="1" :max="50" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editDialogVisible" title="编辑作业波次" width="600px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="波次编号">
          <span>{{ editForm.waveCode }}</span>
        </el-form-item>
        <el-form-item label="波次名称">
          <el-input v-model="editForm.waveName" />
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker v-model="editForm.startTime" type="datetime" style="width: 100%" />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker v-model="editForm.endTime" type="datetime" style="width: 100%" />
        </el-form-item>
        <el-form-item label="优先级">
          <el-slider v-model="editForm.priority" :min="1" :max="10" show-input />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="editForm.status" style="width: 100%">
            <el-option label="计划中" value="PLANNED" />
            <el-option label="进行中" value="IN_PROGRESS" />
            <el-option label="已完成" value="COMPLETED" />
            <el-option label="已取消" value="CANCELLED" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="tasksDialogVisible" title="关联任务" width="800px">
      <el-table :data="waveTasks" style="width: 100%">
        <el-table-column prop="taskCode" label="任务编号" width="160" />
        <el-table-column prop="batteryCode" label="电池" width="120" />
        <el-table-column label="电量" width="120">
          <template #default="{ row }">
            <el-progress :percentage="row.currentSoc || 0" :stroke-width="8" />
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="160" />
      </el-table>
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

const waves = ref([])
const statusFilter = ref('')
const createDialogVisible = ref(false)
const editDialogVisible = ref(false)
const tasksDialogVisible = ref(false)
const historyDialogVisible = ref(false)

const newWave = ref({
  waveCode: '',
  waveName: '',
  startTime: null,
  endTime: null,
  priority: 5,
  requiredForklifts: 5
})

const editForm = ref({})
const waveTasks = ref([])
const historyData = ref([])

const getStatusType = (status) => {
  const map = {
    'PLANNED': 'info',
    'IN_PROGRESS': 'primary',
    'COMPLETED': 'success',
    'CANCELLED': 'danger'
  }
  return map[status] || 'info'
}

const getStatusName = (status) => {
  const map = {
    'PLANNED': '计划中',
    'IN_PROGRESS': '进行中',
    'COMPLETED': '已完成',
    'CANCELLED': '已取消'
  }
  return map[status] || status
}

const loadWaves = async () => {
  let res
  if (statusFilter.value) {
    res = await request.get('/waves')
    waves.value = (res.data || []).filter(w => w.status === statusFilter.value)
  } else {
    res = await request.get('/waves')
    waves.value = res.data || []
  }
}

const submitCreate = async () => {
  if (!newWave.value.waveCode || !newWave.value.waveName || !newWave.value.startTime || !newWave.value.endTime) {
    ElMessage.warning('请填写必填项')
    return
  }
  await request.post('/waves', newWave.value)
  ElMessage.success('创建成功')
  createDialogVisible.value = false
  newWave.value = { waveCode: '', waveName: '', startTime: null, endTime: null, priority: 5, requiredForklifts: 5 }
  await loadWaves()
}

const editWave = (wave) => {
  editForm.value = { ...wave }
  editDialogVisible.value = true
}

const submitEdit = async () => {
  await request.put(`/waves/${editForm.value.id}`, editForm.value)
  ElMessage.success('更新成功')
  editDialogVisible.value = false
  await loadWaves()
}

const startWave = async (wave) => {
  await ElMessageBox.confirm('确认开始该作业波次？', '提示', { type: 'warning' })
  await request.post(`/waves/${wave.id}/status`, null, {
    params: { status: 'IN_PROGRESS', reason: '开始作业波次' }
  })
  ElMessage.success('波次已开始')
  await loadWaves()
}

const completeWave = async (wave) => {
  await ElMessageBox.confirm('确认完成该作业波次？', '提示', { type: 'warning' })
  await request.post(`/waves/${wave.id}/status`, null, {
    params: { status: 'COMPLETED', reason: '完成作业波次' }
  })
  ElMessage.success('波次已完成')
  await loadWaves()
}

const viewTasks = async (wave) => {
  const res = await request.get(`/tasks/wave/${wave.id}`)
  waveTasks.value = res.data || []
  tasksDialogVisible.value = true
}

const viewHistory = async (wave) => {
  const res = await request.get(`/reports/change-history/entity/WORK_WAVE/${wave.id}`)
  historyData.value = res.data || []
  historyDialogVisible.value = true
}

onMounted(() => {
  loadWaves()
})
</script>

<style scoped>
.waves-page {
  min-height: 100%;
}

.filter-card {
  margin-bottom: 20px;
}
</style>
