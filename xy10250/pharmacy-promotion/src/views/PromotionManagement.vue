<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { PROMOTION_STATUS, PROMOTION_STATUS_LABEL, DISCOUNT_TYPES, DISCOUNT_TYPE_LABEL } from '../data/constants'
import { EXPIRY_LAYERS } from '../data/constants'
import { 
  getPromotionList, 
  getBatchList,
  createPromotion,
  transitionPromotionStatus 
} from '../utils/dataService'
import { validatePromotion, calculateExpiryDays, getExpiryLayer, isNearExpiry } from '../utils/rules'

const emit = defineEmits(['refresh', 'view-detail'])

const promotions = ref([])
const loading = ref(false)
const filters = ref({
  keyword: '',
  status: ''
})

const showCreateDialog = ref(false)
const formData = ref({
  name: '',
  description: '',
  validFrom: '',
  validTo: '',
  discountType: DISCOUNT_TYPES.PERCENTAGE,
  discountValue: 20,
  items: []
})

const availableBatches = ref([])
const selectedBatches = ref([])
const validationResult = ref(null)
const activeTab = ref('basic')
const dateRange = ref([])

const formRules = {
  name: [{ required: true, message: '请输入促销活动名称', trigger: 'blur' }],
  validFrom: [{ required: true, message: '请选择开始日期', trigger: 'change' }],
  validTo: [{ required: true, message: '请选择结束日期', trigger: 'change' }],
  discountValue: [{ required: true, type: 'number', message: '请输入折扣值', trigger: 'blur' }]
}

function loadPromotions() {
  loading.value = true
  setTimeout(() => {
    promotions.value = getPromotionList(filters.value)
    loading.value = false
  }, 300)
}

function handleSearch() {
  loadPromotions()
}

function handleReset() {
  filters.value = {
    keyword: '',
    status: ''
  }
  loadPromotions()
}

function handleDateRangeChange(val) {
  if (val && val.length === 2) {
    formData.value.validFrom = val[0]
    formData.value.validTo = val[1]
    validateCurrentPromotion()
  } else {
    formData.value.validFrom = ''
    formData.value.validTo = ''
  }
}

function openCreateDialog() {
  formData.value = {
    name: '',
    description: '',
    validFrom: '',
    validTo: '',
    discountType: DISCOUNT_TYPES.PERCENTAGE,
    discountValue: 20,
    items: []
  }
  selectedBatches.value = []
  validationResult.value = null
  dateRange.value = []
  activeTab.value = 'basic'
  
  availableBatches.value = getBatchList({ isNearExpiryOnly: true, isLocked: false }).filter(b => 
    !b.isLocked && isNearExpiry(calculateExpiryDays(b.expiryDate))
  )
  
  showCreateDialog.value = true
}

function addBatchToPromotion(batch) {
  if (selectedBatches.value.some(b => b.batchId === batch.id)) {
    ElMessage.warning('该药品批次已在促销组合中')
    return
  }
  
  const expiryDays = calculateExpiryDays(batch.expiryDate)
  
  selectedBatches.value.push({
    batchId: batch.id,
    batchNumber: batch.batchNumber,
    medicineName: batch.medicineName,
    isPrescription: batch.isPrescription,
    expiryDate: batch.expiryDate,
    expiryDays,
    expiryLayer: getExpiryLayer(expiryDays),
    quantity: batch.quantity,
    price: batch.price,
    minQuantity: 1
  })
  
  formData.value.items = selectedBatches.value.map(b => ({
    batchId: b.batchId,
    batchNumber: b.batchNumber,
    medicineName: b.medicineName,
    minQuantity: b.minQuantity
  }))
  
  validateCurrentPromotion()
}

function removeBatchFromPromotion(index) {
  selectedBatches.value.splice(index, 1)
  formData.value.items = selectedBatches.value.map(b => ({
    batchId: b.batchId,
    batchNumber: b.batchNumber,
    medicineName: b.medicineName,
    minQuantity: b.minQuantity
  }))
  validateCurrentPromotion()
}

