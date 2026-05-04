<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">预约管理</h2>
      <el-button type="primary" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon>
        新建预约
      </el-button>
    </div>

    <el-card class="card-container">
      <el-table :data="appointments" style="width: 100%" v-loading="loading">
        <el-table-column prop="student_name" label="学生姓名" width="120" />
        <el-table-column prop="student_id" label="学号" width="120" />
        <el-table-column prop="batch_number" label="批次编号" width="120" />
        <el-table-column prop="film_type" label="胶片类型" width="100">
          <template #default="scope">
            {{ getFilmTypeText(scope.row.film_type) }}
          </template>
        </el-table-column>
        <el-table-column prop="film_count" label="数量" width="80" />
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
        <el-table-column prop="picker_name" label="取片人" width="100">
          <template #default="scope">
            {{ scope.row.picker_name || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="pickup_date" label="取片时间" width="160">
          <template #default="scope">
            {{ scope.row.pickup_date ? formatDate(scope.row.pickup_date) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button type="primary" link size="small" @click="editAppointment(scope.row)">
              编辑
            </el-button>
            <el-button 
              v-if="scope.row.status !== 'picked_up'" 
              type="success" 
              link 
              size="small"
              @click="quickPickup(scope.row)"
            >
              取片
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showCreateDialog" title="新建预约" width="600px">
      <el-form :model="appointmentForm" label-width="100px">
        <el-form-item label="所属批次" required>
          <el-select v-model="appointmentForm.batch_id" placeholder="请选择批次" style="width: 100%">
            <el-option
              v-for="batch in batches"
              :key="batch.id"
              :label="batch.batch_number"
              :value="batch.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="学生姓名" required>
          <el-input v-model="appointmentForm.student_name" placeholder="请输入学生姓名" />
        </el-form-item>
        <el-form-item label="学号" required>
          <el-input v-model="appointmentForm.student_id" placeholder="请输入学号" />
        </el-form-item>
        <el-form-item label="胶片类型" required>
          <el-select v-model="appointmentForm.film_type" placeholder="请选择胶片类型" style="width: 100%">
            <el-option label="黑白" value="black_white" />
            <el-option label="彩色" value="color" />
            <el-option label="反转片" value="slide" />
          </el-select>
        </el-form-item>
        <el-form-item label="数量" required>
          <el-input-number v-model="appointmentForm.film_count" :min="1" :max="10" />
        </el-form-item>
        <el-form-item label="预约日期" required>
          <el-date-picker
            v-model="appointmentForm.appointment_date"
            type="date"
            placeholder="选择日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="暗袋编号">
          <el-select v-model="appointmentForm.dark_bag_number" placeholder="选择暗袋编号" style="width: 100%" clearable>
            <el-option
              v-for="bag in darkBags"
              :key="bag.id"
              :label="bag.bag_number"
              :value="bag.bag_number"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createAppointment">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showEditDialog" title="编辑预约" width="600px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="学生姓名" required>
          <el-input v-model="editForm.student_name" placeholder="请输入学生姓名" />
        </el-form-item>
        <el-form-item label="学号" required>
          <el-input v-model="editForm.student_id" placeholder="请输入学号" />
        </el-form-item>
        <el-form-item label="胶片类型" required>
          <el-select v-model="editForm.film_type" placeholder="请选择胶片类型" style="width: 100%">
            <el-option label="黑白" value="black_white" />
            <el-option label="彩色" value="color" />
            <el-option label="反转片" value="slide" />
          </el-select>
        </el-form-item>
        <el-form-item label="数量" required>
          <el-input-number v-model="editForm.film_count" :min="1" :max="10" />
        </el-form-item>
        <el-form-item label="预约日期" required>
          <el-date-picker
            v-model="editForm.appointment_date"
            type="date"
            placeholder="选择日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="暗袋编号">
          <el-select v-model="editForm.dark_bag_number" placeholder="选择暗袋编号" style="width: 100%" clearable>
            <el-option
              v-for="bag in darkBags"
              :key="bag.id"
              :label="bag.bag_number"
              :value="bag.bag_number"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="editForm.status" placeholder="请选择状态" style="width: 100%">
            <el-option label="待处理" value="pending" />
            <el-option label="冲洗中" value="processing" />
            <el-option label="可取" value="ready" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="updateAppointment">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showPickupDialog" title="取片登记" width="500px">
      <el-form :model="pickupForm" label-width="100px">
        <el-form-item label="预约信息">
          <el-input 
            :value="`${selectedAppointment?.student_name} - ${selectedAppointment?.student_id}`" 
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
        <el-button type="primary" @click="registerPickup">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'

const loading = ref(false)
const appointments = ref([])
const batches = ref([])
const darkBags = ref([])
const selectedAppointment = ref(null)

const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showPickupDialog = ref(false)

const appointmentForm = reactive({
  batch_id: null,
  student_name: '',
  student_id: '',
  film_type: '',
  film_count: 1,
  appointment_date: '',
  dark_bag_number: ''
})

const editForm = reactive({
  id: null,
  student_name: '',
  student_id: '',
  film_type: '',
  film_count: 1,
  appointment_date: '',
  dark_bag_number: '',
  status: 'pending'
})

const pickupForm = reactive({
  picker_name: '',
  picker_id: '',
  is_authorizer_overridden: false,
  override_reason: '',
  notes: ''
})

const pickupMismatch = ref(false)
const pickupMatchMessage = ref('')

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

const getStatusType = (status) => {
  const types = {
    'pending': 'warning',
    'processing': 'primary',
    'ready': 'success',
    'picked_up': 'info'
  }
  return types[status] || 'info'
}

const getStatusText = (status) => {
  const texts = {
    'pending': '待处理',
    'processing': '冲洗中',
    'ready': '可取',
    'picked_up': '已取片'
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

const loadBatches = async () => {
  try {
    batches.value = await window.electronAPI.getBatches()
  } catch (error) {
    console.error('加载批次失败:', error)
  }
}

const loadDarkBags = async () => {
  try {
    darkBags.value = await window.electronAPI.getAllDarkBags()
  } catch (error) {
    console.error('加载暗袋失败:', error)
  }
}

const createAppointment = async () => {
  if (!appointmentForm.batch_id || !appointmentForm.student_name || 
      !appointmentForm.student_id || !appointmentForm.film_type ||
      !appointmentForm.appointment_date) {
    ElMessage.warning('请填写必填项')
    return
  }

  try {
    const result = await window.electronAPI.createAppointment(appointmentForm)
    if (result.success) {
      ElMessage.success('创建预约成功')
      showCreateDialog.value = false
      Object.assign(appointmentForm, {
        batch_id: null,
        student_name: '',
        student_id: '',
        film_type: '',
        film_count: 1,
        appointment_date: '',
        dark_bag_number: ''
      })
      loadAppointments()
    }
  } catch (error) {
    ElMessage.error('创建预约失败: ' + error.message)
  }
}

const editAppointment = (appointment) => {
  Object.assign(editForm, {
    id: appointment.id,
    student_name: appointment.student_name,
    student_id: appointment.student_id,
    film_type: appointment.film_type,
    film_count: appointment.film_count,
    appointment_date: appointment.appointment_date,
    dark_bag_number: appointment.dark_bag_number,
    status: appointment.status
  })
  showEditDialog.value = true
}

const updateAppointment = async () => {
  try {
    const result = await window.electronAPI.updateAppointment({
      id: editForm.id,
      student_name: editForm.student_name,
      student_id: editForm.student_id,
      film_type: editForm.film_type,
      film_count: editForm.film_count,
      appointment_date: editForm.appointment_date,
      dark_bag_number: editForm.dark_bag_number,
      status: editForm.status
    })
    if (result.success) {
      ElMessage.success('更新预约成功')
      showEditDialog.value = false
      loadAppointments()
    }
  } catch (error) {
    ElMessage.error('更新预约失败: ' + error.message)
  }
}

const quickPickup = (appointment) => {
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

const registerPickup = async () => {
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
    } else if (result.requires_override) {
      ElMessage.warning(result.error)
    }
  } catch (error) {
    ElMessage.error('取片登记失败: ' + error.message)
  }
}

onMounted(() => {
  loadAppointments()
  loadBatches()
  loadDarkBags()
})
</script>
