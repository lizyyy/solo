<template>
  <el-dialog
    v-model="dialogVisible"
    :title="editingItem ? '编辑物品' : '添加物品'"
    width="600px"
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
      <div class="form-section">
        <div class="form-section-title">基本信息</div>
        
        <el-form-item label="物品名称" prop="name">
          <el-input 
            v-model="formData.name" 
            placeholder="例如：液晶电视、羽绒服"
            clearable
          />
        </el-form-item>
        
        <el-form-item label="描述">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="2"
            placeholder="物品描述（可选）"
          />
        </el-form-item>
        
        <el-form-item label="数量/重量">
          <div style="display: flex; gap: 16px;">
            <el-form-item label="数量" prop="quantity" style="margin-bottom: 0;">
              <el-input-number 
                v-model="formData.quantity" 
                :min="1" 
                :max="999"
              />
            </el-form-item>
            <el-form-item label="重量(kg)" prop="weight" style="margin-bottom: 0;">
              <el-input-number 
                v-model="formData.weight" 
                :min="0" 
                :max="100"
                :precision="1"
                :step="0.5"
              />
            </el-form-item>
          </div>
        </el-form-item>
      </div>
      
      <div class="form-section">
        <div class="form-section-title">分类信息</div>
        
        <el-form-item label="源房间">
          <el-select
            v-model="formData.roomId"
            placeholder="选择来源房间"
            clearable
            style="width: 100%;"
          >
            <el-option
              v-for="room in projectStore.sourceRooms"
              :key="room.id"
              :label="room.name"
              :value="room.id"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="所属箱子">
          <el-select
            v-model="formData.boxId"
            placeholder="选择箱子（可选，不选则为未装箱）"
            clearable
            style="width: 100%;"
          >
            <el-option
              v-for="box in projectStore.boxes"
              :key="box.id"
              :label="`#${box.boxNumber} - ${box.name || '未命名'}`"
              :value="box.id"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="负责人">
          <el-input 
            v-model="formData.responsiblePerson" 
            placeholder="负责人姓名（可选）"
            clearable
          />
        </el-form-item>
      </div>
      
      <div class="form-section">
        <div class="form-section-title">标签与特殊属性</div>
        
        <el-form-item label="标签">
          <div class="checkbox-group">
            <el-checkbox 
              v-model="formData.isFragile"
              label="易碎"
            >
              <el-tag type="danger" size="small">易碎</el-tag>
            </el-checkbox>
            <el-checkbox 
              v-model="formData.isValuable"
              label="贵重"
            >
              <el-tag type="warning" size="small">贵重</el-tag>
            </el-checkbox>
            <el-checkbox 
              v-model="formData.isUrgent"
              label="急用"
            >
              <el-tag type="primary" size="small">急用</el-tag>
            </el-checkbox>
            <el-checkbox 
              v-model="formData.isDocument"
              label="证件"
            >
              <el-tag type="success" size="small">证件</el-tag>
            </el-checkbox>
          </div>
        </el-form-item>
        
        <el-form-item 
          v-if="formData.isFragile" 
          label="缓冲说明"
          :required="true"
        >
          <el-input
            v-model="formData.cushioningNote"
            type="textarea"
            :rows="2"
            placeholder="请描述缓冲保护方式，例如：使用气泡膜包裹、竖放勿压等"
          />
          <div style="font-size: 12px; color: #909399; margin-top: 4px;">
            易碎物品建议填写缓冲保护说明
          </div>
        </el-form-item>
      </div>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="handleSubmit">
          {{ editingItem ? '保存' : '添加' }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { useProjectStore } from '@/stores/projectStore'
import { ElMessage } from 'element-plus'
import { SystemTagLabels } from '@/models/types'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  editingItem: {
    type: Object,
    default: null
  },
  selectedBox: {
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
  name: '',
  description: '',
  quantity: 1,
  weight: 0,
  roomId: null,
  boxId: null,
  responsiblePerson: '',
  tags: [],
  cushioningNote: '',
  isFragile: false,
  isValuable: false,
  isUrgent: false,
  isDocument: false
})

const formRules = {
  name: [
    { required: true, message: '请输入物品名称', trigger: 'blur' },
    { min: 1, max: 100, message: '名称长度在 1 到 100 个字符', trigger: 'blur' }
  ],
  quantity: [
    { required: true, message: '请输入数量', trigger: 'blur' }
  ],
  weight: [
    { required: true, message: '请输入重量', trigger: 'blur' }
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
  () => props.selectedBox,
  (val) => {
    if (val && !props.editingItem) {
      formData.boxId = val.id
    }
  },
  { immediate: true }
)

watch(
  () => props.editingItem,
  (val) => {
    if (val) {
      formData.name = val.name
      formData.description = val.description || ''
      formData.quantity = val.quantity
      formData.weight = val.weight
      formData.roomId = val.roomId
      formData.boxId = val.boxId
      formData.responsiblePerson = val.responsiblePerson || ''
      formData.cushioningNote = val.cushioningNote || ''
      
      formData.isFragile = val.tags.includes(SystemTagLabels.fragile)
      formData.isValuable = val.tags.includes(SystemTagLabels.valuable)
      formData.isUrgent = val.tags.includes(SystemTagLabels.urgent)
      formData.isDocument = val.tags.includes(SystemTagLabels.document)
    }
  },
  { immediate: true, deep: true }
)

function resetForm() {
  if (!props.editingItem) {
    formData.name = ''
    formData.description = ''
    formData.quantity = 1
    formData.weight = 0
    formData.roomId = null
    formData.boxId = props.selectedBox?.id || null
    formData.responsiblePerson = ''
    formData.cushioningNote = ''
    formData.isFragile = false
    formData.isValuable = false
    formData.isUrgent = false
    formData.isDocument = false
  }
  formRef.value?.resetFields()
}

function buildTags() {
  const tags = []
  if (formData.isFragile) tags.push(SystemTagLabels.fragile)
  if (formData.isValuable) tags.push(SystemTagLabels.valuable)
  if (formData.isUrgent) tags.push(SystemTagLabels.urgent)
  if (formData.isDocument) tags.push(SystemTagLabels.document)
  return tags
}

async function handleSubmit() {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {
        const tags = buildTags()
        
        if (props.editingItem) {
          projectStore.updateItem(props.editingItem.id, {
            name: formData.name,
            description: formData.description,
            quantity: formData.quantity,
            weight: formData.weight,
            roomId: formData.roomId,
            boxId: formData.boxId,
            responsiblePerson: formData.responsiblePerson,
            cushioningNote: formData.cushioningNote,
            tags
          })
          
          ElMessage.success('物品已更新')
          emit('success', { ...props.editingItem, ...formData, tags })
        } else {
          const item = projectStore.addItem({
            name: formData.name,
            description: formData.description,
            quantity: formData.quantity,
            weight: formData.weight,
            roomId: formData.roomId,
            boxId: formData.boxId,
            responsiblePerson: formData.responsiblePerson,
            cushioningNote: formData.cushioningNote,
            tags
          })
          
          ElMessage.success('物品已添加')
          emit('success', item)
        }
        
        dialogVisible.value = false
      } catch (error) {
        ElMessage.error('操作失败：' + error.message)
      } finally {
        loading.value = false
      }
    }
  })
}
</script>
