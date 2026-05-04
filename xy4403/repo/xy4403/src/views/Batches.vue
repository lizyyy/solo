<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">批次管理</h2>
      <el-button type="primary" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon>
        新建批次
      </el-button>
    </div>

    <div v-if="selectedBatch && selectedBatchViolations.length > 0" class="violation-warning">
      <div class="warning-title">
        <el-icon><Warning /></el-icon>
        当前批次规则警告
      </div>
      <div v-for="(v, idx) in selectedBatchViolations" :key="idx" class="warning-item">
        <span>{{ idx + 1 }}. {{ v.message }}</span>
        <el-button type="primary" link size="small" @click="handleOverride(v)">
          人工改判
        </el-button>
      </div>
    </div>

    <el-card class="card-container">
      <el-table :data="batches" style="width: 100%" v-loading="loading">
        <el-table-column prop="batch_number" label="批次编号" width="150" />
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="notes" label="备注" show-overflow-tooltip />
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="scope">
            <el-button type="primary" link @click="viewBatchDetail(scope.row)">
              查看预约
            </el-button>
            <el-button type="success" link @click="checkRules(scope.row)">
              检查规则
            </el-button>
            <el-button type="warning" link @click="editStatus(scope.row)">
              修改状态
            </el-button>
            <el-button type="info" link @click="exportHandover(scope.row)">
              导出交接单
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card v-if="selectedBatch" class="card-container">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>批次 {{ selectedBatch.batch_number }} - 预约列表</span>
          <div>
            <el-button type="primary" size="small" @click="showAddAppointment = true">
              添加预约
            </el-button>
            <el-button type="success" size="small" @click="exportBatchAppointments">
              导出JSON
            </el-button>
          </div>
        </div>
      </template>
      <el-table :data="batchAppointments" style="width: 100%">
        <el-table-column prop="student_name" label="学生姓名" width="100" />
        <el-table-column prop="student_id" label="学号" width="120" />
        <el-table-column prop="film_type" label="胶片类型" width="100" />
        <el-table-column prop="film_count" label="数量" width="60" />
        <el-table-column prop="dark_bag_number" label="暗袋编号" width="100" />
        <el-table-column prop="appointment_date" label="预约日期" width="120">
          <template #default="scope">
            {{ scope.row.appointment_date || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getAppointmentStatusType(scope.row.status)">
              {{ getAppointmentStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="picker_name" label="取片人" width="100">
          <template #default="scope">
            {{ scope.row.picker_name || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
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
              登记取片
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showCreateDialog" title="新建批次" width="500px">
      <el-form :model="newBatch" label-width="100px">
        <el-form-item label="批次编号" required>
          <el-input v-model="newBatch.batch_number" placeholder="请输入批次编号" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="newBatch.notes" type="textarea" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createBatch">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showStatusDialog" title="修改批次状态" width="500px">
      <el-form :model="statusForm" label-width="100px">
        <el-form-item label="当前批次">
          <el-input :value="selectedBatch?.batch_number" disabled />
        </el-form-item>
        <el-form-item label="状态" required>
          <el-select v-model="statusForm.status" placeholder="请选择状态" style="width: 100%">
            <el-option label="处理中" value="processing" />
            <el-option label="可放行" value="ready" />
            <el-option label="已完成" value="completed" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="statusForm.notes" type="textarea" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showStatusDialog = false">取消</el-button>
        <el-button type="primary" @click="updateStatus">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showAddAppointment" title="添加预约" width="600px">
      <el-form :model="appointmentForm" label-width="100px">
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
              v-for="bag in availableBags"
              :key="bag.id"
              :label="bag.bag_number"
              :value="bag.bag_number"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddAppointment = false">取消</el-button>
        <el-button type="primary" @click="addAppointment">确定</el-button>
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

    <el-dialog v-model="showOverrideDialog" title="人工改判" width="500px">
      <el-form :model="overrideForm" label-width="100px">
        <el-form-item label="违规类型">
          <el-input :value="currentViolation?.type" disabled />
        </el-form-item>
        <el-form-item label="违规信息">
          <el-input :value="currentViolation?.message" type="textarea" disabled />
        </el-form-item>
        <el-form-item label="改判原因" required>
          <el-input v-model="overrideForm.reason" type="textarea" placeholder="请输入改判原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showOverrideDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmOverride">确定改判</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Warning } from '@element-plus/icons-vue'

const loading = ref(false)
const batches = ref([])
const selectedBatch = ref(null)
const batchAppointments = ref([])
const selectedBatchViolations = ref([])
const availableBags = ref([])
const selectedAppointment = ref(null)

const showCreateDialog = ref(false)
const showStatusDialog = ref(false)
const showAddAppointment = ref(false)
const showPickupDialog = ref(false)
const showOverrideDialog = ref(false)

const newBatch = reactive({
  batch_number: '',
  notes: ''
})

const statusForm = reactive({
  status: '',
  notes: ''
})

const appointmentForm = reactive({
  student_name: '',
  student_id: '',
  film_type: '',
  film_count: 1,
  appointment_date: '',
  dark_bag_number: ''
})

const pickupForm = reactive({
  picker_name: '',
  picker_id: '',
  is_authorizer_overridden: false,
  override_reason: '',
  notes: ''
})

const overrideForm = reactive({
  reason: ''
})

const pickupMismatch = ref(false)
const pickupMatchMessage = ref('')
const currentViolation = ref(null)

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

const getStatusType = (status) => {
  const types = {
    'processing': 'primary',
    'ready': 'success',
    'completed': 'info'
  }
  return types[status] || 'info'
}

const getStatusText = (status) => {
  const texts = {
    'processing': '处理中',
    'ready': '可放行',
    'completed': '已完成'
  }
  return texts[status] || status
}

const getAppointmentStatusType = (status) => {
  const types = {
    'pending': 'warning',
    'processing': 'primary',
    'ready': 'success',
    'picked_up': 'info'
  }
  return types[status] || 'info'
}

const getAppointmentStatusText = (status) => {
  const texts = {
    'pending': '待处理',
    'processing': '冲洗中',
    'ready': '可取',
    'picked_up': '已取片'
  }
  return texts[status] || status
}

const loadBatches = async () => {
  loading.value = true
  try {
    batches.value = await window.electronAPI.getBatches()
  } catch (error) {
    ElMessage.error('加载批次失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

const loadAvailableBags = async () => {
  try {
    availableBags.value = await window.electronAPI.getAllDarkBags()
  } catch (error) {
    console.error('加载暗袋失败:', error)
  }
}

const createBatch = async () => {
  if (!newBatch.batch_number.trim()) {
    ElMessage.warning('请输入批次编号')
    return
  }
  try {
    const result = await window.electronAPI.createBatch(newBatch)
    if (result.success) {
      ElMessage.success('创建批次成功')
      showCreateDialog.value = false
      newBatch.batch_number = ''
      newBatch.notes = ''
      loadBatches()
    }
  } catch (error) {
    ElMessage.error('创建批次失败: ' + error.message)
  }
}

const viewBatchDetail = async (batch) => {
  selectedBatch.value = batch
  try {
    batchAppointments.value = await window.electronAPI.getAppointmentsByBatch(batch.id)
    selectedBatchViolations.value = await window.electronAPI.checkRulesForBatch(batch.id)
  } catch (error) {
    ElMessage.error('加载批次详情失败: ' + error.message)
  }
}

const checkRules = async (batch) => {
  try {
    const violations = await window.electronAPI.checkRulesForBatch(batch.id)
    selectedBatch.value = batch
    selectedBatchViolations.value = violations
    
    if (violations.length === 0) {
      ElMessage.success('本批次无规则违规，可以放行')
    } else {
      ElMessage.warning(`检测到 ${violations.length} 条规则违规，请查看详情`)
    }
  } catch (error) {
    ElMessage.error('检查规则失败: ' + error.message)
  }
}

const editStatus = (batch) => {
  selectedBatch.value = batch
  statusForm.status = batch.status
  statusForm.notes = batch.notes || ''
  showStatusDialog.value = true
}

const updateStatus = async () => {
  try {
    const result = await window.electronAPI.updateBatchStatus({
      id: selectedBatch.value.id,
      status: statusForm.status,
      notes: statusForm.notes
    })
    if (result.success) {
      ElMessage.success('更新状态成功')
      showStatusDialog.value = false
      loadBatches()
      if (selectedBatch.value) {
        viewBatchDetail(selectedBatch.value)
      }
    }
  } catch (error) {
    ElMessage.error('更新状态失败: ' + error.message)
  }
}

const addAppointment = async () => {
  if (!appointmentForm.student_name || !appointmentForm.student_id || 
      !appointmentForm.film_type || !appointmentForm.appointment_date) {
    ElMessage.warning('请填写必填项')
    return
  }

  try {
    const result = await window.electronAPI.createAppointment({
      ...appointmentForm,
      batch_id: selectedBatch.value.id
    })
    if (result.success) {
      ElMessage.success('添加预约成功')
      showAddAppointment.value = false
      Object.assign(appointmentForm, {
        student_name: '',
        student_id: '',
        film_type: '',
        film_count: 1,
        appointment_date: '',
        dark_bag_number: ''
      })
      viewBatchDetail(selectedBatch.value)
    }
  } catch (error) {
    ElMessage.error('添加预约失败: ' + error.message)
  }
}

const editAppointment = (appointment) => {
  ElMessage.info('编辑功能开发中')
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
      viewBatchDetail(selectedBatch.value)
    } else if (result.requires_override) {
      ElMessage.warning(result.error)
    }
  } catch (error) {
    ElMessage.error('取片登记失败: ' + error.message)
  }
}

const handleOverride = (violation) => {
  currentViolation.value = violation
  overrideForm.reason = ''
  showOverrideDialog.value = true
}

const confirmOverride = async () => {
  if (!overrideForm.reason.trim()) {
    ElMessage.warning('请输入改判原因')
    return
  }
  
  try {
    ElMessage.success('人工改判已记录')
    showOverrideDialog.value = false
  } catch (error) {
    ElMessage.error('改判失败: ' + error.message)
  }
}

const exportHandover = async (batch) => {
  try {
    const result = await window.electronAPI.exportHandoverMD(batch.id)
    if (result.success) {
      ElMessage.success(`交接单已导出到: ${result.filePath}`)
    } else if (!result.canceled) {
      ElMessage.error('导出失败: ' + result.error)
    }
  } catch (error) {
    ElMessage.error('导出失败: ' + error.message)
  }
}

const exportBatchAppointments = async () => {
  try {
    const result = await window.electronAPI.exportJSON('appointments')
    if (result.success) {
      ElMessage.success(`已导出到: ${result.filePath}`)
    } else if (!result.canceled) {
      ElMessage.error('导出失败')
    }
  } catch (error) {
    ElMessage.error('导出失败: ' + error.message)
  }
}

onMounted(() => {
  loadBatches()
  loadAvailableBags()
})
</script>

<style scoped>
.warning-title {
  display: flex;
  align-items: center;
  gap: 5px;
}
</style>
