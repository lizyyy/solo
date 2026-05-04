<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">取片登记</h2>
    </div>

    <el-card class="card-container" style="margin-bottom: 20px;">
      <template #header>
        <span>快速取片登记</span>
      </template>
      <el-form :model="quickPickupForm" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="预约查询">
              <el-select
                v-model="quickPickupForm.selectedAppointment"
                placeholder="请选择预约或搜索"
                filterable
                style="width: 100%"
                @change="onAppointmentSelect"
              >
                <el-option
                  v-for="appointment in availableAppointments"
                  :key="appointment.id"
                  :label="`${appointment.student_name} - ${appointment.student_id} (${appointment.film_type === 'black_white' ? '黑白' : appointment.film_type === 'color' ? '彩色' : '反转片'})`"
                  :value="appointment"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="取片人姓名">
              <el-input v-model="quickPickupForm.picker_name" placeholder="请输入姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="取片人学号">
              <el-input v-model="quickPickupForm.picker_id" placeholder="请输入学号" @blur="checkQuickMatch" />
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item>
              <el-button type="primary" @click="registerQuickPickup" :disabled="!canQuickPickup">
                登记取片
              </el-button>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row v-if="quickPickupMismatch">
          <el-col :span="24">
            <el-alert
              title="取片人与预约人不一致"
              :description="quickPickupMatchMessage"
              type="warning"
              show-icon
              :closable="false"
            >
              <template #default>
                <div style="margin-top: 10px;">
                  <el-checkbox v-model="quickPickupForm.is_authorizer_overridden">
                    管理员授权放行
                  </el-checkbox>
                  <el-input
                    v-if="quickPickupForm.is_authorizer_overridden"
                    v-model="quickPickupForm.override_reason"
                    placeholder="请输入授权原因"
                    style="margin-top: 10px; width: 400px;"
                  />
                </div>
              </template>
            </el-alert>
          </el-col>
        </el-row>
      </el-form>
    </el-card>

    <el-card class="card-container">
      <template #header>
        <div class="card-header">
          <span>待取片列表</span>
          <el-tag type="warning">{{ pendingCount }} 条待处理</el-tag>
        </div>
      </template>
      <el-table :data="pendingAppointments" style="width: 100%" v-loading="loading">
        <el-table-column prop="batch_number" label="批次编号" width="120" />
        <el-table-column prop="student_name" label="学生姓名" width="100" />
        <el-table-column prop="student_id" label="学号" width="120" />
        <el-table-column prop="film_type" label="胶片类型" width="100">
          <template #default="scope">
            {{ getFilmTypeText(scope.row.film_type) }}
          </template>
        </el-table-column>
        <el-table-column prop="film_count" label="数量" width="60" />
        <el-table-column prop="dark_bag_number" label="暗袋编号" width="100">
          <template #default="scope">
            {{ scope.row.dark_bag_number || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="appointment_date" label="预约日期" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button type="primary" link size="small" @click="openPickupDialog(scope.row)">
              登记取片
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="card-container" style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <span>最近取片记录</span>
        </div>
      </template>
      <el-table :data="recentPickups" style="width: 100%">
        <el-table-column prop="student_name" label="学生姓名" width="100" />
        <el-table-column prop="student_id" label="学号" width="120" />
        <el-table-column prop="picker_name" label="取片人" width="100" />
        <el-table-column prop="pickup_date" label="取片时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.pickup_date) }}
          </template>
        </el-table-column>
        <el-table-column prop="is_authorizer_overridden" label="授权状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.is_authorizer_overridden ? 'warning' : 'success'">
              {{ scope.row.is_authorizer_overridden ? '授权放行' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showPickupDialog" title="取片登记" width="500px">
      <el-form :model="pickupForm" label-width="100px">
        <el-form-item label="预约信息">
          <el-input 
            :value="`${selectedAppointment?.student_name} - ${selectedAppointment?.student_id}`" 
            disabled 
          />
        </el-form-item>
        <el-form-item label="胶片信息">
          <el-input 
            :value="`${getFilmTypeText(selectedAppointment?.film_type)} x ${selectedAppointment?.film_count}`" 
            disabled 
          />
        </el-form-item>
        <el-form-item label="取片人姓名" required>
          <el-input v-model="pickupForm.picker_name" placeholder="请输入取片人姓名" @blur="checkPickupMatch" />
        </el-form-item>
        <el-form-item label="取片人学号" required>
          <el-input v-model="pickupForm.picker_id" placeholder="请输入取片人学号" @blur="checkPickupMatch" />
        </el-form-item>
        <el-form-item v-if="pickupMismatch">
          <el-alert
            title="取片人与预约人不一致"
            :description="pickupMatchMessage"
            type="warning"
            show-icon
          >
            <template #default>
              <div style="margin-top: 10px;">
                <el-checkbox v-model="pickupForm.is_authorizer_overridden">
                  管理员授权放行
                </el-checkbox>
                <el-input
                  v-if="pickupForm.is_authorizer_overridden"
                  v-model="pickupForm.override_reason"
                  placeholder="请输入授权原因"
                  style="margin-top: 10px;"
                />
              </div>
            </template>
          </el-alert>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="pickupForm.notes" type="textarea" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPickupDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmPickup">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const appointments = ref([])
const selectedAppointment = ref(null)
const showPickupDialog = ref(false)

const quickPickupForm = reactive({
  selectedAppointment: null,
  picker_name: '',
  picker_id: '',
  is_authorizer_overridden: false,
  override_reason: ''
})

const pickupForm = reactive({
  picker_name: '',
  picker_id: '',
  is_authorizer_overridden: false,
  override_reason: '',
  notes: ''
})

const quickPickupMismatch = ref(false)
const quickPickupMatchMessage = ref('')
const pickupMismatch = ref(false)
const pickupMatchMessage = ref('')

const availableAppointments = computed(() => {
  return appointments.value.filter(a => a.status !== 'picked_up')
})

const pendingAppointments = computed(() => {
  return appointments.value.filter(a => a.status !== 'picked_up')
})

const pendingCount = computed(() => pendingAppointments.value.length)

const recentPickups = computed(() => {
  return appointments.value
    .filter(a => a.status === 'picked_up')
    .slice(0, 10)
})

const canQuickPickup = computed(() => {
  return quickPickupForm.selectedAppointment && 
         quickPickupForm.picker_name && 
         quickPickupForm.picker_id
})

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

const getStatusType = (status) => {
  const types = {
    'pending': 'warning',
    'processing': 'primary',
    'ready': 'success'
  }
  return types[status] || 'info'
}

const getStatusText = (status) => {
  const texts = {
    'pending': '待处理',
    'processing': '冲洗中',
    'ready': '可取'
  }
  return texts[status] || status
}

const getFilmTypeText = (type) => {
  const texts = {
    'black_white': '黑白',
    'color': '彩色',
    'slide': '反转片'
  }
  return texts[type] || type
}

const loadAppointments = async () => {
  loading.value = true
  try {
    appointments.value = await window.electronAPI.getAllAppointments()
  } catch (error) {
    ElMessage.error('加载预约失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

const onAppointmentSelect = (appointment) => {
  quickPickupForm.picker_name = appointment.student_name
  quickPickupForm.picker_id = appointment.student_id
  quickPickupForm.is_authorizer_overridden = false
  quickPickupForm.override_reason = ''
  quickPickupMismatch.value = false
}

const checkQuickMatch = async () => {
  if (!quickPickupForm.selectedAppointment || !quickPickupForm.picker_name || !quickPickupForm.picker_id) {
    return
  }
  
  try {
    const result = await window.electronAPI.checkPickupMatch({
      appointmentId: quickPickupForm.selectedAppointment.id,
      pickerName: quickPickupForm.picker_name,
      pickerId: quickPickupForm.picker_id
    })
    quickPickupMismatch.value = !result.match
    quickPickupMatchMessage.value = result.message
    
    if (!result.match) {
      quickPickupForm.is_authorizer_overridden = false
    }
  } catch (error) {
    console.error('检查取片人匹配失败:', error)
  }
}

const registerQuickPickup = async () => {
  if (!quickPickupForm.selectedAppointment || !quickPickupForm.picker_name || !quickPickupForm.picker_id) {
    ElMessage.warning('请填写完整信息')
    return
  }
  
  if (quickPickupMismatch.value && !quickPickupForm.is_authorizer_overridden) {
    ElMessage.warning('取片人与预约人不一致，请管理员授权后再操作')
    return
  }
  
  if (quickPickupForm.is_authorizer_overridden && !quickPickupForm.override_reason) {
    ElMessage.warning('请输入授权原因')
    return
  }

  try {
    const result = await window.electronAPI.createPickup({
      appointment_id: quickPickupForm.selectedAppointment.id,
      picker_name: quickPickupForm.picker_name,
      picker_id: quickPickupForm.picker_id,
      is_authorizer_overridden: quickPickupForm.is_authorizer_overridden,
      override_reason: quickPickupForm.override_reason,
      notes: ''
    })
    
    if (result.success) {
      ElMessage.success('取片登记成功')
      Object.assign(quickPickupForm, {
        selectedAppointment: null,
        picker_name: '',
        picker_id: '',
        is_authorizer_overridden: false,
        override_reason: ''
      })
      quickPickupMismatch.value = false
      loadAppointments()
    }
  } catch (error) {
    ElMessage.error('取片登记失败: ' + error.message)
  }
}

const openPickupDialog = (appointment) => {
  selectedAppointment.value = appointment
  pickupForm.picker_name = appointment.student_name
  pickupForm.picker_id = appointment.student_id
  pickupForm.is_authorizer_overridden = false
  pickupForm.override_reason = ''
  pickupForm.notes = ''
  pickupMismatch.value = false
  showPickupDialog.value = true
}

const checkPickupMatch = async () => {
  if (!selectedAppointment.value || !pickupForm.picker_name || !pickupForm.picker_id) {
    return
  }
  
  try {
    const result = await window.electronAPI.checkPickupMatch({
      appointmentId: selectedAppointment.value.id,
      pickerName: pickupForm.picker_name,
      pickerId: pickupForm.picker_id
    })
    pickupMismatch.value = !result.match
    pickupMatchMessage.value = result.message
    
    if (!result.match) {
      pickupForm.is_authorizer_overridden = false
    }
  } catch (error) {
    console.error('检查取片人匹配失败:', error)
  }
}

const confirmPickup = async () => {
  if (!pickupForm.picker_name || !pickupForm.picker_id) {
    ElMessage.warning('请填写取片人信息')
    return
  }
  
  if (pickupMismatch.value && !pickupForm.is_authorizer_overridden) {
    ElMessage.warning('取片人与预约人不一致，请管理员授权后再操作')
    return
  }
  
  if (pickupForm.is_authorizer_overridden && !pickupForm.override_reason) {
    ElMessage.warning('请输入授权原因')
    return
  }

  try {
    const result = await window.electronAPI.createPickup({
      appointment_id: selectedAppointment.value.id,
      picker_name: pickupForm.picker_name,
      picker_id: pickupForm.picker_id,
      is_authorizer_overridden: pickupForm.is_authorizer_overridden,
      override_reason: pickupForm.override_reason,
      notes: pickupForm.notes
    })
    
    if (result.success) {
      ElMessage.success('取片登记成功')
      showPickupDialog.value = false
      loadAppointments()
    }
  } catch (error) {
    ElMessage.error('取片登记失败: ' + error.message)
  }
}

onMounted(() => {
  loadAppointments()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
