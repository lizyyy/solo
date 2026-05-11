<template>
  <div class="items-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>项目管理</span>
          <el-button type="primary" @click="showCreateDialog">新建项目</el-button>
        </div>
      </template>
      
      <el-table :data="items" style="width: 100%;" v-loading="loading">
        <el-table-column prop="name" label="项目名称" width="200" />
        <el-table-column prop="department_name" label="所属科室" width="150" />
        <el-table-column prop="price" label="价格" width="100">
          <template #default="scope">
            ¥{{ scope.row.price }}
          </template>
        </el-table-column>
        <el-table-column label="是否可加" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.is_addable ? 'success' : 'info'">
              {{ scope.row.is_addable ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" />
        <el-table-column prop="created_at" label="创建时间" width="180" />
      </el-table>
    </el-card>
    
    <el-dialog v-model="createDialogVisible" title="新建项目" width="500px">
      <el-form :model="newItem" :rules="rules" ref="itemForm" label-width="100px">
        <el-form-item label="项目名称" prop="name">
          <el-input v-model="newItem.name" placeholder="请输入项目名称" />
        </el-form-item>
        <el-form-item label="所属科室" prop="department_id">
          <el-select v-model="newItem.department_id" placeholder="选择科室" style="width: 100%;">
            <el-option
              v-for="dept in departments"
              :key="dept.id"
              :label="dept.name"
              :value="dept.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="价格" prop="price">
          <el-input-number v-model="newItem.price" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="是否可加">
          <el-switch v-model="newItem.is_addable" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="newItem.description" type="textarea" placeholder="请输入描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createItem">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { itemApi, departmentApi } from '../api'

const loading = ref(false)
const items = ref([])
const departments = ref([])

const createDialogVisible = ref(false)
const newItem = reactive({
  name: '',
  department_id: '',
  price: 0,
  is_addable: true,
  description: ''
})

const rules = {
  name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
  department_id: [{ required: true, message: '请选择科室', trigger: 'change' }],
  price: [{ required: true, message: '请输入价格', trigger: 'blur' }]
}

const loadItems = async () => {
  loading.value = true
  try {
    const res = await itemApi.getAll()
    items.value = res.data
  } catch (error) {
    console.error('加载项目列表失败:', error)
    ElMessage.error('加载项目列表失败')
  } finally {
    loading.value = false
  }
}

const loadDepartments = async () => {
  try {
    const res = await departmentApi.getAll()
    departments.value = res.data
  } catch (error) {
    console.error('加载科室列表失败:', error)
  }
}

const showCreateDialog = () => {
  createDialogVisible.value = true
}

const createItem = async () => {
  try {
    await itemApi.create(newItem)
    ElMessage.success('项目创建成功')
    createDialogVisible.value = false
    Object.assign(newItem, {
      name: '',
      department_id: '',
      price: 0,
      is_addable: true,
      description: ''
    })
    loadItems()
  } catch (error) {
    console.error('创建项目失败:', error)
    ElMessage.error('创建项目失败')
  }
}

onMounted(() => {
  loadItems()
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
