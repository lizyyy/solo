<template>
  <div class="view-container">
    <el-card class="header-card">
      <div class="card-header">
        <div>
          <h2>损耗记录</h2>
          <div class="stats-row">
            <el-tag type="success" style="margin-right: 8px">
              已确认损耗: {{ stats.confirmed }} 笔
            </el-tag>
            <el-tag type="warning">
              待确认: {{ stats.pending }} 笔
            </el-tag>
          </div>
        </div>
        <el-button type="primary" @click="openAddDialog" :icon="Plus">
          新增损耗
        </el-button>
      </div>
    </el-card>

    <el-card class="table-card">
      <el-table :data="lossRecords" stripe style="width: 100%">
        <el-table-column label="花材" width="150">
          <template #default="scope">
            {{ getMaterialName(scope.row.materialId) }}
          </template>
        </el-table-column>
        <el-table-column label="分类" width="100">
          <template #default="scope">
            <el-tag :type="getCategoryType(scope.row.materialId)" size="small">
              {{ getMaterialCategory(scope.row.materialId) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="损耗数量" width="120">
          <template #default="scope">
            <span class="loss-value">{{ scope.row.quantity }}</span>
            <span class="loss-unit">{{ getMaterialUnit(scope.row.materialId) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="损耗原因" min-width="150" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'confirmed' ? 'success' : 'warning'">
              {{ scope.row.status === 'confirmed' ? '已确认' : '待确认' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="登记时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.recordedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="scope">
            <el-button
              v-if="scope.row.status === 'pending'"
              type="success"
              link
              @click="confirmLoss(scope.row)"
            >
              确认
            </el-button>
            <el-button
              v-if="scope.row.status === 'pending'"
              type="primary"
              link
              @click="openEditDialog(scope.row)"
            >
              编辑
            </el-button>
            <el-button
              v-if="scope.row.status === 'confirmed'"
              type="warning"
              link
              @click="cancelConfirm(scope.row)"
            >
              取消确认
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
      :title="isEdit ? '编辑损耗' : '新增损耗'"
      width="500px"
    >
      <el-form :model="formData" label-width="100px">
        <el-form-item label="花材">
          <el-select v-model="formData.materialId" placeholder="请选择花材" style="width: 100%">
            <el-option
              v-for="mat in materials"
              :key="mat.id"
              :label="mat.name"
              :value="mat.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="损耗数量">
          <el-input-number
            v-model="formData.quantity"
            :min="1"
            :max="1000"
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="损耗原因">
          <el-select v-model="formData.reason" placeholder="请选择或输入原因" style="width: 100%">
            <el-option label="运输损坏" value="运输损坏" />
            <el-option label="花期提前凋谢" value="花期提前凋谢" />
            <el-option label="质量不合格" value="质量不合格" />
            <el-option label="操作失误" value="操作失误" />
            <el-option label="其他" value="其他" />
          </el-select>
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
  lossRecords: {
    type: Array,
    required: true
  },
  materials: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:lossRecords', 'save'])

const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(null)

const formData = ref({
  materialId: '',
  quantity: 1,
  reason: '运输损坏'
})

const lossList = computed(() => props.lossRecords)

const stats = computed(() => {
  return {
    confirmed: lossList.value.filter(l => l.status === 'confirmed').length,
    pending: lossList.value.filter(l => l.status === 'pending').length
  }
})

function getMaterialName(materialId) {
  const mat = props.materials.find(m => m.id === materialId)
  return mat ? mat.name : '未知花材'
}

function getMaterialCategory(materialId) {
  const mat = props.materials.find(m => m.id === materialId)
  return mat ? mat.category : ''
}

function getMaterialUnit(materialId) {
  const mat = props.materials.find(m => m.id === materialId)
  return mat ? mat.unit : ''
}

function getCategoryType(materialId) {
  const category = getMaterialCategory(materialId)
  const types = {
    '主花': 'danger',
    '配花': 'success',
    '叶材': 'info'
  }
  return types[category] || ''
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

function resetForm() {
  formData.value = {
    materialId: '',
    quantity: 1,
    reason: '运输损坏'
  }
  isEdit.value = false
  editId.value = null
}

function openAddDialog() {
  resetForm()
  dialogVisible.value = true
}

function openEditDialog(row) {
  if (row.status === 'confirmed') {
    ElMessage.warning('已确认的损耗记录无法编辑')
    return
  }
  
  resetForm()
  isEdit.value = true
  editId.value = row.id
  formData.value = {
    materialId: row.materialId,
    quantity: row.quantity,
    reason: row.reason
  }
  dialogVisible.value = true
}

function handleSubmit() {
  if (!formData.value.materialId) {
    ElMessage.warning('请选择花材')
    return
  }
  if (!formData.value.quantity || formData.value.quantity <= 0) {
    ElMessage.warning('请输入有效的损耗数量')
    return
  }
  if (!formData.value.reason) {
    ElMessage.warning('请选择或输入损耗原因')
    return
  }

  const material = props.materials.find(m => m.id === formData.value.materialId)
  if (!material) {
    ElMessage.error('所选花材不存在')
    return
  }

  const newList = [...lossList.value]
  
  if (isEdit.value) {
    const index = newList.findIndex(l => l.id === editId.value)
    if (index !== -1) {
      newList[index] = {
        ...newList[index],
        ...formData.value,
        updatedAt: new Date().toISOString()
      }
    }
    ElMessage.success('损耗记录更新成功')
  } else {
    const existing = newList.find(
      l => l.materialId === formData.value.materialId && 
           l.status === 'pending' &&
           l.reason === formData.value.reason
    )
    if (existing) {
      ElMessageBox.confirm(
        `已存在${getMaterialName(formData.value.materialId)}的待确认损耗记录，是否合并？`,
        '确认操作',
        {
          confirmButtonText: '合并',
          cancelButtonText: '取消',
          type: 'warning'
        }
      ).then(() => {
        const index = newList.findIndex(l => l.id === existing.id)
        newList[index].quantity += formData.value.quantity
        emit('update:lossRecords', newList)
        emit('save')
        ElMessage.success('损耗记录已合并')
      }).catch(() => {
      })
      dialogVisible.value = false
      return
    }

    const newItem = {
      id: generateId(),
      ...formData.value,
      status: 'pending',
      recordedAt: new Date().toISOString()
    }
    newList.push(newItem)
    ElMessage.success('损耗记录添加成功')
  }

  emit('update:lossRecords', newList)
  emit('save')
  dialogVisible.value = false
  resetForm()
}

function confirmLoss(row) {
  if (row.status !== 'pending') {
    ElMessage.warning('只有待确认状态的记录才能确认')
    return
  }

  const newList = [...lossList.value]
  const index = newList.findIndex(l => l.id === row.id)
  if (index !== -1) {
    newList[index].status = 'confirmed'
    newList[index].confirmedAt = new Date().toISOString()
    emit('update:lossRecords', newList)
    emit('save')
    ElMessage.success('损耗记录已确认')
  }
}

function cancelConfirm(row) {
  if (row.status !== 'confirmed') {
    ElMessage.warning('只有已确认状态的记录才能取消确认')
    return
  }

  ElMessageBox.confirm(
    '确定要取消该损耗记录的确认状态吗？',
    '确认操作',
    {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const newList = [...lossList.value]
    const index = newList.findIndex(l => l.id === row.id)
    if (index !== -1) {
      newList[index].status = 'pending'
      emit('update:lossRecords', newList)
      emit('save')
      ElMessage.success('已取消确认')
    }
  }).catch(() => {
  })
}

function handleDelete(row) {
  ElMessageBox.confirm(
    '确定要删除该损耗记录吗？',
    '确认删除',
    {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const newList = lossList.value.filter(l => l.id !== row.id)
    emit('update:lossRecords', newList)
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

.stats-row {
  display: flex;
}

.table-card {
  flex: 1;
}

.loss-value {
  font-weight: bold;
  color: #f56c6c;
}

.loss-unit {
  font-size: 12px;
  color: #909399;
  margin-left: 4px;
}
</style>