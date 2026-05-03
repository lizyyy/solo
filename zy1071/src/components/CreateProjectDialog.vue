<template>
  <el-dialog
    v-model="dialogVisible"
    title="新建搬家项目"
    width="500px"
    :close-on-click-modal="false"
    @close="resetForm"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="100px"
      class="dialog-form"
    >
      <el-form-item label="项目名称" prop="name">
        <el-input 
          v-model="formData.name" 
          placeholder="例如：2024年家庭搬家"
          clearable
        />
      </el-form-item>
      
      <el-form-item label="描述">
        <el-input
          v-model="formData.description"
          type="textarea"
          :rows="3"
          placeholder="项目描述（可选）"
        />
      </el-form-item>
      
      <el-form-item label="搬家日期">
        <el-date-picker
          v-model="formData.moveDate"
          type="date"
          placeholder="选择搬家日期（可选）"
          style="width: 100%;"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
        />
      </el-form-item>
      
      <el-divider content-position="left">默认设置</el-divider>
      
      <el-form-item label="箱子上限">
        <div style="display: flex; gap: 24px;">
          <el-form-item label="最大重量(kg)" style="margin-bottom: 0;">
            <el-input-number 
              v-model="formData.defaultMaxWeight" 
              :min="1" 
              :max="100"
              :step="5"
            />
          </el-form-item>
          <el-form-item label="最大物品数" style="margin-bottom: 0;">
            <el-input-number 
              v-model="formData.defaultMaxItems" 
              :min="1" 
              :max="100"
              :step="5"
            />
          </el-form-item>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="handleSubmit">
          创建项目
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { useProjectStore } from '@/stores/projectStore'
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'success'])

const projectStore = useProjectStore()
const dialogVisible = ref(false)
const loading = ref(false)
const formRef = ref(null)

const formData = reactive({
  name: '',
  description: '',
  moveDate: null,
  defaultMaxWeight: 20,
  defaultMaxItems: 20
})

const formRules = {
  name: [
    { required: true, message: '请输入项目名称', trigger: 'blur' },
    { min: 2, max: 50, message: '名称长度在 2 到 50 个字符', trigger: 'blur' }
  ]
}

watch(
  () => props.modelValue,
  (val) => {
    dialogVisible.value = val
  },
  { immediate: true }
)

watch(
  dialogVisible,
  (val) => {
    emit('update:modelValue', val)
  }
)

function resetForm() {
  formData.name = ''
  formData.description = ''
  formData.moveDate = null
  formData.defaultMaxWeight = 20
  formData.defaultMaxItems = 20
  formRef.value?.resetFields()
}

async function handleSubmit() {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {
        const project = projectStore.createNewProject(
          formData.name,
          formData.description,
          formData.moveDate
        )
        
        ElMessage.success('项目创建成功')
        emit('success', project)
        dialogVisible.value = false
      } catch (error) {
        ElMessage.error('创建失败：' + error.message)
      } finally {
        loading.value = false
      }
    }
  })
}
</script>
