<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
import { CSV_IMPORT_TEMPLATE } from '../data/sampleData'
import { EXPIRY_LAYERS } from '../data/constants'
import { 
  getBatchList, 
  createBatch, 
  updateBatch, 
  deleteBatch,
  importBatchesFromCSV 
} from '../utils/dataService'

const emit = defineEmits(['refresh', 'view-promotion'])

const batches = ref([])
const loading = ref(false)
const filters = ref({
  keyword: '',
  expiryLayer: '',
  isPrescription: null,
  isNearExpiryOnly: false,
  isLocked: null
})

const showCreateDialog = ref(false)
const showImportDialog = ref(false)
const editingBatch = ref(null)
const dialogMode = ref('create')

const importText = ref('')
const importResults = ref(null)

const formData = ref({
  medicineId: '',
  medicineName: '',
  batchNumber: '',
  expiryDate: '',
  quantity: 0,
  price: 0,
  isPrescription: false,
  manufacturer: ''
})

const formRules = {
  medicineId: [{ required: true, message: '请输入药品ID', trigger: 'blur' }],
  medicineName: [{ required: true, message: '请输入药品名称', trigger: 'blur' }],
  batchNumber: [{ required: true, message: '请输入批号', trigger: 'blur' }],
  expiryDate: [{ required: true, message: '请选择有效期', trigger: 'change' }],
  quantity: [{ required: true, type: 'number', min: 0, message: '库存数量必须大于等于0', trigger: 'blur' }],
  price: [{ required: true, type: 'number', min: 0, message: '单价必须大于等于0', trigger: 'blur' }]
}

function loadBatches() {
  loading.value = true
  setTimeout(() => {
    batches.value = getBatchList(filters.value)
    loading.value = false
  }, 300)
}

const filteredBatches = computed(() => batches.value)

function handleSearch() {
  loadBatches()
}

function handleReset() {
  filters.value = {
    keyword: '',
    expiryLayer: '',
    isPrescription: null,
    isNearExpiryOnly: false,
    isLocked: null
  }
  loadBatches()
}

function openCreateDialog() {
  dialogMode.value = 'create'
  editingBatch.value = null
  formData.value = {
    medicineId: '',
    medicineName: '',
    batchNumber: '',
    expiryDate: '',
    quantity: 0,
    price: 0,
    isPrescription: false,
    manufacturer: ''
  }
  showCreateDialog.value = true
}

function openEditDialog(batch) {
  dialogMode.value = 'edit'
  editingBatch.value = { ...batch }
  formData.value = {
    medicineId: batch.medicineId,
    medicineName: batch.medicineName,
    batchNumber: batch.batchNumber,
    expiryDate: batch.expiryDate,
    quantity: batch.quantity,
    price: batch.price,
    isPrescription: batch.isPrescription,
    manufacturer: batch.manufacturer || ''
  }
  showCreateDialog.value = true
}

function handleSubmit() {
  if (dialogMode.value === 'create') {
    const result = createBatch(formData.value)
    if (result.success) {
      ElMessage.success('创建成功')
      showCreateDialog.value = false
      loadBatches()
      emit('refresh')
    } else {
      ElMessage.error(result.errors.join('；'))
    }
  } else {
    const result = updateBatch(editingBatch.value.id, formData.value)
    if (result.success) {
      ElMessage.success('更新成功')
      showCreateDialog.value = false
      loadBatches()
      emit('refresh')
    } else {
      ElMessage.error(result.errors.join('；'))
    }
  }
}

function handleDelete(batch) {
  ElMessageBox.confirm(
    `确定要删除药品批次 ${batch.medicineName} (${batch.batchNumber}) 吗？`,
    '确认删除',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const result = deleteBatch(batch.id)
    if (result.success) {
      ElMessage.success('删除成功')
      loadBatches()
      emit('refresh')
    } else {
      ElMessage.error(result.errors.join('；'))
    }
  }).catch(() => {})
}

function openImportDialog() {
  importText.value = CSV_IMPORT_TEMPLATE
  importResults.value = null
  showImportDialog.value = true
}

