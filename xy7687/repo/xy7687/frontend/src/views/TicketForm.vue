<template>
  <div class="form-container">
    <el-card shadow="never" class="form-card">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <el-button :icon="ArrowLeft" text @click="goBack">返回</el-button>
            <span class="form-title">{{ isEdit ? '编辑工单' : '新建工单' }}</span>
          </div>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
        class="ticket-form"
      >
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="客户姓名" prop="customer_name">
              <el-input
                v-model="formData.customer_name"
                placeholder="请输入客户姓名"
                maxlength="50"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话" prop="customer_phone">
              <el-input
                v-model="formData.customer_phone"
                placeholder="请输入手机号"
                maxlength="11"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="设备型号" prop="device_model">
              <el-input
                v-model="formData.device_model"
                placeholder="请输入设备型号，如：iPhone 14 Pro"
                maxlength="100"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="报价金额" prop="quote_amount">
              <el-input-number
                v-model="formData.quote_amount"
                :precision="2"
                :min="0"
                :max="999999"
                placeholder="请输入报价金额"
                style="width: 100%"
              >
                <template #prefix>¥</template>
              </el-input-number>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="维修配件" prop="repair_parts">
              <el-input
                v-model="formData.repair_parts"
                placeholder="请输入需要更换的配件"
                maxlength="200"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="预计取机时间" prop="estimated_pickup_time">
              <el-datetime-picker
                v-model="formData.estimated_pickup_time"
                type="datetime"
                placeholder="请选择预计取机时间"
                format="YYYY-MM-DD HH:mm"
                value-format="YYYY-MM-DD HH:mm"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="故障描述" prop="fault_description">
          <el-input
            v-model="formData.fault_description"
            type="textarea"
            :rows="3"
            placeholder="请详细描述设备故障情况"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="备注" prop="notes">
          <el-input
            v-model="formData.notes"
            type="textarea"
            :rows="2"
            placeholder="请输入其他备注信息"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-divider />

        <el-form-item class="form-actions">
          <el-button type="primary" :loading="submitting" @click="handleSubmit">
            {{ isEdit ? '保存修改' : '创建工单' }}
          </el-button>
          <el-button @click="goBack">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ticketApi } from '../api'

const route = useRoute()
const router = useRouter()
const formRef = ref(null)
const submitting = ref(false)

const isEdit = computed(() => !!route.params.id)

const formData = reactive({
  customer_name: '',
  customer_phone: '',
  device_model: '',
  fault_description: '',
  quote_amount: 0,
  repair_parts: '',
  estimated_pickup_time: '',
  notes: ''
})

const formRules = {
  customer_name: [
    { required: true, message: '请输入客户姓名', trigger: 'blur' },
    { min: 1, max: 50, message: '姓名长度不能超过50个字符', trigger: 'blur' }
  ],
  customer_phone: [
    { required: true, message: '请输入联系电话', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ],
  device_model: [
    { required: true, message: '请输入设备型号', trigger: 'blur' },
    { min: 1, max: 100, message: '设备型号长度不能超过100个字符', trigger: 'blur' }
  ],
  quote_amount: [
    { type: 'number', min: 0, message: '报价金额不能为负数', trigger: 'blur' }
  ],
  fault_description: [
    { max: 500, message: '故障描述长度不能超过500个字符', trigger: 'blur' }
  ],
  notes: [
    { max: 500, message: '备注长度不能超过500个字符', trigger: 'blur' }
  ]
}

const loadTicket = async () => {
  const id = route.params.id
  if (!id) return
  
  try {
    const res = await ticketApi.getDetail(id)
    const ticket = res.data
    
    if (ticket.status === 'completed' || ticket.status === 'cancelled') {
      ElMessage.warning('该工单已完成或已取消，无法编辑')
      router.push('/')
      return
    }
    
    formData.customer_name = ticket.customer_name
    formData.customer_phone = ticket.customer_phone
    formData.device_model = ticket.device_model
    formData.fault_description = ticket.fault_description || ''
    formData.quote_amount = ticket.quote_amount || 0
    formData.repair_parts = ticket.repair_parts || ''
    formData.estimated_pickup_time = ticket.estimated_pickup_time || ''
    formData.notes = ticket.notes || ''
  } catch (error) {
    console.error('加载工单信息失败:', error)
    ElMessage.error('加载工单信息失败')
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  submitting.value = true
  
  try {
    const submitData = {
      customer_name: formData.customer_name.trim(),
      customer_phone: formData.customer_phone.trim(),
      device_model: formData.device_model.trim(),
      fault_description: formData.fault_description?.trim() || '',
      quote_amount: formData.quote_amount || 0,
      repair_parts: formData.repair_parts?.trim() || '',
      estimated_pickup_time: formData.estimated_pickup_time || '',
      notes: formData.notes?.trim() || ''
    }

    if (isEdit.value) {
      await ticketApi.update(route.params.id, submitData)
      ElMessage.success('工单更新成功')
    } else {
      const res = await ticketApi.create(submitData)
      ElMessage.success('工单创建成功')
      router.push(`/ticket/${res.data.id}`)
      return
    }
    
    router.push(`/ticket/${route.params.id}`)
  } catch (error) {
    console.error('提交失败:', error)
  } finally {
    submitting.value = false
  }
}

const goBack = () => {
  router.back()
}

onMounted(() => {
  if (isEdit.value) {
    loadTicket()
  }
})
</script>

<style scoped>
.form-container {
  max-width: 800px;
  margin: 0 auto;
}

.form-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.form-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.ticket-form {
  padding: 20px 0;
}

.form-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 0;
}

:deep(.el-form-item__label) {
  font-weight: 500;
}
</style>
