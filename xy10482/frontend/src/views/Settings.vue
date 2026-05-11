<template>
  <div class="settings-page">
    <el-row :gutter="20">
      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>分拣等级</span>
              <el-button type="primary" size="small" @click="openGradeDialog()">新增</el-button>
            </div>
          </template>
          <el-table :data="grades" border size="small">
            <el-table-column prop="name" label="名称"></el-table-column>
            <el-table-column prop="code" label="编码" width="80"></el-table-column>
            <el-table-column prop="sort_order" label="排序" width="60"></el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openGradeDialog(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>损耗原因</span>
              <el-button type="primary" size="small" @click="openLossDialog()">新增</el-button>
            </div>
          </template>
          <el-table :data="lossReasons" border size="small">
            <el-table-column prop="name" label="名称"></el-table-column>
            <el-table-column prop="description" label="描述"></el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openLossDialog(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>采收负责人</span>
              <el-button type="primary" size="small" @click="openManagerDialog()">新增</el-button>
            </div>
          </template>
          <el-table :data="managers" border size="small">
            <el-table-column prop="name" label="姓名"></el-table-column>
            <el-table-column prop="phone" label="电话" width="120"></el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openManagerDialog(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="gradeDialogVisible" :title="isEditGrade ? '编辑等级' : '新增等级'" width="450px">
      <el-form :model="gradeForm" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="gradeForm.name"></el-input>
        </el-form-item>
        <el-form-item label="编码">
          <el-input v-model="gradeForm.code"></el-input>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="gradeForm.sort_order" :min="0" style="width: 100%"></el-input-number>
        </el-form-item>
        <el-form-item label="描述">
          <el-input type="textarea" v-model="gradeForm.description" :rows="2"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="gradeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitGrade">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="lossDialogVisible" :title="isEditLoss ? '编辑损耗原因' : '新增损耗原因'" width="450px">
      <el-form :model="lossForm" label-width="80px">
        <el-form-item label="名称" required>
          <el-input v-model="lossForm.name"></el-input>
        </el-form-item>
        <el-form-item label="描述">
          <el-input type="textarea" v-model="lossForm.description" :rows="2"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="lossDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitLoss">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="managerDialogVisible" :title="isEditManager ? '编辑负责人' : '新增负责人'" width="450px">
      <el-form :model="managerForm" label-width="80px">
        <el-form-item label="姓名" required>
          <el-input v-model="managerForm.name"></el-input>
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="managerForm.phone"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="managerDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitManager">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { gradeApi, lossReasonApi, managerApi } from '../api'

const grades = ref([])
const lossReasons = ref([])
const managers = ref([])

const gradeDialogVisible = ref(false)
const isEditGrade = ref(false)
const gradeForm = ref({ name: '', code: '', sort_order: 0, description: '' })

const lossDialogVisible = ref(false)
const isEditLoss = ref(false)
const lossForm = ref({ name: '', description: '' })

const managerDialogVisible = ref(false)
const isEditManager = ref(false)
const managerForm = ref({ name: '', phone: '' })

const loadData = async () => {
  const [gradeRes, lossRes, managerRes] = await Promise.all([
    gradeApi.getAll(),
    lossReasonApi.getAll(),
    managerApi.getAll()
  ])
  if (gradeRes.data.success) grades.value = gradeRes.data.data
  if (lossRes.data.success) lossReasons.value = lossRes.data.data
  if (managerRes.data.success) managers.value = managerRes.data.data
}

const openGradeDialog = (row = null) => {
  isEditGrade.value = !!row
  gradeForm.value = row ? { ...row } : { name: '', code: '', sort_order: 0, description: '' }
  gradeDialogVisible.value = true
}

const submitGrade = async () => {
  if (!gradeForm.value.name) {
    ElMessage.warning('请输入名称')
    return
  }
  const res = isEditGrade.value 
    ? await gradeApi.update(gradeForm.value.id, gradeForm.value)
    : await gradeApi.create(gradeForm.value)
  if (res.data.success) {
    ElMessage.success('操作成功')
    gradeDialogVisible.value = false
    loadData()
  } else {
    ElMessage.error(res.data.message)
  }
}

const openLossDialog = (row = null) => {
  isEditLoss.value = !!row
  lossForm.value = row ? { ...row } : { name: '', description: '' }
  lossDialogVisible.value = true
}

const submitLoss = async () => {
  if (!lossForm.value.name) {
    ElMessage.warning('请输入名称')
    return
  }
  const res = isEditLoss.value 
    ? await lossReasonApi.update(lossForm.value.id, lossForm.value)
    : await lossReasonApi.create(lossForm.value)
  if (res.data.success) {
    ElMessage.success('操作成功')
    lossDialogVisible.value = false
    loadData()
  } else {
    ElMessage.error(res.data.message)
  }
}

const openManagerDialog = (row = null) => {
  isEditManager.value = !!row
  managerForm.value = row ? { ...row } : { name: '', phone: '' }
  managerDialogVisible.value = true
}

const submitManager = async () => {
  if (!managerForm.value.name) {
    ElMessage.warning('请输入姓名')
    return
  }
  const res = isEditManager.value 
    ? await managerApi.update(managerForm.value.id, managerForm.value)
    : await managerApi.create(managerForm.value)
  if (res.data.success) {
    ElMessage.success('操作成功')
    managerDialogVisible.value = false
    loadData()
  } else {
    ElMessage.error(res.data.message)
  }
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

.settings-page > .el-row > .el-col > .el-card {
  margin-bottom: 20px;
}
</style>
