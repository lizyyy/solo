<template>
  <div class="plots-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>地块列表</span>
          <el-button type="primary" @click="openDialog()">
            <el-icon><Plus /></el-icon>
            新增地块
          </el-button>
        </div>
      </template>
      <el-table :data="plots" border>
        <el-table-column prop="name" label="地块名称" width="150"></el-table-column>
        <el-table-column prop="area" label="面积(亩)" width="120"></el-table-column>
        <el-table-column prop="crop_type" label="作物类型"></el-table-column>
        <el-table-column prop="location" label="位置"></el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
              {{ row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180"></el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑地块' : '新增地块'" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="地块名称" required>
          <el-input v-model="form.name" placeholder="请输入地块名称"></el-input>
        </el-form-item>
        <el-form-item label="面积">
          <el-input-number v-model="form.area" :min="0" :step="0.1" controls-position="right"></el-input-number>
          <span class="ml-2">亩</span>
        </el-form-item>
        <el-form-item label="作物类型">
          <el-input v-model="form.crop_type" placeholder="例：草莓、蔬菜"></el-input>
        </el-form-item>
        <el-form-item label="位置">
          <el-input v-model="form.location" placeholder="请输入位置"></el-input>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option label="启用" value="active"></el-option>
            <el-option label="停用" value="inactive"></el-option>
          </el-select>
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { plotApi } from '../api'

const plots = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const form = ref({
  name: '',
  area: 0,
  crop_type: '',
  location: '',
  status: 'active'
})

const loadData = async () => {
  const res = await plotApi.getAll()
  if (res.data.success) {
    plots.value = res.data.data
  }
}

const openDialog = (row = null) => {
  isEdit.value = !!row
  if (row) {
    form.value = { ...row }
  } else {
    form.value = {
      name: '',
      area: 0,
      crop_type: '',
      location: '',
      status: 'active'
    }
  }
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!form.value.name) {
    ElMessage.warning('请输入地块名称')
    return
  }
  
  try {
    let res
    if (isEdit.value) {
      res = await plotApi.update(form.value.id, form.value)
    } else {
      res = await plotApi.create(form.value)
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

const handleDelete = (row) => {
  ElMessageBox.confirm('确定要删除这个地块吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    const res = await plotApi.delete(row.id)
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

.ml-2 {
  margin-left: 8px;
}
</style>
