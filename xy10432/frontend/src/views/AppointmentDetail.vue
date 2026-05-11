<template>
  <div class="appointment-detail-page">
    <el-button @click="goBack" style="margin-bottom: 20px;">
      <el-icon><ArrowLeft /></el-icon>
      返回
    </el-button>
    
    <el-card v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>预约详情</span>
          <div>
            <el-button type="primary" @click="showAddItemDialog" :disabled="appointment?.status === 'completed'">加项</el-button>
            <el-button type="warning" @click="showPaymentDialog" :disabled="!appointment || appointment.total_amount <= appointment.paid_amount">缴费</el-button>
          </div>
        </div>
      </template>
      
      <div v-if="appointment">
        <el-descriptions :column="3" border style="margin-bottom: 20px;">
          <el-descriptions-item label="客户姓名">{{ appointment.customer_name }}</el-descriptions-item>
          <el-descriptions-item label="客户类型">
            <el-tag :type="appointment.customer_type === 'enterprise' ? 'success' : 'primary'">
              {{ appointment.customer_type === 'enterprise' ? '企业' : '个人' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="企业名称">{{ appointment.company_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="联系电话">{{ appointment.phone }}</el-descriptions-item>
          <el-descriptions-item label="身份证号">{{ appointment.id_card }}</el-descriptions-item>
          <el-descriptions-item label="预约日期">{{ appointment.appointment_date }}</el-descriptions-item>
          <el-descriptions-item label="套餐">{{ appointment.package_name }}</el-descriptions-item>
          <el-descriptions-item label="总金额">
            <span style="font-size: 18px; font-weight: bold; color: #f56c6c;">¥{{ appointment.total_amount }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="已付金额">
            <span style="font-size: 18px; font-weight: bold; color: #67c23a;">¥{{ appointment.paid_amount }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="待付金额" :span="3">
            <span style="font-size: 20px; font-weight: bold; color: #e6a23c;">
              ¥{{ (appointment.total_amount - appointment.paid_amount).toFixed(2) }}
            </span>
          </el-descriptions-item>
        </el-descriptions>
        
        <el-tabs v-model="activeTab">
          <el-tab-pane label="项目状态" name="items">
            <el-table :data="appointment.items" style="width: 100%;">
              <el-table-column prop="item_name" label="项目名称" width="200" />
              <el-table-column label="项目类型" width="100">
                <template #default="scope">
                  <el-tag :type="scope.row.item_type === 'add' ? 'warning' : 'info'">
                    {{ scope.row.item_type === 'add' ? '加项' : '套餐' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="department_name" label="所属科室" width="150" />
              <el-table-column prop="price" label="价格" width="100">
                <template #default="scope">
                  ¥{{ scope.row.price }}
                </template>
              </el-table-column>
              <el-table-column label="报告状态" width="120">
                <template #default="scope">
                  <el-tag :type="scope.row.report_issued ? 'success' : 'info'">
                    {{ scope.row.report_issued ? '已出报告' : '待检查' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="检查状态" width="120">
                <template #default="scope">
                  <el-tag :type="scope.row.status === 'completed' ? 'success' : scope.row.status === 'in_progress' ? 'warning' : 'info'">
                    {{ scope.row.status === 'completed' ? '已完成' : scope.row.status === 'in_progress' ? '检查中' : '待检查' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="200">
                <template #default="scope">
                  <el-button 
                    link 
                    type="danger" 
                    @click="confirmRemoveItem(scope.row)"
                    :disabled="scope.row.item_type === 'package' || scope.row.report_issued"
                  >
                    退项
                  </el-button>
                  <el-button 
                    link 
                    type="primary" 
                    @click="toggleReportStatus(scope.row)"
                  >
                    {{ scope.row.report_issued ? '重置报告' : '出具报告' }}
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
          
          <el-tab-pane label="差价流水" name="transactions">
            <el-table :data="appointment.transactions" style="width: 100%;">
              <el-table-column prop="created_at" label="时间" width="180" />
              <el-table-column label="类型" width="100">
                <template #default="scope">
                  <el-tag :type="scope.row.type === 'payment' || scope.row.type === 'initial_payment' ? 'success' : 'danger'">
                    {{ scope.row.type === 'payment' ? '缴费' : scope.row.type === 'initial_payment' ? '套餐费' : '退款' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="amount" label="金额" width="100">
                <template #default="scope">
                  <span :style="{ color: scope.row.type === 'refund' ? '#f56c6c' : '#67c23a' }">
                    {{ scope.row.type === 'refund' ? '-' : '+' }}¥{{ scope.row.amount }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="description" label="描述" width="200" />
              <el-table-column prop="staff_name" label="操作人" width="120" />
            </el-table>
          </el-tab-pane>
          
          <el-tab-pane label="加退项记录" name="records">
            <el-table :data="appointment.addRemoveRecords" style="width: 100%;">
              <el-table-column prop="created_at" label="时间" width="180" />
              <el-table-column prop="item_name" label="项目" width="200" />
              <el-table-column label="操作" width="100">
                <template #default="scope">
                  <el-tag :type="scope.row.action === 'add' ? 'success' : 'danger'">
                    {{ scope.row.action === 'add' ? '加项' : '退项' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="price" label="金额" width="100">
                <template #default="scope">
                  <span :style="{ color: scope.row.action === 'remove' ? '#f56c6c' : '#67c23a' }">
                    {{ scope.row.action === 'remove' ? '-' : '+' }}¥{{ scope.row.price }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="staff_name" label="确认人" width="120" />
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-card>
    
    <el-dialog v-model="addItemDialogVisible" title="选择加项项目" width="700px">
      <el-table :data="addableItems" style="width: 100%;" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" />
        <el-table-column prop="name" label="项目名称" width="200" />
        <el-table-column prop="department_name" label="所属科室" width="150" />
        <el-table-column prop="price" label="价格" width="100">
          <template #default="scope">
            ¥{{ scope.row.price }}
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" />
      </el-table>
      <div style="margin-top: 20px; text-align: right;">
        <span style="margin-right: 20px;">已选项目金额：<strong style="color: #f56c6c;">¥{{ selectedItemsTotal }}</strong></span>
      </div>
      <template #footer>
        <el-button @click="addItemDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmAddItems" :disabled="selectedItems.length === 0">确认加项</el-button>
      </template>
    </el-dialog>
    
    <el-dialog v-model="paymentDialogVisible" title="缴费" width="500px">
      <div v-if="appointment">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="总金额">¥{{ appointment.total_amount }}</el-descriptions-item>
          <el-descriptions-item label="已付金额">¥{{ appointment.paid_amount }}</el-descriptions-item>
          <el-descriptions-item label="应付金额">
            <span style="color: #f56c6c; font-weight: bold;">¥{{ (appointment.total_amount - appointment.paid_amount).toFixed(2) }}</span>
          </el-descriptions-item>
        </el-descriptions>
        <el-form :model="paymentForm" label-width="100px" style="margin-top: 20px;">
          <el-form-item label="缴费金额">
            <el-input-number 
              v-model="paymentForm.amount" 
              :min="0" 
              :max="appointment.total_amount - appointment.paid_amount" 
              :precision="2"
              style="width: 100%;"
            />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="paymentForm.description" placeholder="可选" type="textarea" />
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
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { appointmentApi, itemApi, addRemoveApi, paymentApi, staffApi } from '../api'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const appointment = ref(null)
const addableItems = ref([])
const activeTab = ref('items')

const addItemDialogVisible = ref(false)
const selectedItems = ref([])
const selectedItemsTotal = computed(() => {
  return selectedItems.value.reduce((sum, item) => sum + item.price, 0).toFixed(2)
})

const paymentDialogVisible = ref(false)
const paymentForm = reactive({
  amount: 0,
  description: ''
})

const staffList = ref([])

const loadAppointment = async () => {
  loading.value = true
  try {
    const res = await appointmentApi.getById(route.params.id)
    appointment.value = res.data
  } catch (error) {
    console.error('加载预约详情失败:', error)
    ElMessage.error('加载预约详情失败')
  } finally {
    loading.value = false
  }
}

const loadAddableItems = async () => {
  try {
    const res = await itemApi.getAddable()
    addableItems.value = res.data.filter(item => {
      return !appointment.value.items.some(appItem => appItem.item_id === item.id)
    })
  } catch (error) {
    console.error('加载可加项目失败:', error)
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

const goBack = () => {
  router.push('/appointments')
}

const showAddItemDialog = async () => {
  await loadAddableItems()
  selectedItems.value = []
  addItemDialogVisible.value = true
}

const handleSelectionChange = (val) => {
  selectedItems.value = val
}

const confirmAddItems = async () => {
  if (!staffList.value || staffList.value.length === 0) {
    ElMessage.error('请先选择操作人')
    return
  }
  
  const staff = staffList.value[0]
  
  try {
    for (const item of selectedItems.value) {
      await addRemoveApi.addItem({
        appointment_id: appointment.value.id,
        item_id: item.id,
        staff_id: staff.id,
        staff_name: staff.name
      })
    }
    ElMessage.success('加项成功')
    addItemDialogVisible.value = false
    await loadAppointment()
  } catch (error) {
    console.error('加项失败:', error)
    ElMessage.error(error.response?.data?.error || '加项失败')
  }
}

const confirmRemoveItem = async (item) => {
  try {
    await ElMessageBox.confirm(
      `确定要退掉项目"${item.item_name}"吗？`,
      '退项确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    if (!staffList.value || staffList.value.length === 0) {
      ElMessage.error('请先选择操作人')
      return
    }
    
    const staff = staffList.value[0]
    
    await addRemoveApi.removeItem({
      appointment_id: appointment.value.id,
      item_id: item.item_id,
      staff_id: staff.id,
      staff_name: staff.name
    })
    ElMessage.success('退项成功')
    await loadAppointment()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('退项失败:', error)
      ElMessage.error(error.response?.data?.error || '退项失败')
    }
  }
}

const toggleReportStatus = async (item) => {
  if (!staffList.value || staffList.value.length === 0) {
    ElMessage.error('请先选择操作人')
    return
  }
  
  const staff = staffList.value[0]
  
  try {
    await paymentApi.updateReportStatus({
      appointment_item_id: item.id,
      report_issued: !item.report_issued,
      staff_id: staff.id,
      staff_name: staff.name
    })
    ElMessage.success(item.report_issued ? '报告已重置' : '报告已出具')
    await loadAppointment()
  } catch (error) {
    console.error('更新报告状态失败:', error)
    ElMessage.error('更新报告状态失败')
  }
}

const showPaymentDialog = () => {
  paymentForm.amount = appointment.value.total_amount - appointment.value.paid_amount
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
      appointment_id: appointment.value.id,
      amount: paymentForm.amount,
      description: paymentForm.description,
      staff_id: staff.id,
      staff_name: staff.name
    })
    ElMessage.success('缴费成功')
    paymentDialogVisible.value = false
    await loadAppointment()
  } catch (error) {
    console.error('缴费失败:', error)
    ElMessage.error(error.response?.data?.error || '缴费失败')
  }
}

onMounted(() => {
  loadAppointment()
  loadStaff()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
