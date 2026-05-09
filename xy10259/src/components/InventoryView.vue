<template>
  <div class="view-container">
    <el-card class="header-card">
      <div class="card-header">
        <h2>库存管理</h2>
        <div class="header-actions">
          <el-button type="success" @click="openArrivalDialog" :icon="Plus">
            登记到货
          </el-button>
        </div>
      </div>
    </el-card>

    <el-card class="table-card">
      <el-table :data="inventoryWithInfo" stripe style="width: 100%">
        <el-table-column label="花材" width="150">
          <template #default="scope">
            <div>
              <div>{{ getMaterialName(scope.row.materialId) }}</div>
              <div class="batch-no" v-if="scope.row.batchNumber">
                {{ scope.row.batchNumber }}
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="分类" width="100">
          <template #default="scope">
            <el-tag :type="getCategoryType(scope.row.materialId)" size="small">
              {{ getMaterialCategory(scope.row.materialId) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="现有库存" width="120">
          <template #default="scope">
            <span class="stock-value">{{ scope.row.quantity }}</span>
            <span class="stock-unit">{{ getMaterialUnit(scope.row.materialId) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="pendingArrival" label="待到货" width="120">
          <template #default="scope">
            <span v-if="scope.row.pendingArrival > 0" class="pending-value">
              {{ scope.row.pendingArrival }}
              <span class="stock-unit">{{ getMaterialUnit(scope.row.materialId) }}</span>
            </span>
            <span v-else style="color: #909399">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="arrivalDate" label="到货日期" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStockStatus(scope.row)">
              {{ getStockStatusText(scope.row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
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
      :title="isEdit ? '编辑库存' : '登记到货'"
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
        <el-form-item label="现有库存">
          <el-input-number
            v-model="formData.quantity"
            :min="0"
            :max="10000"
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="待到货">
          <el-input-number
            v-model="formData.pendingArrival"
            :min="0"
            :max="10000"
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="批次号">
          <el-input v-model="formData.batchNumber" placeholder="自动生成或手动输入" />
        </el-form-item>
        <el-form-item label="到货日期">
          <el-date-picker
            v-model="formData.arrivalDate"
            type="date"
            placeholder="选择到货日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 200px"
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
  inventory: {
    type: Array,
    required: true
  },
  materials: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:inventory', 'save'])

const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(null)

const formData = ref({
  materialId: '',
  quantity: 0,
  pendingArrival: 0,
  batchNumber: '',
  arrivalDate: ''
})

const inventoryList = computed(() => props.inventory)

const inventoryWithInfo = computed(() => {
  return inventoryList.value.map(item => ({
    ...item,
    materialInfo: props.materials.find(m => m.id === item.materialId)
  }))
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

function getStockStatus(row) {
  if (row.quantity === 0 && row.pendingArrival === 0) return 'danger'
  if (row.quantity === 0 && row.pendingArrival > 0) return 'warning'
  return 'success'
}

function getStockStatusText(row) {
  if (row.quantity === 0 && row.pendingArrival === 0) return '缺货'
  if (row.quantity === 0 && row.pendingArrival > 0) return '待到货'
  return '有货'
}

function generateBatchNo() {
  const date = new Date()
  const dateStr = date.getFullYear().toString() + 
    (date.getMonth() + 1).toString().padStart(2, '0') + 
    date.getDate().toString().padStart(2, '0')
  return `B${dateStr}`
}

function resetForm() {
  formData.value = {
    materialId: '',
    quantity: 0,
    pendingArrival: 0,
    batchNumber: generateBatchNo(),
    arrivalDate: new Date().toISOString().split('T')[0]
  }
  isEdit.value = false
  editId.value = null
}

function openArrivalDialog() {
  resetForm()
  dialogVisible.value = true
}

function openEditDialog(row) {
  resetForm()
  isEdit.value = true
  editId.value = row.id
  formData.value = {
    materialId: row.materialId,
    quantity: row.quantity,
    pendingArrival: row.pendingArrival,
    batchNumber: row.batchNumber || '',
    arrivalDate: row.arrivalDate || ''
  }
  dialogVisible.value = true
}

function handleSubmit() {
  if (!formData.value.materialId) {
    ElMessage.warning('请选择花材')
    return
  }

  const material = props.materials.find(m => m.id === formData.value.materialId)
  if (!material) {
    ElMessage.error('所选花材不存在')
    return
  }

  const newList = [...inventoryList.value]
  
  if (isEdit.value) {
    const index = newList.findIndex(i => i.id === editId.value)
    if (index !== -1) {
      newList[index] = {
        ...newList[index],
        ...formData.value,
        updatedAt: new Date().toISOString()
      }
    }
    ElMessage.success('库存更新成功')
  } else {
    const existing = newList.find(
      i => i.materialId === formData.value.materialId && 
           i.batchNumber === formData.value.batchNumber
    )
    if (existing) {
      ElMessageBox.confirm(
        `已存在相同批次的${getMaterialName(formData.value.materialId)}库存，是否合并？`,
        '确认操作',
        {
          confirmButtonText: '合并',
          cancelButtonText: '取消',
          type: 'warning'
        }
      ).then(() => {
        const index = newList.findIndex(i => i.id === existing.id)
        newList[index].quantity += formData.value.quantity
        newList[index].pendingArrival += formData.value.pendingArrival
        emit('update:inventory', newList)
        emit('save')
        ElMessage.success('库存已合并')
      }).catch(() => {
      })
      dialogVisible.value = false
      return
    }

    const newItem = {
      id: generateId(),
      ...formData.value,
      createdAt: new Date().toISOString()
    }
    newList.push(newItem)
    ElMessage.success('到货登记成功')
  }

  emit('update:inventory', newList)
  emit('save')
  dialogVisible.value = false
  resetForm()
}

function handleDelete(row) {
  ElMessageBox.confirm(
    `确定要删除 ${getMaterialName(row.materialId)} 的库存记录吗？`,
    '确认删除',
    {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const newList = inventoryList.value.filter(i => i.id !== row.id)
    emit('update:inventory', newList)
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

.batch-no {
  font-size: 12px;
  color: #909399;
}

.stock-value {
  font-weight: bold;
  color: #67c23a;
}

.pending-value {
  color: #e6a23c;
}

.stock-unit {
  font-size: 12px;
  color: #909399;
  margin-left: 4px;
}
</style>