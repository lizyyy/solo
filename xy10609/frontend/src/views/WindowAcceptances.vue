<template>
  <div>
    <el-card shadow="never">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="受理结果">
          <el-select v-model="searchForm.material_check_result" clearable placeholder="全部">
            <el-option label="待审核" value="pending" />
            <el-option label="通过" value="passed" />
            <el-option label="材料不全" value="incomplete" />
            <el-option label="驳回" value="rejected" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadAcceptances">查询</el-button>
          <el-button type="success" @click="openDialog">新增受理记录</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" style="margin-top: 20px;">
      <el-table :data="acceptances" style="width: 100%;">
        <el-table-column prop="matter_name" label="所属事项" width="150" />
        <el-table-column prop="window_no" label="窗口号" width="100" />
        <el-table-column prop="acceptor" label="受理人" width="120" />
        <el-table-column prop="material_check_result" label="受理结果" width="120">
          <template #default="{ row }">
            <el-tag :type="getResultType(row.material_check_result)">
              {{ getResultText(row.material_check_result) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remarks" label="备注" min-width="200" />
        <el-table-column prop="accept_time" label="受理时间" width="180" />
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteAcceptance(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="窗口受理" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="所属事项">
          <el-select v-model="form.matter_id" style="width: 100%;">
            <el-option v-for="m in matters" :key="m.id" :label="m.name" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="窗口号">
          <el-input v-model="form.window_no" />
        </el-form-item>
        <el-form-item label="受理人">
          <el-input v-model="form.acceptor" />
        </el-form-item>
        <el-form-item label="受理结果">
          <el-select v-model="form.material_check_result" style="width: 100%;">
            <el-option label="待审核" value="pending" />
            <el-option label="通过" value="passed" />
            <el-option label="材料不全" value="incomplete" />
            <el-option label="驳回" value="rejected" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remarks" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveAcceptance">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { windowAcceptancesApi, mattersApi } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'

const searchForm = ref({ material_check_result: '' })
const acceptances = ref([])
const matters = ref([])
const dialogVisible = ref(false)
const form = ref({})
const editId = ref(null)

const loadAcceptances = async () => {
  try {
    const res = await windowAcceptancesApi.getAcceptances(searchForm.value)
    if (res.data.success) {
      acceptances.value = res.data.data
    }
  } catch (error) {
    ElMessage.error('加载失败')
  }
}

const openDialog = (row = null) => {
  if (row) {
    editId.value = row.id
    form.value = {
      matter_id: row.matter_id,
      window_no: row.window_no,
      acceptor: row.acceptor,
      material_check_result: row.material_check_result,
      remarks: row.remarks
    }
  } else {
    editId.value = null
    form.value = { material_check_result: 'pending' }
  }
  dialogVisible.value = true
}

const saveAcceptance = async () => {
  try {
    if (editId.value) {
      await windowAcceptancesApi.updateAcceptance(editId.value, form.value)
      ElMessage.success('更新成功')
    } else {
      await windowAcceptancesApi.createAcceptance(form.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadAcceptances()
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

const deleteAcceptance = async (id) => {
  try {
    await ElMessageBox.confirm('确定删除该受理记录？', '提示')
    await windowAcceptancesApi.deleteAcceptance(id)
    ElMessage.success('删除成功')
    loadAcceptances()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('删除失败')
  }
}

const getResultText = (result) => {
  const map = {
    pending: '待审核',
    passed: '通过',
    incomplete: '材料不全',
    rejected: '驳回'
  }
  return map[result] || result
}

const getResultType = (result) => {
  const map = {
    pending: 'info',
    passed: 'success',
    incomplete: 'warning',
    rejected: 'danger'
  }
  return map[result] || 'info'
}

onMounted(async () => {
  loadAcceptances()
  const mRes = await mattersApi.getMatters({})
  if (mRes.data.success) matters.value = mRes.data.data
})
</script>
