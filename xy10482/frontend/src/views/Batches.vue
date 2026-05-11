<template>
  <div class="batches-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>入库批次列表</span>
          <el-button type="primary" @click="openDialog()">
            <el-icon><Plus /></el-icon>
            新增入库
          </el-button>
        </div>
      </template>
      <el-table :data="batches" border>
        <el-table-column prop="batch_no" label="批次号" width="180"></el-table-column>
        <el-table-column prop="plot_name" label="地块" width="100"></el-table-column>
        <el-table-column prop="manager_name" label="采收人" width="100"></el-table-column>
        <el-table-column prop="grade_name" label="等级" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.grade_name">{{ row.grade_name }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="入库数量" width="100">
          <template #default="{ row }">{{ row.quantity }} kg</template>
        </el-table-column>
        <el-table-column prop="loss_quantity" label="损耗数量" width="100">
          <template #default="{ row }">{{ row.loss_quantity || 0 }} kg</template>
        </el-table-column>
        <el-table-column prop="loss_reason_name" label="损耗原因" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.loss_reason_name" type="danger" size="small">{{ row.loss_reason_name }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="quality_status" label="质检状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getQualityType(row.quality_status)">{{ getQualityText(row.quality_status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="库存状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180"></el-table-column>
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewHistory(row)">历史</el-button>
            <el-button link type="warning" @click="adjustGrade(row)">调级</el-button>
            <el-button link type="success" @click="doInspection(row)" v-if="row.quality_status === 'pending'">质检</el-button>
            <el-button link type="danger" @click="handleDelete(row)" v-if="row.quality_status === 'pending'">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑入库批次' : '新增入库批次'" width="700px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="采收任务" required>
          <el-select v-model="form.harvest_task_id" placeholder="请选择采收任务" style="width: 100%" @change="onTaskChange">
            <el-option v-for="task in tasks" :key="task.id" :label="`${task.plot_name} - ${task.harvest_date}`" :value="task.id"></el-option>
          </el-select>
          <div v-if="selectedTask" class="task-info">
            采收数量: {{ selectedTask.actual_quantity || selectedTask.estimated_quantity || 0 }} kg, 
            负责人: {{ selectedTask.manager_name || '未指定' }}
          </div>
        </el-form-item>
        <el-form-item label="分拣等级">
          <el-select v-model="form.grade_id" placeholder="请选择等级" style="width: 100%">
            <el-option v-for="grade in grades" :key="grade.id" :label="grade.name" :value="grade.id"></el-option>
          </el-select>
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="入库数量" required>
              <el-input-number v-model="form.quantity" :min="0" :step="0.1" style="width: 100%"></el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="损耗数量">
              <el-input-number v-model="form.loss_quantity" :min="0" :step="0.1" style="width: 100%"></el-input-number>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="损耗原因">
          <el-select v-model="form.loss_reason_id" placeholder="请选择损耗原因" style="width: 100%">
            <el-option v-for="reason in lossReasons" :key="reason.id" :label="reason.name" :value="reason.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="库位">
          <el-input v-model="form.storage_location" placeholder="例：A区-01架"></el-input>
        </el-form-item>
        <el-form-item label="备注">
          <el-input type="textarea" v-model="form.notes" :rows="2"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="historyVisible" title="等级调整历史" width="600px">
      <el-table :data="batchHistory" border>
        <el-table-column prop="adjusted_at" label="调整时间" width="180"></el-table-column>
        <el-table-column prop="old_grade_name" label="原等级"></el-table-column>
        <el-table-column prop="new_grade_name" label="新等级"></el-table-column>
        <el-table-column prop="adjusted_by" label="调整人" width="100"></el-table-column>
        <el-table-column prop="adjustment_reason" label="原因"></el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="adjustVisible" title="等级调整" width="500px">
      <el-form :model="adjustForm" label-width="100px">
        <el-form-item label="新等级" required>
          <el-select v-model="adjustForm.new_grade_id" placeholder="请选择新等级" style="width: 100%">
            <el-option v-for="grade in grades" :key="grade.id" :label="grade.name" :value="grade.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="调整人">
          <el-input v-model="adjustForm.adjusted_by" placeholder="请输入调整人"></el-input>
        </el-form-item>
        <el-form-item label="调整原因" required>
          <el-input type="textarea" v-model="adjustForm.adjustment_reason" :rows="3"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAdjust">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="inspectionVisible" title="质检" width="500px">
      <el-form :model="inspectionForm" label-width="100px">
        <el-form-item label="质检结果" required>
          <el-select v-model="inspectionForm.result" placeholder="请选择" style="width: 100%">
            <el-option label="通过" value="passed"></el-option>
            <el-option label="不通过" value="failed"></el-option>
            <el-option label="待定" value="pending"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="质检员">
          <el-input v-model="inspectionForm.inspector" placeholder="请输入质检员"></el-input>
        </el-form-item>
        <el-form-item label="评分">
          <el-input-number v-model="inspectionForm.score" :min="0" :max="100" style="width: 100%"></el-input-number>
        </el-form-item>
        <el-form-item label="缺陷描述" v-if="inspectionForm.result === 'failed'">
          <el-input type="textarea" v-model="inspectionForm.defects" :rows="3" placeholder="请描述缺陷"></el-input>
        </el-form-item>
        <el-form-item label="备注">
          <el-input type="textarea" v-model="inspectionForm.notes" :rows="2"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="inspectionVisible = false">取消</el-button>
        <el-button type="primary" @click="submitInspection">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { batchApi, harvestTaskApi, gradeApi, lossReasonApi, inspectionApi } from '../api'