function handleImport() {
  if (!importText.value.trim()) {
    ElMessage.warning('请输入CSV数据')
    return
  }
  
  const result = importBatchesFromCSV(importText.value)
  importResults.value = result
  
  if (result.success.length > 0) {
    ElMessage.success(`成功导入 ${result.success.length} 条数据`)
  }
  
  if (result.failed.length > 0) {
    ElMessage.warning(`有 ${result.failed.length} 条数据导入失败，已记录到问题列表`)
  }
  
  loadBatches()
  emit('refresh')
}

function getExpiryLayerInfo(layer) {
  return EXPIRY_LAYERS[layer] || { name: '未知', color: '#909399' }
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN')
}

onMounted(() => {
  loadBatches()
})
</script>

<template>
  <div class="batch-management">
    <div class="page-header">
      <h2>药品批次管理</h2>
      <div class="header-actions">
        <el-button type="primary" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>
          新增批次
        </el-button>
        <el-button @click="openImportDialog">
          <el-icon><Upload /></el-icon>
          批量导入
        </el-button>
        <el-button @click="handleReset">
          <el-icon><Refresh /></el-icon>
          重置筛选
        </el-button>
      </div>
    </div>

    <el-card class="filter-card">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="关键词">
          <el-input
            v-model="filters.keyword"
            placeholder="搜索药品名称、批号、药品ID"
            clearable
            style="width: 250px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        
        <el-form-item label="效期分层">
          <el-select v-model="filters.expiryLayer" placeholder="全部" clearable style="width: 150px">
            <el-option label="紧急层" value="URGENCY" />
            <el-option label="关注层" value="ATTENTION" />
            <el-option label="预警层" value="EARLY_WARNING" />
            <el-option label="正常" value="NORMAL" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="处方类型">
          <el-select v-model="filters.isPrescription" placeholder="全部" clearable style="width: 120px">
            <el-option label="处方药" :value="true" />
            <el-option label="非处方药" :value="false" />
          </el-select>
        </el-form-item>
        
        <el-form-item>
          <el-checkbox v-model="filters.isNearExpiryOnly">仅显示近效期</el-checkbox>
        </el-form-item>
        
        <el-form-item>
          <el-checkbox v-model="filters.isLocked">仅显示已锁定</el-checkbox>
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <el-table
        :data="filteredBatches"
        v-loading="loading"
        stripe
        style="width: 100%"
        :default-sort="{ prop: 'expiryDays', order: 'ascending' }"
      >
        <el-table-column prop="medicineName" label="药品名称" width="150">
          <template #default="{ row }">
            <div class="medicine-name">
              <span>{{ row.medicineName }}</span>
              <el-tag
                v-if="row.isPrescription"
                type="danger"
                size="small"
                effect="plain"
              >
                Rx
              </el-tag>
              <el-tag
                v-else
                type="success"
                size="small"
                effect="plain"
              >
                OTC
              </el-tag>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="batchNumber" label="批号" width="130" />
        <el-table-column prop="medicineId" label="药品ID" width="100" />
        
        <el-table-column label="效期信息" width="220">
          <template #default="{ row }">
            <div class="expiry-info">
              <div>{{ formatDate(row.expiryDate) }}</div>
              <div class="expiry-days" :class="{ urgent: row.expiryDays <= 30 }">
                剩余 {{ row.expiryDays }} 天
              </div>
              <el-tag
                :type="row.expiryLayer === 'URGENCY' ? 'danger' : 
                       row.expiryLayer === 'ATTENTION' ? 'warning' : 
                       row.expiryLayer === 'EARLY_WARNING' ? 'primary' : 'success'"
                size="small"
              >
                {{ getExpiryLayerInfo(row.expiryLayer).name }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="quantity" label="库存" width="100" align="right">
          <template #default="{ row }">
            <span :class="{ low: row.quantity < 20 }">{{ row.quantity }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="price" label="单价(元)" width="100" align="right">
          <template #default="{ row }">
            ¥{{ row.price.toFixed(2) }}
          </template>
        </el-table-column>
        
        <el-table-column prop="manufacturer" label="生产厂家" width="140" show-overflow-tooltip />
        
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.isLocked" type="warning" size="small">
              <el-icon><Lock /></el-icon> 已锁定
            </el-tag>
            <el-tag v-else type="info" size="small">
              <el-icon><Unlock /></el-icon> 可用
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEditDialog(row)">
              编辑
            </el-button>
            <el-button
              type="danger"
              link
              size="small"
              :disabled="row.isLocked"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="showCreateDialog"
      :title="dialogMode === 'create' ? '新增药品批次' : '编辑药品批次'"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="药品ID" prop="medicineId">
          <el-input v-model="formData.medicineId" placeholder="如 MED001" />
        </el-form-item>
        
        <el-form-item label="药品名称" prop="medicineName">
          <el-input v-model="formData.medicineName" placeholder="如 阿莫西林胶囊" />
        </el-form-item>
        
        <el-form-item label="批号" prop="batchNumber">
          <el-input v-model="formData.batchNumber" placeholder="如 B20240301" />
        </el-form-item>
        
        <el-form-item label="有效期" prop="expiryDate">
          <el-date-picker
            v-model="formData.expiryDate"
            type="date"
            placeholder="选择有效期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        
        <el-form-item label="库存数量" prop="quantity">
          <el-input-number
            v-model="formData.quantity"
            :min="0"
            style="width: 100%"
          />
        </el-form-item>
        
        <el-form-item label="单价" prop="price">
          <el-input-number
            v-model="formData.price"
            :min="0"
            :precision="2"
            :step="0.1"
            style="width: 100%"
          />
        </el-form-item>
        
        <el-form-item label="处方类型">
          <el-radio-group v-model="formData.isPrescription">
            <el-radio :label="true">处方药 (Rx)</el-radio>
            <el-radio :label="false">非处方药 (OTC)</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="生产厂家">
          <el-input v-model="formData.manufacturer" placeholder="如 华北制药" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">
          {{ dialogMode === 'create' ? '创建' : '保存' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showImportDialog"
      title="批量导入药品批次"
      width="700px"
      :close-on-click-modal="false"
    >
      <div class="import-instructions">
        <el-alert
          type="info"
          :closable="false"
          show-icon
          title="请按照以下格式输入CSV数据，第一行为表头"
        />
        <div class="template-info">
          <strong>表头格式：</strong>药品ID,药品名称,批号,有效期,库存数量,单价,是否处方药,生产厂家
        </div>
      </div>
      
      <el-input
        v-model="importText"
        type="textarea"
        :rows="10"
        placeholder="请粘贴CSV格式数据..."
        class="import-textarea"
      />
      
      <div v-if="importResults" class="import-results">
        <el-alert
          :type="importResults.failed.length > 0 ? 'warning' : 'success'"
          :closable="false"
          show-icon
        >
          <template #title>
            导入结果：成功 {{ importResults.success.length }} 条，失败 {{ importResults.failed.length }} 条
          </template>
          <div v-if="importResults.failed.length > 0" class="failed-details">
            <strong>失败详情（已记录到问题列表）：</strong>
            <ul>
              <li v-for="(item, index) in importResults.failed" :key="index">
                第 {{ item.row }} 行: {{ item.errors.join('；') }}
              </li>
            </ul>
          </div>
        </el-alert>
      </div>
      
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" @click="handleImport">
          <el-icon><Upload /></el-icon>
          开始导入
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.batch-management {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h2 {
  margin: 0;
  font-size: 18px;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.filter-card {
  background: #fff;
}

.filter-form {
  margin: 0;
}

.table-card {
  background: #fff;
}

.medicine-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.expiry-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.expiry-days {
  font-size: 12px;
  color: #606266;
}

.expiry-days.urgent {
  color: #f56c6c;
  font-weight: bold;
}

.low {
  color: #f56c6c;
  font-weight: bold;
}

.import-instructions {
  margin-bottom: 16px;
}

.template-info {
  margin-top: 12px;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  color: #606266;
}

.import-textarea {
  font-family: monospace;
  font-size: 12px;
}

.import-results {
  margin-top: 16px;
}

.failed-details {
  margin-top: 8px;
}

.failed-details ul {
  margin: 8px 0 0 0;
  padding-left: 20px;
}

.failed-details li {
  font-size: 12px;
  color: #e6a23c;
}
</style>
