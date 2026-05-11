<template>
  <div class="appointments-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>预约列表</span>
          <el-button type="primary" @click="showCreateDialog">新建预约</el-button>
        </div>
      </template>
      
      <div class="filter-section">
        <el-form :inline="true" :model="filters" class="demo-form-inline">
          <el-form-item label="日期">
            <el-date-picker
              v-model="filters.date"
              type="date"
              placeholder="选择日期"
              value-format="YYYY-MM-DD"
            />
          </el-form-item>
          <el-form-item label="客户类型">
            <el-select v-model="filters.customer_type" placeholder="全部" clearable>
              <el-option label="个人" value="personal" />
              <el-option label="企业" value="enterprise" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadAppointments">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
      
      <el-table :data="appointments" style="width: 100%;" v-loading="loading">
        <el-table-column prop="customer_name" label="客户姓名" width="120" />
        <el-table-column prop="customer_type" label="客户类型" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.customer_type === 'enterprise' ? 'success' : 'primary'">
              {{ scope.row.customer_type === 'enterprise' ? '企业' : '个人' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="company_name" label="企业名称" width="150" />
        <el-table-column prop="package_name" label="套餐名称" width="200" />
        <el-table-column prop="appointment_date" label="预约日期" width="120" />
        <el-table-column prop="total_amount" label="总金额" width="100">
          <template #default="scope">
            ¥{{ scope.row.total_amount }}
          </template>
        </el-table-column>
        <el-table-column prop="paid_amount" label="已付金额" width="100">
          <template #default="scope">
            ¥{{ scope.row.paid_amount }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row)">
              {{ getStatusText(scope.row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button link type="primary" @click="goToDetail(scope.row.id)">详情</el-button>
            <el-button link type="warning" @click="openPaymentDialog(scope.row)" :disabled="scope.row.total_amount <= scope.row.paid_amount">缴费</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <el-dialog v-model="createDialogVisible" title="新建预约" width="600px">
      <el-form :model="newAppointment" :rules="rules" ref="appointmentForm" label-width="100px">
        <el-form-item label="客户" prop="customer_id">
          <el-select v-model="newAppointment.customer_id" placeholder="选择客户" style="width: 100%;">
            <el-option
              v-for="customer in customers"
              :key="customer.id"
              :label="customer.type === 'enterprise' ? customer.name + ' (' + customer.company_name + ')' : customer.name + ' (个人)'"
              :value="customer.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="套餐" prop="package_id">
          <el-select v-model="newAppointment.package_id" placeholder="选择套餐" style="width: 100%;">
            <el-option
              v-for="pkg in packages"
              :key="pkg.id"
              :label="pkg.name + ' - ¥' + pkg.base_price"
              :value="pkg.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="预约日期" prop="appointment_date">
          <el-date-picker
            v-model="newAppointment.appointment_date"
            type="date"
            placeholder="选择日期"
            value-format="YYYY-MM-DD"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="已付金额">
          <el-input-number v-model="newAppointment.paid_amount" :min="0" :precision="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createAppointment">确定</el-button>
      </template>
    </el-dialog>
    
    <el-dialog v-model="paymentDialogVisible" title="缴费" width="500px">
      <div v-if="currentAppointment">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="客户">{{ currentAppointment.customer_name }}</el-descriptions-item>
          <el-descriptions-item label="套餐">{{ currentAppointment.package_name }}</el-descriptions-item>
          <el-descriptions-item label="总金额">¥{{ currentAppointment.total_amount }}</el-descriptions-item>
          <el-descriptions-item label="已付金额">¥{{ currentAppointment.paid_amount }}</el-descriptions-item>
          <el-descriptions-item label="应付金额">¥{{ currentAppointment.total_amount - currentAppointment.paid_amount }}</el-descriptions-item>
        </el-descriptions>
        <el-form :model="paymentForm" label-width="100px" style="margin-top: 20px;">
          <el-form-item label="缴费金额">
            <el-input-number v-model="paymentForm.amount" :min="0" :max="currentAppointment.total_amount - currentAppointment.paid_amount" :precision="2" />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="paymentForm.description" placeholder="可选" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="paymentDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="processPayment">确认缴费</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { appointmentApi, customerApi, packageApi, paymentApi, staffApi } from '../api'

const router = useRouter()
const loading = ref(false)
const appointments = ref([])
const customers = ref([])
const packages = ref([])
const staffList = ref([])

const filters = reactive({
  date: new Date().toISOString().split('T')[0],
  customer_type: ''
})

const createDialogVisible = ref(false)
const newAppointment = reactive({
  customer_id: '',
  package_id: '',
  appointment_date: new Date().toISOString().split('T')[0],
  paid_amount: 0
})

const rules = {
  customer_id: [{ required: true, message: '请选择客户', trigger: 'change' }],
  package_id: [{ required: true, message: '请选择套餐', trigger: 'change' }],
  appointment_date: [{ required: true, message: '请选择日期', trigger: 'change' }]
}

const paymentDialogVisible = ref(false)
const currentAppointment = ref(null)
const paymentForm = reactive({
  amount: 0,
  description: ''
})

const loadAppointments = async () => {
  loading.value = true
  try {
    const params = {}
    if (filters.date) params.date = filters.date
    if (filters.customer_type) params.customer_type = filters.customer_type
    
    const res = await appointmentApi.getAll(params)
    appointments.value = res.data
  } catch (error) {
    console.error('加载预约列表失败:', error)
    ElMessage.error('加载预约列表失败')
  } finally {
    loading.value = false
  }
}

const loadCustomers = async () => {
  try {
    const res = await customerApi.getAll()
    customers.value = res.data
  } catch (error) {
    console.error('加载客户列表失败:', error)
  }
}

const loadPackages = async () => {
  try {
    const res = await packageApi.getAll()
    packages.value = res.data
  } catch (error) {
    console.error('加载套餐列表失败:', error)
  }
}

const loadStaff = async () => {
  try {
    const res = await staffApi.getAll()
    staffList.value = res.data
  } catch (error) {
    console.error('加载员工列表失败:', error)
  }
}

const resetFilters = () => {
  filters.date = new Date().toISOString().split('T')[0]
  filters.customer_type = ''
  loadAppointments()
}

const showCreateDialog = () => {
  createDialogVisible.value = true
}

const createAppointment = async () => {
  try {
    await appointmentApi.create(newAppointment)
    ElMessage.success('预约创建成功')
    createDialogVisible.value = false
    loadAppointments()
  } catch (error) {
    console.error('创建预约失败:', error)
    ElMessage.error('创建预约失败')
  }
}

const goToDetail = (id) => {
  router.push(`/appointments/${id}`)
}

const getStatusType = (row) => {
  if (row.total_amount <= row.paid_amount) {
    return 'success'
  }
  return 'warning'
}

const getStatusText = (row) => {
  if (row.total_amount <= row.paid_amount) {
    return '已结清'
  }
  return '待缴费'
}

const openPaymentDialog = (appointment) => {
  currentAppointment.value = appointment
  paymentForm.amount = appointment.total_amount - appointment.paid_amount
  paymentForm.description = ''
  paymentDialogVisible.value = true
}

const processPayment = async () => {
  if (!staffList.value || staffList.value.length === 0) {
    ElMessage.error('请先选择操作人')
    return
  }
  
  const staff = staffList.value[0]
  
  try {
    await paymentApi.pay({
      appointment_id: currentAppointment.value.id,
      amount: paymentForm.amount,
      description: paymentForm.description,
      staff_id: staff.id,
      staff_name: staff.name
    })
    ElMessage.success('缴费成功')
    paymentDialogVisible.value = false
    loadAppointments()
  } catch (error) {
    console.error('缴费失败:', error)
    ElMessage.error(error.response?.data?.error || '缴费失败')
  }
}

onMounted(() => {
  loadAppointments()
  loadCustomers()
  loadPackages()
  loadStaff()
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
