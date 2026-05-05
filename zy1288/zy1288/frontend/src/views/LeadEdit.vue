<template>
  <div class="page-container">
    <el-skeleton :loading="loading" animated>
      <template #default>
        <div class="page-header-section">
          <el-button @click="goBack">
            <el-icon><ArrowLeft /></el-icon>
            返回详情
          </el-button>
          <h2 class="page-title">编辑线索</h2>
          <div class="page-actions">
            <el-button @click="handleReset">
              <el-icon><RefreshRight /></el-icon>
              重置
            </el-button>
            <el-button type="primary" :loading="submitting" @click="handleSubmit">
              <el-icon><Check /></el-icon>
              保存
            </el-button>
          </div>
        </div>

        <div class="card-container">
          <el-alert
            v-if="currentStatus && statusFlow[currentStatus]"
            :title="`当前状态：${getStatusLabel(currentStatus)}，允许流转至：${allowedStatuses.map(s => getStatusLabel(s)).join('、')}`"
            type="info"
            show-icon
            style="margin-bottom: 24px"
          />

          <el-form
            ref="formRef"
            :model="formData"
            :rules="formRules"
            label-width="100px"
            style="max-width: 600px"
          >
            <el-form-item label="ID">
              <el-input :value="lead?.id" disabled />
            </el-form-item>
            <el-form-item label="学员姓名" prop="name">
              <el-input v-model="formData.name" placeholder="请输入学员姓名" />
            </el-form-item>
            <el-form-item label="手机号" prop="phone">
              <el-input 
                v-model="formData.phone" 
                placeholder="请输入手机号" 
                maxlength="11"
              />
            </el-form-item>
            <el-form-item label="课程" prop="course">
              <el-select v-model="formData.course" placeholder="请选择课程" style="width: 100%">
                <el-option
                  v-for="course in courses"
                  :key="course"
                  :label="course"
                  :value="course"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="预约时间" prop="appointment_time">
              <el-date-picker
                v-model="formData.appointment_time"
                type="datetime"
                placeholder="请选择预约时间"
                style="width: 100%"
                format="YYYY-MM-DD HH:mm"
                value-format="YYYY-MM-DD HH:mm"
              />
            </el-form-item>
            <el-form-item label="状态" prop="status">
              <el-select v-model="formData.status" placeholder="请选择状态" style="width: 100%">
                <el-option
                  v-for="status in allowedStatusOptions"
                  :key="status.value"
                  :label="status.label"
                  :value="status.value"
                >
                  <el-tag :type="getStatusType(status.value)" size="small">
                    {{ status.label }}
                  </el-tag>
                </el-option>
              </el-select>
              <div class="status-hint">
                <el-text type="info">
                  <el-icon><InfoFilled /></el-icon>
                  状态变更将记录到修改历史
                </el-text>
              </div>
            </el-form-item>
            <el-form-item label="负责人" prop="responsible">
              <el-select v-model="formData.responsible" placeholder="请选择负责人" style="width: 100%">
                <el-option
                  v-for="responsible in responsibles"
                  :key="responsible"
                  :label="responsible"
                  :value="responsible"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="备注" prop="notes">
              <el-input
                v-model="formData.notes"
                type="textarea"
                :rows="4"
                placeholder="请输入备注（可选）"
              />
            </el-form-item>
          </el-form>
        </div>
      </template>
    </el-skeleton>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, RefreshRight, Check, InfoFilled } from '@element-plus/icons-vue'
import { useLeadsStore } from '@/stores/leads'

const route = useRoute()
const router = useRouter()
const leadsStore = useLeadsStore()

const loading = ref(false)
const submitting = ref(false)
const formRef = ref(null)

const leadId = computed(() => Number(route.params.id))
const lead = computed(() => leadsStore.currentLead)

const courses = computed(() => leadsStore.metadata.courses)
const responsibles = computed(() => leadsStore.metadata.responsibles)
const statusList = computed(() => leadsStore.metadata.statuses)
const statusFlow = computed(() => leadsStore.metadata.status_flow)

const currentStatus = computed(() => lead.value?.status)

