<template>
  <div class="customers-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>客户管理</span>
          <el-button type="primary" @click="showCreateDialog">新建客户</el-button>
        </div>
      </template>
      
      <div class="filter-section">
        <el-form :inline="true" :model="filters" class="demo-form-inline">
          <el-form-item label="客户类型">
            <el-select v-model="filters.type" placeholder="全部" clearable>
              <el-option label="个人" value="personal" />
              <el-option label="企业" value="enterprise" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadCustomers">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
      
      <el-table :data="customers" style="width: 100%;" v-loading="loading">
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="type" label="类型" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.type === 'enterprise' ? 'success' : 'primary'">
              {{ scope.row.type === 'enterprise' ? '企业' : '个人' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="company_name" label="企业名称" width="200" />
        <el-table-column prop="phone" label="联系电话" width="150" />
        <el-table-column prop="id_card" label="身份证号" width="180" />
        <el-table-column prop="created_at" label="创建时间" width="180" />
      </el-table>
    </el-card>
    
    <el-dialog v-model="createDialogVisible" title="新建客户" width="500px">
      <el-form :model="newCustomer" :rules="rules" ref="customerForm" label-width="100px">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="newCustomer.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-select v-model="newCustomer.type" placeholder="选择类型">
            <el-option label="个人" value="personal" />
            <el-option label="企业" value="enterprise" />
          </el-select>
        </el-form-item>
        <el-form-item label="联系电话">
          <el-input v-model="newCustomer.phone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="身份证号">
          <el-input v-model="newCustomer.id_card" placeholder="请输入身份证号" />
        </el-form-item>
        <el-form-item label="企业名称" v-if="newCustomer.type === 'enterprise'">
          <el-input v-model="newCustomer.company_name" placeholder="请输入企业名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createCustomer">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { customerApi } from '../api'

const loading = ref(false)
const customers = ref([])

const filters = reactive({
  type: ''
})

const createDialogVisible = ref(false)
const newCustomer = reactive({
  name: '',
  type: 'personal',
  phone: '',
  id_card: '',
  company_name: ''
})

const rules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }]
}

const loadCustomers = async () => {
  loading.value = true
  try {
    const params = {}
    if (filters.type) params.type = filters.type
    
    const res = await customerApi.getAll(params)
    customers.value = res.data
  } catch (error) {
    console.error('加载客户列表失败:', error)
    ElMessage.error('加载客户列表失败')
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.type = ''
  loadCustomers()
}

const showCreateDialog = () => {
  createDialogVisible.value = true
}

const createCustomer = async () => {
  try {
    await customerApi.create(newCustomer)
    ElMessage.success('客户创建成功')
    createDialogVisible.value = false
    Object.assign(newCustomer, {
      name: '',
      type: 'personal',
      phone: '',
      id_card: '',
      company_name: ''
    })
    loadCustomers()
  } catch (error) {
    console.error('创建客户失败:', error)
    ElMessage.error('创建客户失败')
  }
}

onMounted(() => {
  loadCustomers()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-section {
  margin-bottom: 20px;
}
</style>
