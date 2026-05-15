<template>
  <div>
    <el-card shadow="never">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="搜索">
          <el-input v-model="searchForm.search" placeholder="名称/编码" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadMatters">查询</el-button>
          <el-button type="success" @click="openDialog">新增事项</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" style="margin-top: 20px">
      <el-table :data="matters" style="width: 100%">
        <el-table-column prop="code" label="事项编码" width="120" />
        <el-table-column prop="name" label="事项名称" />
        <el-table-column prop="department" label="所属部门" width="150" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'danger'">
              {{ row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="unresolved_gaps" label="未解决缺口" width="120" />
        <el-table-column prop="unresolved_exceptions" label="待处理异常" width="120" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="办事事项" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="事项编码">
          <el-input v-model="form.code" />
        </el-form-item>
        <el-form-item label="事项名称">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="所属部门">
          <el-input v-model="form.department" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option label="启用" value="active" />
            <el-option label="停用" value="inactive" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveMatter">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { mattersApi } from '../api'
import { ElMessage } from 'element-plus'

const searchForm = ref({
  search: ''
})
const matters = ref([])
const dialogVisible = ref(false)
const form = ref({})
const editId = ref(null)

const loadMatters = async () => {
  try {
    const res = await mattersApi.getMatters(searchForm.value)
    if (res.data.success) {
      matters.value = res.data.data
    }
  } catch (error) {
    ElMessage.error('加载失败')
  }
}

const openDialog = (row = null) => {
  if (row) {
    editId.value = row.id
    form.value = { ...row }
  } else {
    editId.value = null
    form.value = { status: 'active' }
  }
  dialogVisible.value = true
}

const saveMatter = async () => {
  try {
    if (editId.value) {
      await mattersApi.updateMatter(editId.value, { ...form.value, changedBy: 'admin' })
      ElMessage.success('更新成功')
    } else {
      await mattersApi.createMatter(form.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadMatters()
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

onMounted(() => {
  loadMatters()
})
</script>
