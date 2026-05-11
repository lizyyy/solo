<template>
  <div class="harvest-tasks-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>采收任务列表</span>
          <el-button type="primary" @click="openDialog()">
            <el-icon><Plus /></el-icon>
            新增任务
          </el-button>
        </div>
      </template>
      <el-table :data="tasks" border>
        <el-table-column prop="plot_name" label="地块" width="120"></el-table-column>
        <el-table-column prop="manager_name" label="采收负责人" width="120"></el-table-column>
        <el-table-column prop="harvest_date" label="采收日期" width="120"></el-table-column>
        <el-table-column prop="crop_type" label="作物"></el-table-column>
        <el-table-column prop="estimated_quantity" label="预计产量(kg)" width="120"></el-table-column>
        <el-table-column prop="actual_quantity" label="实际产量(kg)" width="120"></el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button link type="success" @click="createBatch(row)">创建入库</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑采收任务' : '新增采收任务'" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="地块" required>
          <el-select v-model="form.plot_id" placeholder="请选择地块" style="width: 100%">
            <el-option v-for="plot in plots" :key="plot.id" :label="plot.name" :value="plot.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="采收负责人">
          <el-select v-model="form.manager_id" placeholder="请选择负责人" style="width: 100%">
            <el-option v-for="manager in managers" :key="manager.id" :label="manager.name" :value="manager.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="采收日期" required>
          <el-date-picker v-model="form.harvest_date" type="date" placeholder="选择日期" style="width: 100%" value-format="YYYY-MM-DD"></el-date-picker>
        </el-form-item>
        <el-form-item label="作物类型">
          <el-input v-model="form.crop_type" placeholder="请输入作物类型"></el-input>
        </el-form-item>
        <el-form-item label="预计产量">
          <el-input-number v-model="form.estimated_quantity" :min="0" :step="1" style="width: 100%"></el-input-number>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option label="待处理" value="pending"></el-option>
            <el-option label="进行中" value="in_progress"></el-option>
            <el-option label="已完成" value="completed"></el-option>
          </el-select>
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { harvestTaskApi, plotApi, managerApi } from '../api'

const router = useRouter()
const tasks = ref([])
const plots = ref([])
const managers = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const form = ref({
  plot_id: null,
  manager_id: null,
  harvest_date: '',
  crop_type: '',
  estimated_quantity: 0,
  actual_quantity: 0,
  status: 'pending',
  notes: ''
})

const getStatusType = (status) => {
  const map = {
    pending: 'info',
    in_progress: 'warning',
    completed: 'success'
  }
  return map[status] || 'info'
}

const getStatusText = (status) => {
  const map = {
    pending: '待处理',
    in_progress: '进行中',
    completed: '已完成'
  }
  return map[status] || status
}

const loadData = async () => {
  const [tasksRes, plotsRes, managersRes] = await Promise.all([
    harvestTaskApi.getAll(),
    plotApi.getAll(),
    managerApi.getAll()
  ])
  if (tasksRes.data.success) tasks.value = tasksRes.data.data
  if (plotsRes.data.success) plots.value = plotsRes.data.data
  if (managersRes.data.success) managers.value = managersRes.data.data
}

const openDialog = (row = null) => {
  isEdit.value = !!row
  if (row) {
    form.value = { ...row }
  } else {
    form.value = {
      plot_id: null,
      manager_id: null,
      harvest_date: '',
      crop_type: '',
      estimated_quantity: 0,
      actual_quantity: 0,
      status: 'pending',
      notes: ''
    }
  }
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!form.value.plot_id || !form.value.harvest_date) {
    ElMessage.warning('请填写必填项')
    return
  }
  try {
    let res
    if (isEdit.value) {
      res = await harvestTaskApi.update(form.value.id, form.value)
    } else {
      res = await harvestTaskApi.create(form.value)
    }
    if (res.data.success) {
      ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
      dialogVisible.value = false
      loadData()
    } else {
      ElMessage.error(res.data.message)
    }
  } catch (err) {
    ElMessage.error('操作失败')
  }
}

const createBatch = (row) => {
  sessionStorage.setItem('selectedHarvestTask', JSON.stringify(row))
  router.push('/batches')
}

const handleDelete = (row) => {
  ElMessageBox.confirm('确定要删除这个采收任务吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    const res = await harvestTaskApi.delete(row.id)
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
</style>