const allowedStatuses = computed(() => {
  if (!currentStatus.value || !statusFlow.value) {
    return statusList.value.map(s => s.value)
  }
  return leadsStore.getAllowedStatuses(currentStatus.value)
})

const allowedStatusOptions = computed(() => {
  return statusList.value.filter(s => allowedStatuses.value.includes(s.value))
})

const formData = reactive({
  name: '',
  phone: '',
  course: '',
  appointment_time: '',
  status: '',
  responsible: '',
  notes: ''
})

const formRules = {
  name: [
    { required: true, message: '请输入学员姓名', trigger: 'blur' },
    { min: 1, max: 50, message: '姓名长度在 1 到 50 个字符', trigger: 'blur' }
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号', trigger: 'blur' }
  ],
  course: [
    { required: true, message: '请选择课程', trigger: 'change' }
  ],
  appointment_time: [
    { required: true, message: '请选择预约时间', trigger: 'change' }
  ],
  status: [
    { required: true, message: '请选择状态', trigger: 'change' }
  ],
  responsible: [
    { required: true, message: '请选择负责人', trigger: 'change' }
  ]
}

const getStatusLabel = (status) => {
  return leadsStore.getStatusLabel(status)
}

const getStatusType = (status) => {
  return leadsStore.getStatusType(status)
}

const initFormData = () => {
  if (lead.value) {
    formData.name = lead.value.name
    formData.phone = lead.value.phone
    formData.course = lead.value.course
    formData.appointment_time = lead.value.appointment_time
    formData.status = lead.value.status
    formData.responsible = lead.value.responsible
    formData.notes = lead.value.notes || ''
  }
}

const goBack = () => {
  router.push(`/leads/${leadId.value}`)
}

const handleReset = () => {
  initFormData()
  formRef.value?.resetFields()
}

const getChangedFields = () => {
  if (!lead.value) return {}
  
  const changes = {}
  
  if (formData.name !== lead.value.name) {
    changes.name = formData.name
  }
  if (formData.phone !== lead.value.phone) {
    changes.phone = formData.phone
  }
  if (formData.course !== lead.value.course) {
    changes.course = formData.course
  }
  if (formData.appointment_time !== lead.value.appointment_time) {
    changes.appointment_time = formData.appointment_time
  }
  if (formData.status !== lead.value.status) {
    changes.status = formData.status
  }
  if (formData.responsible !== lead.value.responsible) {
    changes.responsible = formData.responsible
  }
  if (formData.notes !== (lead.value.notes || '')) {
    changes.notes = formData.notes
  }
  
  return changes
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      const changes = getChangedFields()
      
      if (Object.keys(changes).length === 0) {
        ElMessage.warning('没有需要保存的修改')
        return
      }
      
      submitting.value = true
      try {
        const result = await leadsStore.updateLead(leadId.value, changes)
        
        ElMessage.success('保存成功')
        
        if (result.changes && result.changes.length > 0) {
          const changeTexts = result.changes.map((c) => 
            `${c.fieldName}: ${c.oldValue} → ${c.newValue}`
          ).join('；')
          ElMessage.info(`已记录修改: ${changeTexts}`)
        }
        
        router.push(`/leads/${leadId.value}`)
      } catch (err) {
        if (err.code === 'INVALID_STATUS_TRANSITION') {
          ElMessage.error(err.message || '状态流转无效')
        } else {
          ElMessage.error(err.message || '保存失败')
        }
      } finally {
        submitting.value = false
      }
    }
  })
}

onMounted(async () => {
  loading.value = true
  try {
    if (leadsStore.metadata.statuses.length === 0) {
      await leadsStore.fetchMetadata()
    }
    
    if (!lead.value || lead.value.id !== leadId.value) {
      await leadsStore.fetchLeadById(leadId.value)
    }
    
    initFormData()
  } catch (err) {
    ElMessage.error(err.message || '加载失败')
    router.push('/')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page-header-section {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  gap: 16px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  flex: 1;
}

.page-actions {
  display: flex;
  gap: 12px;
}

.status-hint {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
