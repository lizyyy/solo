<template>
  <div class="batteries-page">
    <el-card class="filter-card">
      <el-form :inline="true" class="filter-form">
        <el-form-item label="健康状态">
          <el-select v-model="healthFilter" placeholder="全部" clearable style="width: 140px" @change="loadBatteries">
            <el-option label="良好" value="GOOD" />
            <el-option label="需注意" value="WARNING" />
            <el-option label="需更换" value="REPLACE" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="createDialogVisible = true">新增电池</el-button>
          <el-button @click="loadBatteries">刷新</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card style="margin-top: 20px;">
      <el-table :data="batteries" style="width: 100%">
        <el-table-column prop="batteryCode" label="电池编号" width="120" />
        <el-table-column prop="forkliftCode" label="关联叉车" width="120" />
        <el-table-column prop="batteryType" label="类型" width="100" />
        <el-table-column prop="capacityKwh" label="容量 (kWh)" width="120" />
        <el-table-column label="当前电量" width="150">
          <template #default="{ row }">
            <el-progress :percentage="row.currentSoc" :stroke-width="10" :color="getSocColor(row.currentSoc)" />
          </template>
        </el-table-column>
        <el-table-column label="健康状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getHealthTagType(row.healthStatus)" size="small">
              {{ getHealthName(row.healthStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="健康分数" width="150">
          <template #default="{ row }">
            <el-progress :percentage="row.healthScore" :stroke-width="8" :color="getHealthColor(row.healthScore)" />
          </template>
        </el-table-column>
        <el-table-column prop="cycleCount" label="循环次数" width="100" />
        <el-table-column prop="lastChargeTime" label="最后充电" width="160" />
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button type="text" size="small" @click="viewHistory(row)">变更记录</el-button>
            <el-button type="text" size="small" @click="updateSoc(row)">更新电量</el-button>
            <el-button type="text" size="small" @click="updateHealth(row)">健康状态</el-button>
            <el-button type="text" size="small" @click="editBattery(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="createDialogVisible" title="新增电池" width="500px">
      <el-form :model="newBattery" label-width="100px">
        <el-form-item label="电池编号" required>
          <el-input v-model="newBattery.batteryCode" placeholder="如 BAT-001" />
        </el-form-item>
        <el-form-item label="叉车编号">
          <el-input v-model="newBattery.forkliftCode" placeholder="可选" />
        </el-form-item>
        <el-form-item label="电池类型">
          <el-select v-model="newBattery.batteryType" style="width: 100%">
            <el-option label="锂电池" value="LITHIUM" />
            <el-option label="铅酸电池" value="LEAD_ACID" />
          </el-select>
        </el-form-item>
        <el-form-item label="容量 (kWh)">
          <el-input-number v-model="newBattery.capacityKwh" :min="10" :max="500" :step="10" />
        </el-form-item>
        <el-form-item label="当前电量 (%)">
          <el-slider v-model="newBattery.currentSoc" :min="0" :max="100" show-input />
        </el-form-item>
        <el-form-item label="最低电量阈值">
          <el-slider v-model="newBattery.minSoc" :min="0" :max="50" show-input />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editDialogVisible" title="编辑电池" width="500px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="电池编号">
          <span>{{ editForm.batteryCode }}</span>
        </el-form-item>
        <el-form-item label="叉车编号">
          <el-input v-model="editForm.forkliftCode" />
        </el-form-item>
        <el-form-item label="电池类型">
          <el-select v-model="editForm.batteryType" style="width: 100%">
            <el-option label="锂电池" value="LITHIUM" />
            <el-option label="铅酸电池" value="LEAD_ACID" />
          </el-select>
        </el-form-item>
        <el-form-item label="当前电量 (%)">
          <el-slider v-model="editForm.currentSoc" :min="0" :max="100" show-input />
        </el-form-item>
        <el-form-item label="健康状态">
          <el-select v-model="editForm.healthStatus" style="width: 100%">
            <el-option label="良好" value="GOOD" />
            <el-option label="需注意" value="WARNING" />
            <el-option label="需更换" value="REPLACE" />
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

    <el-dialog v-model="socDialogVisible" title="更新电量" width="400px">
      <el-form label-width="100px">
        <el-form-item label="电池">
          <span>{{ currentBattery?.batteryCode }} (当前: {{ currentBattery?.currentSoc }}%)</span>
        </el-form-item>
        <el-form-item label="新电量" required>
          <el-slider v-model="newSoc" :min="0" :max="100" show-input />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="socDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitSoc">确认更新</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="healthDialogVisible" title="更新健康状态" width="500px">
      <el-form label-width="100px">
        <el-form-item label="电池">
          <span>{{ currentBattery?.batteryCode }} (当前健康分数: {{ currentBattery?.healthScore }})</span>
        </el-form-item>
        <el-form-item label="健康状态">
          <el-select v-model="newHealthStatus" style="width: 100%">
            <el-option label="良好" value="GOOD" />
            <el-option label="需注意" value="WARNING" />
            <el-option label="需更换" value="REPLACE" />
          </el-select>
        </el-form-item>
        <el-form-item label="健康分数">
          <el-slider v-model="newHealthScore" :min="0" :max="100" show-input />
        </el-form-item>
        <el-form-item label="更新原因" required>
          <el-input type="textarea" v-model="healthReason" :rows="2" placeholder="请说明更新原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="healthDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitHealth">确认更新</el-button>
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
import { ElMessage } from 'element-plus'
import request from '@/utils/request'

const batteries = ref([])
const healthFilter = ref('')
const createDialogVisible = ref(false)
const editDialogVisible = ref(false)
const socDialogVisible = ref(false)
const healthDialogVisible = ref(false)
const historyDialogVisible = ref(false)

const newBattery = ref({
  batteryCode: '',
  forkliftCode: '',
  batteryType: 'LITHIUM',
  capacityKwh: 80,
  currentSoc: 80,
  minSoc: 20
})

const editForm = ref({})
const currentBattery = ref(null)
const newSoc = ref(0)
const newHealthStatus = ref('GOOD')
const newHealthScore = ref(95)
const healthReason = ref('')
const historyData = ref([])

const getSocColor = (soc) => {
  if (soc >= 50) return '#67C23A'
  if (soc >= 20) return '#E6A23C'
  return '#F56C6C'
}

const getHealthTagType = (status) => {
  const map = {
    'GOOD': 'success',
    'WARNING': 'warning',
    'REPLACE': 'danger'
  }
  return map[status] || 'info'
}

const getHealthName = (status) => {
  const map = {
    'GOOD': '良好',
    'WARNING': '需注意',
    'REPLACE': '需更换'
  }
  return map[status] || status
}

const getHealthColor = (score) => {
  if (score >= 80) return '#67C23A'
  if (score >= 60) return '#E6A23C'
  return '#F56C6C'
}

const loadBatteries = async () => {
  let res
  if (healthFilter.value) {
    res = await request.get('/batteries')
    batteries.value = (res.data || []).filter(b => b.healthStatus === healthFilter.value)
  } else {
    res = await request.get('/batteries')
    batteries.value = res.data || []
  }
}

const submitCreate = async () => {
  if (!newBattery.value.batteryCode) {
    ElMessage.warning('请填写电池编号')
    return
  }
  await request.post('/batteries', newBattery.value)
  ElMessage.success('创建成功')
  createDialogVisible.value = false
  newBattery.value = { batteryCode: '', forkliftCode: '', batteryType: 'LITHIUM', capacityKwh: 80, currentSoc: 80, minSoc: 20 }
  await loadBatteries()
}

const editBattery = (battery) => {
  editForm.value = { ...battery }
  editDialogVisible.value = true
}

const submitEdit = async () => {
  await request.put(`/batteries/${editForm.value.id}`, editForm.value)
  ElMessage.success('更新成功')
  editDialogVisible.value = false
  await loadBatteries()
}

const updateSoc = (battery) => {
  currentBattery.value = battery
  newSoc.value = battery.currentSoc
  socDialogVisible.value = true
}

const submitSoc = async () => {
  await request.post(`/batteries/${currentBattery.value.id}/update-soc`, null, {
    params: { newSoc: newSoc.value }
  })
  ElMessage.success('电量已更新')
  socDialogVisible.value = false
  await loadBatteries()
}

const updateHealth = (battery) => {
  currentBattery.value = battery
  newHealthStatus.value = battery.healthStatus
  newHealthScore.value = battery.healthScore
  healthReason.value = ''
  healthDialogVisible.value = true
}

const submitHealth = async () => {
  if (!healthReason.value.trim()) {
    ElMessage.warning('请说明更新原因')
    return
  }
  await request.post(`/batteries/${currentBattery.value.id}/update-health`, null, {
    params: { 
      status: newHealthStatus.value, 
      score: newHealthScore.value, 
      reason: healthReason.value 
    }
  })
  ElMessage.success('健康状态已更新')
  healthDialogVisible.value = false
  await loadBatteries()
}

const viewHistory = async (battery) => {
  const res = await request.get(`/reports/change-history/entity/BATTERY/${battery.id}`)
  historyData.value = res.data || []
  historyDialogVisible.value = true
}

onMounted(() => {
  loadBatteries()
})
</script>

<style scoped>
.batteries-page {
  min-height: 100%;
}

.filter-card {
  margin-bottom: 20px;
}
</style>