function updateMinQuantity(index, value) {
  selectedBatches.value[index].minQuantity = value
  formData.value.items = selectedBatches.value.map(b => ({
    batchId: b.batchId,
    batchNumber: b.batchNumber,
    medicineName: b.medicineName,
    minQuantity: b.minQuantity
  }))
  validateCurrentPromotion()
}

function validateCurrentPromotion() {
  const allBatches = getBatchList()
  const result = validatePromotion(formData.value, allBatches)
  validationResult.value = result
}

function handleSubmit() {
  if (formData.value.items.length === 0) {
    ElMessage.warning('请至少选择一个药品批次')
    return
  }
  
  const result = createPromotion(formData.value)
  
  if (result.success) {
    ElMessage.success('促销活动创建成功')
    showCreateDialog.value = false
    loadPromotions()
    emit('refresh')
    
    if (result.warnings && result.warnings.length > 0) {
      ElMessage.warning(result.warnings.join('；'))
    }
  } else {
    ElMessage.error(result.errors.join('；'))
    validateCurrentPromotion()
  }
}

function handleViewDetail(promotion) {
  emit('view-detail', promotion.id)
}

function handleStatusTransition(promotion, targetStatus) {
  const actionLabels = {
    [PROMOTION_STATUS.REVIEW]: '提交审核',
    [PROMOTION_STATUS.DRAFT]: '退回草稿',
    [PROMOTION_STATUS.ACTIVE]: '生效',
    [PROMOTION_STATUS.ENDED]: '结束'
  }
  
  ElMessageBox.confirm(
    `确定要${actionLabels[targetStatus]}促销活动 "${promotion.name}" 吗？`,
    '确认操作',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const result = transitionPromotionStatus(promotion.id, targetStatus)
    
    if (result.success) {
      ElMessage.success(`操作成功`)
      loadPromotions()
      emit('refresh')
      
      if (result.warnings && result.warnings.length > 0) {
        ElMessage.warning(result.warnings.join('；'))
      }
    } else {
      ElMessage.error(result.errors.join('；'))
    }
  }).catch(() => {})
}

function getStatusTagType(status) {
  const types = {
    [PROMOTION_STATUS.DRAFT]: 'info',
    [PROMOTION_STATUS.REVIEW]: 'warning',
    [PROMOTION_STATUS.ACTIVE]: 'success',
    [PROMOTION_STATUS.ENDED]: 'info'
  }
  return types[status] || 'info'
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN')
}

function getExpiryLayerInfo(layer) {
  return EXPIRY_LAYERS[layer] || { name: '未知', color: '#909399' }
}

onMounted(() => {
  loadPromotions()
})
</script>

