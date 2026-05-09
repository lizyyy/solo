<template>
  <div class="view-container">
    <el-card class="header-card">
      <div class="card-header">
        <div>
          <h2>预售订单</h2>
          <div class="stats-row">
            <el-tag type="success" style="margin-right: 8px">
              已确认: {{ stats.confirmed }} 单
            </el-tag>
            <el-tag type="warning" style="margin-right: 8px">
              待确认: {{ stats.pending }} 单
            </el-tag>
            <el-tag type="danger">
              已拒绝: {{ stats.rejected }} 单
            </el-tag>
          </div>
        </div>
        <el-button type="primary" @click="openAddDialog" :icon="Plus">
          新增订单
        </el-button>
      </div>
    </el-card>

    <el-card class="filter-card">
      <el-form :inline="true" :model="filterForm">
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部状态" clearable style="width: 120px">
            <el-option label="待确认" value="pending" />
            <el-option label="已确认" value="confirmed" />
            <el-option label="已拒绝" value="rejected" />
          </el-select>
        </el-form-item>
        <el-form-item label="配送日期">
          <el-date-picker
            v-model="filterForm.deliveryDate"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="applyFilter" :icon="Search">
            筛选
          </el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <el-table :data="filteredOrders" stripe style="width: 100%" row-key="id">
        <el-table-column prop="orderNo" label="订单号" width="180" />
        <el-table-column prop="customerName" label="客户姓名" width="120" />
        <el-table-column label="花束" width="150">
          <template #default="scope">
            {{ getRecipeName(scope.row.bouquetId) }}
            <el-tag v-if="!getRecipeName(scope.row.bouquetId)" type="danger" size="small">
              配方缺失
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" width="80" />
        <el-table-column prop="deliveryDate" label="配送日期" width="120" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="notes" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="scope">
            <el-button 
              v-if="scope.row.status === 'pending'"
              type="success" 
              link 
              @click="confirmOrder(scope.row)"
            >
              确认
            </el-button>
            <el-button 
              v-if="scope.row.status === 'pending'"
              type="danger" 
              link 
              @click="rejectOrder(scope.row)"
            >
              拒绝
            </el-button>
            <el-button 
              v-if="scope.row.status !== 'rejected'"
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
      :title="isEdit ? '编辑订单' : '新增订单'"
      width="600px"
    >
      <el-form :model="formData" label-width="100px">
        <el-form-item label="订单号">
          <el-input v-model="formData.orderNo" placeholder="自动生成或手动输入" />
        </el-form-item>
        <el-form-item label="客户姓名">
          <el-input v-model="formData.customerName" placeholder="请输入客户姓名" />
        </el-form-item>
        <el-form-item label="花束配方">
          <el-select v-model="formData.bouquetId" placeholder="请选择花束配方" style="width: 100%">
            <el-option
              v-for="recipe in activeRecipes"
              :key="recipe.id"
              :label="recipe.name"
              :value="recipe.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="数量">
          <el-input-number
            v-model="formData.quantity"
            :min="1"
            :max="1000"
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="配送日期">
          <el-date-picker
            v-model="formData.deliveryDate"
            type="date"
            placeholder="选择配送日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="formData.notes"
            type="textarea"
            :rows="2"
            placeholder="备注信息（可选）"
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
import { Plus, Search } from '@element-plus/icons-vue'
import { generateId } from '../utils/storage.js'

