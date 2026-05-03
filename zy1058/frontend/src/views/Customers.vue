<template>
  <div class="customers-page">
    <div class="page-header">
      <h2>客户管理</h2>
      <el-button type="primary" @click="showCreate = true">
        <el-icon><Plus /></el-icon>
        新建客户
      </el-button>
    </div>

    <el-card class="card-container">
      <el-table :data="customers" v-loading="loading" style="width: 100%">
        <el-table-column prop="name" label="客户名称" min-width="150" />
        <el-table-column prop="phone" label="电话" width="140" />
        <el-table-column prop="email" label="邮箱" min-width="180" />
        <el-table-column prop="artwork_count" label="作品数" width="80" align="center">
          <template #default="scope">
            <el-tag size="small" type="info">{{ scope.row.artwork_count }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="notes" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button type="primary" size="small" link @click="viewArtworks(scope.row)">
              <el-icon><Picture /></el-icon>
              作品
            </el-button>
            <el-button type="primary" size="small" link @click="editCustomer(scope.row)">
              <el-icon><Edit /></el-icon>
              编辑
            </el-button>
            <el-button 
              type="danger" 
              size="small" 
              link 
              @click="deleteCustomer(scope.row)"
              :disabled="scope.row.artwork_count > 0"
            >
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showCreate" :title="editingCustomer ? '编辑客户' : '新建客户'" width="500px">
      <el-form :model="customerForm" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="customerForm.name" placeholder="请输入客户姓名" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="customerForm.phone" placeholder="请输入电话号码" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="customerForm.email" placeholder="请输入邮箱地址" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="customerForm.notes" type="textarea" :rows="3" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" @click="saveCustomer" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showArtworks" title="客户作品" width="800px">
      <div v-if="currentCustomer">
        <div style="margin-bottom: 16px; padding: 12px; background: #f5f7fa; border-radius: 6px;">
          <strong>{{ currentCustomer.name }}</strong>
          <span v-if="currentCustomer.phone" style="margin-left: 20px; color: #909399;">
            电话: {{ currentCustomer.phone }}
          </span>
        </div>
        <el-table :data="customerArtworks" v-loading="loadingArtworks" style="width: 100%">
          <el-table-column prop="name" label="作品名称" />
          <el-table-column prop="clay_name" label="泥料" width="120" />
          <el-table-column prop="glaze_name" label="釉料" width="120" />
          <el-table-column prop="delivery_date" label="交付日期" width="120" />
          <el-table-column label="状态" width="100">
            <template #default="scope">
              <el-tag :type="getStatusType(scope.row.status)" size="small">
                {{ getStatusLabel(scope.row.status) }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Plus, Edit, Delete, Picture } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { customersApi } from '../api/customers'

const loading = ref(false)
const saving = ref(false)
const customers = ref([])

const showCreate = ref(false)
const editingCustomer = ref(null)
const customerForm = reactive({
  name: '',
  phone: '',
  email: '',
  notes: ''
})

const showArtworks = ref(false)
const currentCustomer = ref(null)
const customerArtworks = ref([])
const loadingArtworks = ref(false)

const formRef = ref(null)

const rules = {
  name: [{ required: true, message: '请输入客户姓名', trigger: 'blur' }]
}

const STATUS_LABELS = {
  pending: '待排',
  in_kiln: '已入窑',
  firing: '烧成中',
  out_kiln: '已出窑',
  delivered: '已交付',
  failed: '烧制失败',
  cancelled: '已取消'
}

const STATUS_TYPES = {
  pending: 'info',
  in_kiln: 'primary',
  firing: 'warning',
  out_kiln: 'success',
  delivered: '',
  failed: 'danger',
  cancelled: 'info'
}

const getStatusLabel = (status) => STATUS_LABELS[status] || status
const getStatusType = (status) => STATUS_TYPES[status] || ''

const loadCustomers = async () => {
  loading.value = true
  try {
    const res = await customersApi.getAll()
    customers.value = res.data
  } catch (error) {
    ElMessage.error('加载客户列表失败')
  } finally {
    loading.value = false
  }
}

const editCustomer = (customer) => {
  editingCustomer.value = customer
  customerForm.name = customer.name
  customerForm.phone = customer.phone
  customerForm.email = customer.email
  customerForm.notes = customer.notes
  showCreate.value = true
}

const saveCustomer = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    
    saving.value = true
    try {
      if (editingCustomer.value) {
        await customersApi.update(editingCustomer.value.id, customerForm)
        ElMessage.success('更新成功')
      } else {
        await customersApi.create(customerForm)
        ElMessage.success('创建成功')
      }
      showCreate.value = false
      resetForm()
      loadCustomers()
    } catch (error) {
      ElMessage.error('保存失败')
    } finally {
      saving.value = false
    }
  })
}

const resetForm = () => {
  editingCustomer.value = null
  customerForm.name = ''
  customerForm.phone = ''
  customerForm.email = ''
  customerForm.notes = ''
}

const deleteCustomer = async (customer) => {
  try {
    await ElMessageBox.confirm(`确定要删除客户"${customer.name}"吗？`, '确认删除', {
      type: 'warning'
    })
    await customersApi.delete(customer.id)
    ElMessage.success('删除成功')
    loadCustomers()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '删除失败')
    }
  }
}

const viewArtworks = async (customer) => {
  currentCustomer.value = customer
  showArtworks.value = true
  loadingArtworks.value = true
  
  try {
    const res = await customersApi.getById(customer.id)
    const artworksRes = await fetch(`/api/customers/${customer.id}/artworks`)
    if (artworksRes.ok) {
      customerArtworks.value = await artworksRes.json()
    }
  } catch (error) {
    console.error('加载客户作品失败:', error)
  } finally {
    loadingArtworks.value = false
  }
}

onMounted(() => {
  loadCustomers()
})
</script>

<style scoped>
.customers-page {
  min-height: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
}
</style>
