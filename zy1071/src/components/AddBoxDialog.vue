<template>
  <el-dialog
    v-model="dialogVisible"
    :title="editingBox ? '编辑箱子' : '添加箱子'"
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
      <el-form-item label="箱号" prop="boxNumber">
        <el-input 
          v-model="formData.boxNumber" 
          placeholder="自动生成或手动输入"
          clearable
          :disabled="!!editingBox"
        />
        <div style="font-size: 12px; color: #909399; margin-top: 4px;">
          留空则自动生成下一个序号
        </div>
      </el-form-item>
      
      <el-form-item label="箱子名称">
        <el-input 
          v-model="formData.name" 
          placeholder="例如：客厅日用品、卧室衣物"
          clearable
        />
      </el-form-item>
      
      <el-form-item label="目标房间">
        <el-select
          v-model="formData.targetRoomId"
          placeholder="选择目标房间（可选）"
          clearable
          style="width: 100%;"
        >
          <el-option-group label="目标房间">
            <el-option
              v-for="room in projectStore.targetRooms"
              :key="room.id"
              :label="room.name"
              :value="room.id"
            />
          </el-option-group>
        </el-select>
      </el-form-item>
      
      <el-form-item label="负责人">
        <el-input 
          v-model="formData.responsiblePerson" 
          placeholder="负责人姓名（可选）"
          clearable
        />
      </el-form-item>
      
      <el-divider content-position="left">箱子容量</el-divider>
      
      <el-form-item label="容量限制">
        <div style="display: flex; gap: 24px;">
          <el-form-item label="最大重量(kg)" style="margin-bottom: 0;">
            <el-input-number 
              v-model="formData.maxWeight" 
              :min="1" 
              :max="100"
              :step="5"
            />
          </el-form-item>
          <el-form-item label="最大物品数" style="margin-bottom: 0;">
            <el-input-number 
              v-model="formData.maxItems" 
              :min="1" 
              :max="100"
              :step="5"
            />
          </el-form-item>
        </div>
      </el-form-item>
      
      <el-form-item v-if="editingBox" label="当前状态">
        <el-select 
          v-model="formData.status" 
          style="width: 100%;"
        >
          <el-option label="待装箱" value="pending" />
          <el-option label="已封箱" value="packed" />
          <el-option label="已搬运" value="moved" />
          <el-option label="已到达" value="arrived" />
          <el-option label="已拆箱" value="unpacked" />
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="handleSubmit">
          {{ editingBox ? '保存' : '添加' }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { useProjectStore } from '@/stores/projectStore'
import { ElMessage } from 'element-plus'
import { BoxStatus } from '@/models/types'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  editingBox: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'success'])

const projectStore = useProjectStore()
const dialogVisible = ref(false)
const loading = ref(false)
const formRef = ref(null)

const formData = reactive({
  boxNumber: '',
  name: '',
  targetRoomId: null,
  responsiblePerson: '',
  maxWeight: 20,
  maxItems: 20,
  status: BoxStatus.PENDING
})

const formRules = {
  boxNumber: [
    { required: false, trigger: 'blur' }
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

watch(
  () => props.editingBox,
  (val) => {
    if (val) {
      formData.boxNumber = val.boxNumber
      formData.name = val.name || ''
      formData.targetRoomId = val.targetRoomId
      formData.responsiblePerson = val.responsiblePerson || ''
      formData.maxWeight = val.maxWeight
      formData.maxItems = val.maxItems
      formData.status = val.status
    }
  },
  { immediate: true, deep: true }
)

function resetForm() {
  if (!props.editingBox) {
    formData.boxNumber = ''
    formData.name = ''
    formData.targetRoomId = null
    formData.responsiblePerson = ''
    formData.maxWeight = 20
    formData.maxItems = 20
    formData.status = BoxStatus.PENDING
  }
  formRef.value?.resetFields()
}

async function handleSubmit() {
  loading.value = true
  try {
    if (props.editingBox) {
      projectStore.updateBox(props.editingBox.id, {
        name: formData.name,
        targetRoomId: formData.targetRoomId,
        responsiblePerson: formData.responsiblePerson,
        maxWeight: formData.maxWeight,
        maxItems: formData.maxItems
      })
      
      if (formData.status !== props.editingBox.status) {
        projectStore.changeBoxStatus(props.editingBox.id, formData.status, '状态修改')
      }
      
      ElMessage.success('箱子已更新')
      emit('success', { ...props.editingBox, ...formData })
    } else {
      const box = projectStore.addBox({
        boxNumber: formData.boxNumber || undefined,
        name: formData.name,
        targetRoomId: formData.targetRoomId,
        responsiblePerson: formData.responsiblePerson,
        maxWeight: formData.maxWeight,
        maxItems: formData.maxItems
      })
      
      ElMessage.success('箱子已添加')
      emit('success', box)
    }
    
    dialogVisible.value = false
  } catch (error) {
    ElMessage.error('操作失败：' + error.message)
  } finally {
    loading.value = false
  }
}
</script>