const props = defineProps({
  preorders: {
    type: Array,
    required: true
  },
  recipes: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:preorders', 'save'])

const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(null)

const filterForm = ref({
  status: '',
  deliveryDate: ''
})

const formData = ref({
  orderNo: '',
  customerName: '',
  bouquetId: '',
  quantity: 1,
  deliveryDate: '',
  notes: '',
  status: 'pending'
})

const orderList = computed(() => props.preorders)

const stats = computed(() => {
  return {
    confirmed: orderList.value.filter(o => o.status === 'confirmed').length,
    pending: orderList.value.filter(o => o.status === 'pending').length,
    rejected: orderList.value.filter(o => o.status === 'rejected').length
  }
})

const activeRecipes = computed(() => 
  props.recipes.filter(r => r.status === 'active')
)

const filteredOrders = computed(() => {
  let result = [...orderList.value]
  
  if (filterForm.value.status) {
    result = result.filter(o => o.status === filterForm.value.status)
  }
  
  if (filterForm.value.deliveryDate) {
    result = result.filter(o => o.deliveryDate === filterForm.value.deliveryDate)
  }
  
  return result
})

function getRecipeName(recipeId) {
  const recipe = props.recipes.find(r => r.id === recipeId)
  return recipe ? recipe.name : ''
}

function getStatusType(status) {
  const types = {
    pending: 'warning',
    confirmed: 'success',
    rejected: 'danger'
  }
  return types[status] || 'info'
}

function getStatusText(status) {
  const texts = {
    pending: '待确认',
    confirmed: '已确认',
    rejected: '已拒绝'
  }
  return texts[status] || status
}

function generateOrderNo() {
  const date = new Date()
  const dateStr = date.getFullYear().toString() + 
    (date.getMonth() + 1).toString().padStart(2, '0') + 
    date.getDate().toString().padStart(2, '0')
  const count = orderList.value.filter(
    o => o.orderNo && o.orderNo.startsWith('PO' + dateStr)
  ).length + 1
  return `PO${dateStr}${count.toString().padStart(3, '0')}`
}

function resetForm() {
  formData.value = {
    orderNo: generateOrderNo(),
    customerName: '',
    bouquetId: '',
    quantity: 1,
    deliveryDate: '',
    notes: '',
    status: 'pending'
  }
  isEdit.value = false
  editId.value = null
}

function openAddDialog() {
  resetForm()
  dialogVisible.value = true
}

function openEditDialog(row) {
  if (row.status === 'rejected') {
    ElMessage.warning('已拒绝的订单无法编辑')
    return
  }
  
  resetForm()
  isEdit.value = true
  editId.value = row.id
  formData.value = {
    orderNo: row.orderNo,
    customerName: row.customerName,
    bouquetId: row.bouquetId,
    quantity: row.quantity,
    deliveryDate: row.deliveryDate,
    notes: row.notes || '',
    status: row.status
  }
  dialogVisible.value = true
}

function handleSubmit() {
  if (!formData.value.customerName) {
    ElMessage.warning('请输入客户姓名')
    return
  }
  if (!formData.value.bouquetId) {
    ElMessage.warning('请选择花束配方')
    return
  }
  if (!formData.value.deliveryDate) {
    ElMessage.warning('请选择配送日期')
    return
  }

  const recipe = props.recipes.find(r => r.id === formData.value.bouquetId)
  if (!recipe) {
    ElMessage.error('所选花束配方不存在')
    return
  }

  const duplicate = orderList.value.find(
    o => o.orderNo === formData.value.orderNo && o.id !== editId.value
  )
  if (duplicate) {
    ElMessage.error('订单号已存在，请勿重复提交')
    return
  }

  const newList = [...orderList.value]
  
  if (isEdit.value) {
    const index = newList.findIndex(o => o.id === editId.value)
    if (index !== -1) {
      const originalStatus = newList[index].status
      
      if (originalStatus === 'confirmed' && formData.value.status === 'pending') {
        ElMessage.warning('已确认的订单不能降级为待确认状态')
        return
      }
      
      newList[index] = {
        ...newList[index],
        ...formData.value,
        updatedAt: new Date().toISOString()
      }
    }
    ElMessage.success('订单更新成功')
  } else {
    const newOrder = {
      id: generateId(),
      ...formData.value,
      createdAt: new Date().toISOString()
    }
    newList.push(newOrder)
    ElMessage.success('订单添加成功')
  }

  emit('update:preorders', newList)
  emit('save')
  dialogVisible.value = false
  resetForm()
}

function confirmOrder(row) {
  if (row.status !== 'pending') {
    ElMessage.warning('只有待确认状态的订单才能确认')
    return
  }

  const recipe = props.recipes.find(r => r.id === row.bouquetId)
  if (!recipe) {
    ElMessage.error('该订单关联的花束配方已不存在，无法确认')
    return
  }

  const newList = [...orderList.value]
  const index = newList.findIndex(o => o.id === row.id)
  if (index !== -1) {
    newList[index].status = 'confirmed'
    newList[index].confirmedAt = new Date().toISOString()
    emit('update:preorders', newList)
    emit('save')
    ElMessage.success('订单已确认')
  }
}

function rejectOrder(row) {
  if (row.status !== 'pending') {
    ElMessage.warning('只有待确认状态的订单才能拒绝')
    return
  }

  ElMessageBox.confirm(
    `确定要拒绝订单 ${row.orderNo} 吗？拒绝后订单将不再参与备料计算。`,
    '确认拒绝',
    {
      confirmButtonText: '确认拒绝',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const newList = [...orderList.value]
    const index = newList.findIndex(o => o.id === row.id)
    if (index !== -1) {
      newList[index].status = 'rejected'
      newList[index].rejectedAt = new Date().toISOString()
      emit('update:preorders', newList)
      emit('save')
      ElMessage.success('订单已拒绝')
    }
  }).catch(() => {
  })
}

function cancelConfirm(row) {
  if (row.status !== 'confirmed') {
    ElMessage.warning('只有已确认状态的订单才能取消确认')
    return
  }

  ElMessageBox.confirm(
    `确定要取消订单 ${row.orderNo} 的确认状态吗？`,
    '确认操作',
    {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const newList = [...orderList.value]
    const index = newList.findIndex(o => o.id === row.id)
    if (index !== -1) {
      newList[index].status = 'pending'
      emit('update:preorders', newList)
      emit('save')
      ElMessage.success('已取消确认')
    }
  }).catch(() => {
  })
}

function handleDelete(row) {
  ElMessageBox.confirm(
    `确定要删除订单 ${row.orderNo} 吗？`,
    '确认删除',
    {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const newList = orderList.value.filter(o => o.id !== row.id)
    emit('update:preorders', newList)
    emit('save')
    ElMessage.success('删除成功')
  }).catch(() => {
  })
}

function applyFilter() {
  ElMessage.success('筛选已应用')
}

function resetFilter() {
  filterForm.value = {
    status: '',
    deliveryDate: ''
  }
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
</style>