<template>
  <div class="promotion-management">
    <div class="page-header">
      <h2>促销活动管理</h2>
      <div class="header-actions">
        <el-button type="primary" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>
          创建促销
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
            placeholder="搜索促销活动名称"
            clearable
            style="width: 250px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部" clearable style="width: 150px">
            <el-option
              v-for="(label, value) in PROMOTION_STATUS_LABEL"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
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
        :data="promotions"
        v-loading="loading"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="name" label="促销名称" width="200" />
        
        <el-table-column label="组合药品" min-width="200">
          <template #default="{ row }">
            <div class="medicine-list">
              <el-tag
                v-for="(item, index) in row.items.slice(0, 3)"
                :key="index"
                type="info"
                size="small"
                effect="plain"
                style="margin-right: 4px; margin-bottom: 4px"
              >
                {{ item.medicineName }}
              </el-tag>
              <el-tag
                v-if="row.items.length > 3"
                type="info"
                size="small"
              >
                +{{ row.items.length - 3 }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column label="优惠方式" width="150">
          <template #default="{ row }">
            {{ DISCOUNT_TYPE_LABEL[row.discountType] }}
            <br />
            <span class="discount-value">
              {{ row.discountType === 'percentage' ? `${row.discountValue}%` : 
                 row.discountType === 'fixed_amount' ? `¥${row.discountValue}` : '组合价' }}
            </span>
          </template>
        </el-table-column>
        
        <el-table-column label="有效期" width="200">
          <template #default="{ row }">
            <div>{{ formatDate(row.validFrom) }}</div>
            <div class="arrow">↓</div>
            <div>{{ formatDate(row.validTo) }}</div>
          </template>
        </el-table-column>
        
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ PROMOTION_STATUS_LABEL[row.status] }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleViewDetail(row)">
              详情
            </el-button>
            
            <el-button
              v-if="row.status === PROMOTION_STATUS.DRAFT"
              type="warning"
              link
              size="small"
              @click="handleStatusTransition(row, PROMOTION_STATUS.REVIEW)"
            >
              提交审核
            </el-button>
            
            <el-button
              v-if="row.status === PROMOTION_STATUS.REVIEW"
              type="success"
              link
              size="small"
              @click="handleStatusTransition(row, PROMOTION_STATUS.ACTIVE)"
            >
              审核通过
            </el-button>
            
            <el-button
              v-if="row.status === PROMOTION_STATUS.REVIEW"
              type="info"
              link
              size="small"
              @click="handleStatusTransition(row, PROMOTION_STATUS.DRAFT)"
            >
              退回
            </el-button>
            
            <el-button
              v-if="row.status === PROMOTION_STATUS.ACTIVE"
              type="danger"
              link
              size="small"
              @click="handleStatusTransition(row, PROMOTION_STATUS.ENDED)"
            >
              结束
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="showCreateDialog"
      title="创建促销活动"
      width="900px"
      :close-on-click-modal="false"
    >
      <el-tabs v-model="activeTab">
        <el-tab-pane label="基本信息" name="basic">
          <el-form
            ref="formRef"
            :model="formData"
            :rules="formRules"
            label-width="100px"
          >
            <el-form-item label="活动名称" prop="name">
              <el-input v-model="formData.name" placeholder="如：夏季感冒促销组合" />
            </el-form-item>
            
            <el-form-item label="活动描述">
              <el-input
                v-model="formData.description"
                type="textarea"
                :rows="2"
                placeholder="请输入活动描述（可选）"
              />
            </el-form-item>
            
            <el-form-item label="有效期" required>
              <el-date-picker
                v-model="dateRange"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
                @change="handleDateRangeChange"
              />
            </el-form-item>
            
            <el-form-item label="优惠方式">
              <el-select
                v-model="formData.discountType"
                style="width: 100%"
                @change="validateCurrentPromotion"
              >
                <el-option
                  v-for="(label, value) in DISCOUNT_TYPE_LABEL"
                  :key="value"
                  :label="label"
                  :value="value"
                />
              </el-select>
            </el-form-item>
            
            <el-form-item label="折扣值" prop="discountValue">
              <el-input-number
                v-model="formData.discountValue"
                :min="0"
                :max="formData.discountType === 'percentage' ? 100 : 9999"
                :precision="formData.discountType === 'percentage' ? 0 : 2"
                style="width: 100%"
                @change="validateCurrentPromotion"
              />
              <span class="unit-hint">
                {{ formData.discountType === 'percentage' ? '%' : formData.discountType === 'fixed_amount' ? '元' : '' }}
              </span>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        
        <el-tab-pane label="选择药品批次" name="batches">
          <div class="batch-selection">
            <div class="available-section">
              <h4>可选近效期药品批次（非锁定）</h4>
              <el-table :data="availableBatches" size="small" height="300">
                <el-table-column prop="medicineName" label="药品名称" width="120" />
                <el-table-column prop="batchNumber" label="批号" width="100" />
                <el-table-column label="效期" width="150">
                  <template #default="{ row }">
                    <span>{{ formatDate(row.expiryDate) }}</span>
                    <el-tag
                      :type="row.expiryLayer === 'URGENCY' ? 'danger' : 
                             row.expiryLayer === 'ATTENTION' ? 'warning' : 'primary'"
                      size="small"
                      style="margin-left: 4px"
                    >
                      {{ getExpiryLayerInfo(row.expiryLayer).name }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="quantity" label="库存" width="60" align="right" />
                <el-table-column prop="price" label="单价" width="80" align="right">
                  <template #default="{ row }">¥{{ row.price.toFixed(2) }}</template>
                </el-table-column>
                <el-table-column label="处方" width="60">
                  <template #default="{ row }">
                    <el-tag v-if="row.isPrescription" type="danger" size="small">Rx</el-tag>
                    <el-tag v-else type="success" size="small">OTC</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="80">
                  <template #default="{ row }">
                    <el-button
                      type="primary"
                      link
                      size="small"
                      :disabled="selectedBatches.some(b => b.batchId === row.id)"
                      @click="addBatchToPromotion(row)"
                    >
                      添加
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
            
            <div class="selected-section">
              <h4>已选择药品批次（{{ selectedBatches.length }}）</h4>
              <el-table :data="selectedBatches" size="small" height="300">
                <el-table-column prop="medicineName" label="药品名称" width="120" />
                <el-table-column prop="batchNumber" label="批号" width="100" />
                <el-table-column label="效期分层" width="100">
                  <template #default="{ row }">
                    <el-tag
                      :type="row.expiryLayer === 'URGENCY' ? 'danger' : 
                             row.expiryLayer === 'ATTENTION' ? 'warning' : 'primary'"
                      size="small"
                    >
                      {{ getExpiryLayerInfo(row.expiryLayer).name }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="最小购买量" width="130">
                  <template #default="{ row, $index }">
                    <el-input-number
                      v-model="row.minQuantity"
                      :min="1"
                      :max="row.quantity"
                      size="small"
                      @change="updateMinQuantity($index, row.minQuantity)"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="处方" width="60">
                  <template #default="{ row }">
                    <el-tag v-if="row.isPrescription" type="danger" size="small">Rx</el-tag>
                    <el-tag v-else type="success" size="small">OTC</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="80">
                  <template #default="{ $index }">
                    <el-button type="danger" link size="small" @click="removeBatchFromPromotion($index)">
                      移除
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </el-tab-pane>
        
        <el-tab-pane label="规则验证" name="validation">
          <div class="validation-section">
            <div v-if="!validationResult" class="validation-empty">
              <el-empty description="请先填写基本信息并选择药品批次" />
            </div>
            
            <div v-else class="validation-result">
              <el-alert
                :type="validationResult.valid ? 'success' : 'error'"
                :closable="false"
                show-icon
              >
                <template #title>
                  {{ validationResult.valid ? '验证通过' : '验证失败' }}
                </template>
              </el-alert>
              
              <div v-if="validationResult.errors?.length > 0" class="validation-errors">
                <h4>错误信息：</h4>
                <ul>
                  <li v-for="(error, index) in validationResult.errors" :key="index">
                    {{ error }}
                  </li>
                </ul>
              </div>
              
              <div v-if="validationResult.warnings?.length > 0" class="validation-warnings">
                <h4>警告信息：</h4>
                <ul>
                  <li v-for="(warning, index) in validationResult.warnings" :key="index">
                    {{ warning }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
      
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">
          创建促销
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.promotion-management {
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

.medicine-list {
  display: flex;
  flex-wrap: wrap;
}

.discount-value {
  font-size: 14px;
  font-weight: bold;
  color: #f56c6c;
}

.arrow {
  color: #909399;
  font-size: 12px;
}

.batch-selection {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.batch-selection h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #606266;
}

.unit-hint {
  margin-left: 8px;
  color: #909399;
}

.validation-section {
  min-height: 300px;
}

.validation-empty {
  padding: 40px 0;
}

.validation-result {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.validation-errors,
.validation-warnings {
  padding: 16px;
  background: #f5f7fa;
  border-radius: 4px;
}

.validation-errors h4,
.validation-warnings h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #303133;
}

.validation-errors ul,
.validation-warnings ul {
  margin: 0;
  padding-left: 20px;
}

.validation-errors li {
  color: #f56c6c;
  font-size: 13px;
  margin-bottom: 4px;
}

.validation-warnings li {
  color: #e6a23c;
  font-size: 13px;
  margin-bottom: 4px;
}
</style>
