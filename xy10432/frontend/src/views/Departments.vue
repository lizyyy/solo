<template>
  <div class="departments-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>科室管理</span>
          <el-button type="primary" @click="showCreateDialog">新建科室</el-button>
        </div>
      </template>
      
      <el-table :data="departments" style="width: 100%;" v-loading="loading">
        <el-table-column prop="name" label="科室名称" width="150" />
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="daily_capacity" label="日容量" width="100" />
        <el-table-column prop="created_at" label="创建时间" width="180" />
      </el-table>
    </el-card>
    
    <el-dialog v-model="createDialogVisible" title="新建科室" width="500px">
      <el-form :model="newDepartment" :rules="rules" ref="departmentForm" label-width="100px">
        <el-form-item label="科室名称" prop="name">
          <el-input v-model="newDepartment.name" placeholder="请输入科室名称" />
        </el-form-item>
        <el-form-item label="日容量" prop="daily_capacity">
          <el-input-number v-model="newDepartment.daily_capacity" :min="1" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="newDepartment.description" type="textarea" placeholder="请输入描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createDepartment">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { departmentApi } from '../api'

const loading = ref(false)
const departments = ref([])

const createDialogVisible = ref(false)
const newDepartment = reactive({
  name: '',
  daily_capacity: 50,
  description: ''
})

const rules = {
  name: [{ required: true, message: '请输入科室名称', trigger: 'blur' }],
  daily_capacity: [{ required: true, message: '请输入日容量', trigger: 'blur' }]
}

const loadDepartments = async () => {
  loading.value = true
  try {
    const res = await departmentApi.getAll()
    departments.value = res.data
  } catch (error) {
    console.error('加载科室列表失败:', error)
    ElMessage.error('加载科室列表失败')
  } finally {
    loading.value = false
  }
}

const showCreateDialog = () => {
  createDialogVisible.value = true
}

const createDepartment = async () => {
  try {
    await departmentApi.create(newDepartment)
    ElMessage.success('科室创建成功')
    createDialogVisible.value = false
    Object.assign(newDepartment, {
      name: '',
      daily_capacity: 50,
      description: ''
    })
    loadDepartments()
  } catch (error) {
    console.error('创建科室失败:', error)
    ElMessage.error('创建科室失败')
  }
}

onMounted(() => {
  loadDepartments()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
