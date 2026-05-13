<template>
  <div>
    <h2 style="margin-bottom: 20px">员工管理</h2>

    <el-button type="primary" @click="showCreateDialog" style="margin-bottom: 20px">
      新增员工
    </el-button>

    <el-table :data="staffList" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="name" label="姓名" width="150" />
      <el-table-column prop="phone" label="电话" width="150" />
      <el-table-column prop="skills" label="技能" width="300" />
      <el-table-column prop="status" label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'">
            {{ row.status === 'active' ? '在职' : '离职' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="180">
        <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button size="small" @click="editStaff(row)" type="primary">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑员工' : '新增员工'" width="500px">
      <el-form :model="staffForm" label-width="100px">
        <el-form-item label="姓名">
          <el-input v-model="staffForm.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="staffForm.phone" placeholder="请输入电话" />
        </el-form-item>
        <el-form-item label="技能">
          <el-input v-model="staffForm.skills" placeholder="多个技能用逗号分隔，如：清洁,巡检" />
        </el-form-item>
        <el-form-item label="状态" v-if="isEdit">
          <el-select v-model="staffForm.status" style="width: 100%">
            <el-option label="在职" value="active" />
            <el-option label="离职" value="inactive" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveStaff">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { staffAPI } from '../api'

const staffList = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref(null)
const staffForm = ref({
  name: '',
  phone: '',
  skills: '',
  status: 'active'
})

const loadStaff = async () => {
  try {
    const res = await staffAPI.list()
    staffList.value = res.data
  } catch (err) {
    ElMessage.error('加载失败')
  }
}

const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

const showCreateDialog = () => {
  isEdit.value = false
  staffForm.value = { name: '', phone: '', skills: '', status: 'active' }
  dialogVisible.value = true
}

const editStaff = (row) => {
  isEdit.value = true
  editingId.value = row.id
  staffForm.value = { ...row }
  dialogVisible.value = true
}

const saveStaff = async () => {
  if (!staffForm.value.name) {
    ElMessage.warning('请输入姓名')
    return
  }
  try {
    if (isEdit.value) {
      await staffAPI.update(editingId.value, staffForm.value)
      ElMessage.success('更新成功')
    } else {
      await staffAPI.create(staffForm.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadStaff()
  } catch (err) {
    ElMessage.error('操作失败')
  }
}

onMounted(() => {
  loadStaff()
})
</script>
