<template>
  <div class="view-container">
    <el-card class="header-card">
      <div class="card-header">
        <div>
          <h2>替换方案</h2>
          <div class="desc">
            当主花材缺货时，可使用预设的替换方案自动计算替代花材需求
          </div>
        </div>
        <el-button type="primary" @click="openAddDialog" :icon="Plus">
          新增方案
        </el-button>
      </div>
    </el-card>

    <el-card class="table-card">
      <el-table :data="substitutePlans" stripe style="width: 100%">
        <el-table-column label="原花材" width="150">
          <template #default="scope">
            <div>
              <span class="material-name">{{ getMaterialName(scope.row.originalMaterialId) }}</span>
              <el-tag type="danger" size="small" style="margin-left: 4px">缺货</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="替换花材" width="150">
          <template #default="scope">
            <div>
              <span class="material-name">{{ getMaterialName(scope.row.substituteMaterialId) }}</span>
              <el-tag type="success" size="small" style="margin-left: 4px">替代</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="替换比例" width="120">
          <template #default="scope">
            <span class="ratio-text">
              {{ scope.row.substituteRatio }} : 1
            </span>
            <div class="ratio-desc">
              ({{ scope.row.substituteRatio }}支原花材 = 1支替换花材)
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="说明" min-width="200" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'active' ? 'success' : 'info'">
              {{ scope.row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="scope">
            <el-button type="primary" link @click="openEditDialog(scope.row)">
              编辑
            </el-button>
            <el-button type="success" link @click="toggleStatus(scope.row)">
              {{ scope.row.status === 'active' ? '停用' : '启用' }}
            </el-button>
            <el-button type="danger" link @click="handleDelete(scope.row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑方案' : '新增方案'"
      width="600px"
    >
      <el-form :model="formData" label-width="100px">
        <el-form-item label="原花材">
          <el-select v-model="formData.originalMaterialId" placeholder="请选择缺货的花材" style="width: 100%">
            <el-option
              v-for="mat in availableOriginalMaterials"
              :key="mat.id"
              :label="mat.name"
              :value="mat.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="替换花材">
          <el-select v-model="formData.substituteMaterialId" placeholder="请选择替代花材" style="width: 100%">
            <el-option
              v-for="mat in availableSubstituteMaterials"
              :key="mat.id"
              :label="mat.name"
              :value="mat.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="替换比例">
          <el-input-number
            v-model="formData.substituteRatio"
            :min="0.1"
            :max="10"
            :step="0.5"
            style="width: 150px"
          />
          <span class="form-tip"> (原花材数量 : 替换花材数量)</span>
        </el-form-item>
        <el-form-item label="说明">
          <el-input
            v-model="formData.reason"
            type="textarea"
            :rows="2"
            placeholder="请输入替换方案说明"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { generateId } from '../utils/storage.js'

const props = defineProps({
  substitutePlans: {
    type: Array,
    required: true
  },
  materials: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:substitutePlans', 'save'])

const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(null)

const formData = ref({
  originalMaterialId: '',
  substituteMaterialId: '',
  substituteRatio: 1,
  reason: ''
})

const planList = computed(() => props.substitutePlans)

const availableOriginalMaterials = computed(() => {
  if (!isEdit.value) {
    const usedIds = planList.value
      .filter(p => p.status === 'active')
      .map(p => p.originalMaterialId)
    return props.materials.filter(m => !usedIds.includes(m.id))
  }
  return props.materials
})

const availableSubstituteMaterials = computed(() => {
  if (formData.value.originalMaterialId) {
    return props.materials.filter(m => m.id !== formData.value.originalMaterialId)
  }
  return props.materials
})

function getMaterialName(materialId) {
  const mat = props.materials.find(m => m.id === materialId)
  return mat ? mat.name : '未知花材'
}

function resetForm() {
  formData.value = {
    originalMaterialId: '',
    substituteMaterialId: '',
    substituteRatio: 1,
    reason: ''
  }
  isEdit.value = false
  editId.value = null
}

function openAddDialog() {
  resetForm()
  dialogVisible.value = true
}

function openEditDialog(row) {
  resetForm()
  isEdit.value = true
  editId.value = row.id
  formData.value = {
    originalMaterialId: row.originalMaterialId,
    substituteMaterialId: row.substituteMaterialId,
    substituteRatio: row.substituteRatio,
    reason: row.reason || ''
  }
  dialogVisible.value = true
}

function handleSubmit() {
  if (!formData.value.originalMaterialId) {
    ElMessage.warning('请选择原花材')
    return
  }
  if (!formData.value.substituteMaterialId) {
    ElMessage.warning('请选择替换花材')
    return
  }
  if (formData.value.originalMaterialId === formData.value.substituteMaterialId) {
    ElMessage.warning('原花材和替换花材不能相同')
    return
  }
  if (!formData.value.substituteRatio || formData.value.substituteRatio <= 0) {
    ElMessage.warning('请输入有效的替换比例')
    return
  }

  const originalMat = props.materials.find(m => m.id === formData.value.originalMaterialId)
  const substituteMat = props.materials.find(m => m.id === formData.value.substituteMaterialId)
  if (!originalMat || !substituteMat) {
    ElMessage.error('所选花材不存在')
    return
  }

  const existing = planList.value.find(
    p => p.originalMaterialId === formData.value.originalMaterialId && 
         p.id !== editId.value
  )
  if (existing) {
    ElMessage.error(`${getMaterialName(formData.value.originalMaterialId)}已存在替换方案`)
    return
  }

  const circular = planList.value.find(
    p => p.originalMaterialId === formData.value.substituteMaterialId &&
         p.substituteMaterialId === formData.value.originalMaterialId &&
         p.id !== editId.value
  )
  if (circular) {
    ElMessage.warning('检测到循环替换，请检查方案设置')
  }

  const newList = [...planList.value]
  
  if (isEdit.value) {
    const index = newList.findIndex(p => p.id === editId.value)
    if (index !== -1) {
      newList[index] = {
        ...newList[index],
        ...formData.value,
        updatedAt: new Date().toISOString()
      }
    }
    ElMessage.success('替换方案更新成功')
  } else {
    const newItem = {
      id: generateId(),
      ...formData.value,
      status: 'active',
      createdAt: new Date().toISOString()
    }
    newList.push(newItem)
    ElMessage.success('替换方案添加成功')
  }

  emit('update:substitutePlans', newList)
  emit('save')
  dialogVisible.value = false
  resetForm()
}

function toggleStatus(row) {
  const newList = [...planList.value]
  const index = newList.findIndex(p => p.id === row.id)
  if (index !== -1) {
    newList[index].status = newList[index].status === 'active' ? 'inactive' : 'active'
    emit('update:substitutePlans', newList)
    emit('save')
    ElMessage.success(
      `方案已${newList[index].status === 'active' ? '启用' : '停用'}`
    )
  }
}

function handleDelete(row) {
  ElMessageBox.confirm(
    '确定要删除该替换方案吗？',
    '确认删除',
    {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const newList = planList.value.filter(p => p.id !== row.id)
    emit('update:substitutePlans', newList)
    emit('save')
    ElMessage.success('删除成功')
  }).catch(() => {
  })
}
</script>

<style scoped>
.view-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.header-card h2 {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: #303133;
}

.desc {
  font-size: 14px;
  color: #909399;
}

.table-card {
  flex: 1;
}

.material-name {
  font-weight: 500;
}

.ratio-text {
  font-weight: bold;
  color: #409eff;
  font-size: 16px;
}

.ratio-desc {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.form-tip {
  font-size: 14px;
  color: #909399;
  margin-left: 8px;
}
</style>