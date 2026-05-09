<template>
  <div class="view-container">
    <el-card class="header-card">
      <div class="card-header">
        <h2>花材管理</h2>
        <el-button type="primary" @click="openAddDialog" :icon="Plus">
          新增花材
        </el-button>
      </div>
    </el-card>

    <el-card class="table-card">
      <el-table :data="materials" stripe style="width: 100%" v-loading="false">
        <el-table-column prop="name" label="花材名称" width="150" />
        <el-table-column prop="category" label="分类" width="100">
          <template #default="scope">
            <el-tag :type="getCategoryType(scope.row.category)">
              {{ scope.row.category }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column prop="defaultLossRate" label="默认损耗率" width="120">
          <template #default="scope">
            {{ (scope.row.defaultLossRate * 100).toFixed(0) }}%
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button type="primary" link @click="openEditDialog(scope.row)">
              编辑
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
      :title="isEdit ? '编辑花材' : '新增花材'"
      width="500px"
    >
      <el-form :model="formData" label-width="100px">
        <el-form-item label="花材名称">
          <el-input v-model="formData.name" placeholder="请输入花材名称" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="formData.category" placeholder="请选择分类" style="width: 100%">
            <el-option label="主花" value="主花" />
            <el-option label="配花" value="配花" />
            <el-option label="叶材" value="叶材" />
          </el-select>
        </el-form-item>
        <el-form-item label="单位">
          <el-select v-model="formData.unit" placeholder="请选择单位" style="width: 100%">
            <el-option label="支" value="支" />
            <el-option label="扎" value="扎" />
            <el-option label="朵" value="朵" />
            <el-option label="束" value="束" />
          </el-select>
        </el-form-item>
        <el-form-item label="默认损耗率">
          <el-slider v-model="formData.defaultLossRate" :min="0" :max="0.5" :step="0.01" :format-tooltip="formatPercent" />
          <div style="text-align: right; color: #909399">
            {{ (formData.defaultLossRate * 100).toFixed(0) }}%
          </div>
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
  materials: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['update:materials', 'save'])

const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(null)

const formData = ref({
  name: '',
  category: '主花',
  unit: '支',
  defaultLossRate: 0.1
})

const materialList = computed(() => props.materials)

function getCategoryType(category) {
  const types = {
    '主花': 'danger',
    '配花': 'success',
    '叶材': 'info'
  }
  return types[category] || ''
}

function formatPercent(val) {
  return (val * 100).toFixed(0) + '%'
}

function resetForm() {
  formData.value = {
    name: '',
    category: '主花',
    unit: '支',
    defaultLossRate: 0.1
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
    name: row.name,
    category: row.category,
    unit: row.unit,
    defaultLossRate: row.defaultLossRate
  }
  dialogVisible.value = true
}

function handleSubmit() {
  if (!formData.value.name) {
    ElMessage.warning('请输入花材名称')
    return
  }

  const duplicate = materialList.value.find(
    m => m.name === formData.value.name && m.id !== editId.value
  )
  if (duplicate) {
    ElMessage.error('花材名称已存在，请勿重复添加')
    return
  }

  const newList = [...materialList.value]
  
  if (isEdit.value) {
    const index = newList.findIndex(m => m.id === editId.value)
    if (index !== -1) {
      newList[index] = {
        ...newList[index],
        ...formData.value
      }
    }
    ElMessage.success('花材更新成功')
  } else {
    const newMaterial = {
      id: generateId(),
      ...formData.value,
      createdAt: new Date().toISOString()
    }
    newList.push(newMaterial)
    ElMessage.success('花材添加成功')
  }

  emit('update:materials', newList)
  emit('save')
  dialogVisible.value = false
  resetForm()
}

function handleDelete(row) {
  ElMessageBox.confirm(
    `确定要删除花材「${row.name}」吗？删除后关联的配方可能会受到影响。`,
    '确认删除',
    {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const newList = materialList.value.filter(m => m.id !== row.id)
    emit('update:materials', newList)
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
  align-items: center;
}

.header-card h2 {
  margin: 0;
  font-size: 18px;
  color: #303133;
}

.table-card {
  flex: 1;
}
</style>