const batches = ref([])
const tasks = ref([])
const grades = ref([])
const lossReasons = ref([])
const selectedTask = ref(null)

const dialogVisible = ref(false)
const isEdit = ref(false)
const form = ref({
  harvest_task_id: null,
  grade_id: null,
  quantity: 0,
  loss_quantity: 0,
  loss_reason_id: null,
  storage_location: '',
  notes: ''
})

const historyVisible = ref(false)
const batchHistory = ref([])

const adjustVisible = ref(false)
const adjustForm = ref({
  batchId: null,
  new_grade_id: null,
  adjusted_by: '',
  adjustment_reason: ''
})

const inspectionVisible = ref(false)
const inspectionForm = ref({
  batch_id: null,
  inspector: '',
  result: 'passed',
  score: null,
  defects: '',
  notes: ''
})

const getQualityType = (status) => {
  const map = {
    pending: 'warning',
    passed: 'success',
    failed: 'danger'
  }
  return map[status] || 'info'
}

const getQualityText = (status) => {
  const map = {
    pending: '待质检',
    passed: '通过',
    failed: '不通过'
  }
  return map[status] || status
}

const getStatusType = (status) => {
  const map = {
    pending: 'warning',
    available: 'success',
    quarantined: 'danger'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    pending: '待处理',
    available: '可售',
    quarantined: '隔离'
  }
  return map[status] || status
}

const loadData = async () => {
  const [batchesRes, tasksRes, gradesRes, lossRes] = await Promise.all([
    batchApi.getAll(),
    harvestTaskApi.getAll(),
    gradeApi.getAll(),
    lossReasonApi.getAll()
  ])
  if (batchesRes.data.success) batches.value = batchesRes.data.data
  if (tasksRes.data.success) tasks.value = tasksRes.data.data
  if (gradesRes.data.success) grades.value = gradesRes.data.data
  if (lossRes.data.success) lossReasons.value = lossRes.data.data

  const saved = sessionStorage.getItem('selectedHarvestTask')
  if (saved) {
    const task = JSON.parse(saved)
    if (task && !isEdit.value) {
      dialogVisible.value = true
      form.value.harvest_task_id = task.id
      selectedTask.value = task
    }
    sessionStorage.removeItem('selectedHarvestTask')
  }
}

const onTaskChange = (taskId) => {
  selectedTask.value = tasks.value.find(t => t.id === taskId) || null
}

const openDialog = (row = null) => {
  isEdit.value = !!row
  selectedTask.value = null
  if (row) {
    form.value = { ...row }
    selectedTask.value = tasks.value.find(t => t.id === row.harvest_task_id)
  } else {
    form.value = {
      harvest_task_id: null,
      grade_id: null,
      quantity: 0,
      loss_quantity: 0,
      loss_reason_id: null,
      storage_location: '',
      notes: ''
    }
  }
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!form.value.harvest_task_id || form.value.quantity == null) {
    ElMessage.warning('请填写必填项')
    return
  }
  
  try {
    let res
    if (isEdit.value) {
      res = await batchApi.update(form.value.id, form.value)
    } else {
      res = await batchApi.create(form.value)
    }
    if (res.data.success) {
      ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
      dialogVisible.value = false
      loadData()
    } else {
      ElMessage.error(res.data.message)
    }
  } catch (err) {
    ElMessage.error(err?.response?.data?.message || '操作失败')
  }
}

const viewHistory = async (row) => {
  const res = await batchApi.getHistory(row.id)
  if (res.data.success) {
    batchHistory.value = res.data.data
    historyVisible.value = true
  }
}

const adjustGrade = (row) => {
  adjustForm.value = {
    batchId: row.id,
    new_grade_id: null,
    adjusted_by: '',
    adjustment_reason: ''
  }
  adjustVisible.value = true
}

const submitAdjust = async () => {
  if (!adjustForm.value.new_grade_id || !adjustForm.value.adjustment_reason) {
    ElMessage.warning('请填写必填项')
    return
  }
  const res = await batchApi.adjustGrade(adjustForm.value.batchId, adjustForm.value)
  if (res.data.success) {
    ElMessage.success('等级调整成功')
    adjustVisible.value = false
    loadData()
  } else {
    ElMessage.error(res.data.message)
  }
}

const doInspection = (row) => {
  inspectionForm.value = {
    batch_id: row.id,
    inspector: '',
    result: 'passed',
    score: null,
    defects: '',
    notes: ''
  }
  inspectionVisible.value = true
}

const submitInspection = async () => {
  const res = await inspectionApi.create(inspectionForm.value)
  if (res.data.success) {
    ElMessage.success(res.data.message)
    inspectionVisible.value = false
    loadData()
  } else {
    ElMessage.error(res.data.message)
  }
}

const handleDelete = (row) => {
  ElMessageBox.confirm('确定要删除这个入库批次吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    const res = await batchApi.delete(row.id)
    if (res.data.success) {
      ElMessage.success('删除成功')
      loadData()
    } else {
      ElMessage.error(res.data.message)
    }
  }).catch(() => {})
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-info {
  margin-top: 8px;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 12px;
  color: #666;
}
</style>
