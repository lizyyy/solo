<template>
  <div>
    <h2 style="margin-bottom: 20px">药箱位置管理</h2>
    <el-button type="primary" @click="openDialog">新增药箱</el-button>
    <el-table :data="boxes" style="width: 100%; margin-top: 20px" border>
      <el-table-column prop="location_name" label="位置名称" />
      <el-table-column prop="address" label="详细地址" />
      <el-table-column prop="manager" label="负责人" />
      <el-table-column prop="phone" label="联系电话" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'">
            {{ row.status === 'active' ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button size="small" @click="editBox(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="药箱信息" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="位置名称">
          <el-input v-model="form.location_name" />
        </el-form-item>
        <el-form-item label="详细地址">
          <el-input v-model="form.address" />
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="form.manager" />
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="form.phone" />
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
        <el-button type="primary" @click="saveBox">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const boxes = ref([])
const dialogVisible = ref(false)
const form = ref({})
const editId = ref(null)

const loadData = async () => {
  const res = await axios.get('/api/boxes')
  boxes.value = res.data
}

const openDialog = () => {
  editId.value = null
  form.value = { status: 'active' }
  dialogVisible.value = true
}

const editBox = (row) => {
  editId.value = row.id
  form.value = { ...row }
  dialogVisible.value = true
}

const saveBox = async () => {
  try {
    if (editId.value) {
      await axios.put(`/api/boxes/${editId.value}`, form.value)
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/boxes', form.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (err) {
    ElMessage.error('操作失败')
  }
}

onMounted(() => {
  loadData()
})
</script>
