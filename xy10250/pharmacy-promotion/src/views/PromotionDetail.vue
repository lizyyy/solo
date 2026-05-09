<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { PROMOTION_STATUS, PROMOTION_STATUS_LABEL, DISCOUNT_TYPE_LABEL, EXPIRY_LAYERS } from '../data/constants'
import { getPromotionById, transitionPromotionStatus } from '../utils/dataService'
import { calculateFinalPrice, calculateDiscount } from '../utils/rules'

const props = defineProps({
  promotionId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['back', 'refresh'])

const promotion = ref(null)
const loading = ref(false)

const availableActions = computed(() => {
  if (!promotion.value) return []
  
  const actions = []
  const status = promotion.value.status
  
  if (status === PROMOTION_STATUS.DRAFT) {
    actions.push({
      target: PROMOTION_STATUS.REVIEW,
      label: '提交审核',
      type: 'warning'
    })
  }
  
  if (status === PROMOTION_STATUS.REVIEW) {
    actions.push({
      target: PROMOTION_STATUS.ACTIVE,
      label: '审核通过',
      type: 'success'
    })
    actions.push({
      target: PROMOTION_STATUS.DRAFT,
      label: '退回草稿',
      type: 'info'
    })
  }
  
  if (status === PROMOTION_STATUS.ACTIVE) {
    actions.push({
      target: PROMOTION_STATUS.ENDED,
      label: '结束活动',
      type: 'danger'
    })
  }
  
  return actions
})

const statusTimeline = computed(() => {
  const allStatuses = [
    { status: PROMOTION_STATUS.DRAFT, label: '草稿', icon: 'EditPen' },
    { status: PROMOTION_STATUS.REVIEW, label: '审核中', icon: 'Clock' },
    { status: PROMOTION_STATUS.ACTIVE, label: '生效中', icon: 'CircleCheck' },
    { status: PROMOTION_STATUS.ENDED, label: '已结束', icon: 'CircleClose' }
  ]
  
  if (!promotion.value) return allStatuses.map(s => ({ ...s, current: false, passed: false }))
  
  const currentIndex = allStatuses.findIndex(s => s.status === promotion.value.status)
  
  return allStatuses.map((s, index) => ({
    ...s,
    current: index === currentIndex,
    passed: index < currentIndex
  }))
})

function loadPromotion() {
  loading.value = true
  setTimeout(() => {
    promotion.value = getPromotionById(props.promotionId)
    loading.value = false
  }, 300)
}

function handleStatusTransition(targetStatus) {
  const action = availableActions.value.find(a => a.target === targetStatus)
  if (!action) return
  
  ElMessageBox.confirm(
    `确定要${action.label}促销活动 "${promotion.value.name}" 吗？`,
    '确认操作',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const result = transitionPromotionStatus(props.promotionId, targetStatus)
    
    if (result.success) {
      ElMessage.success('操作成功')
      loadPromotion()
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

function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

function getExpiryLayerInfo(layer) {
  return EXPIRY_LAYERS[layer] || { name: '未知', color: '#909399' }
}

function exportToCSV() {
  if (!promotion.value) return
  
  const headers = ['药品名称', '批号', '效期', '效期分层', '剩余天数', '处方类型', '单价', '优惠价', '折扣', '最小购买量']
  
  const rows = promotion.value.items.map(item => {
    const batch = item.batch
    const discount = calculateDiscount(batch, promotion.value)
    const finalPrice = calculateFinalPrice(batch, promotion.value)
    
    return [
      item.medicineName,
      item.batchNumber,
      batch ? formatDate(batch.expiryDate) : '-',
      EXPIRY_LAYERS[item.expiryLayer]?.name || '未知',
      item.expiryDays,
      batch?.isPrescription ? '处方药' : '非处方药',
      batch ? batch.price.toFixed(2) : '-',
      finalPrice.toFixed(2),
      discount.toFixed(2),
      item.minQuantity
    ]
  })
  
  const csvContent = [
    `促销活动：${promotion.value.name}`,
    `状态：${PROMOTION_STATUS_LABEL[promotion.value.status]}`,
    `有效期：${formatDate(promotion.value.validFrom)} 至 ${formatDate(promotion.value.validTo)}`,
    `优惠方式：${DISCOUNT_TYPE_LABEL[promotion.value.discountType]} - ${
      promotion.value.discountType === 'percentage' ? `${promotion.value.discountValue}%` : 
      promotion.value.discountType === 'fixed_amount' ? `¥${promotion.value.discountValue}` : '组合价'
    }`,
    '',
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')
  
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `促销活动_${promotion.value.name}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  ElMessage.success('导出成功')
}

watch(() => props.promotionId, () => {
  loadPromotion()
})

onMounted(() => {
  loadPromotion()
})
</script>

<template>
  <div class="promotion-detail">
    <div class="page-header">
      <div class="header-left">
        <el-button link @click="emit('back')">
          <el-icon><ArrowLeft /></el-icon>
          返回列表
        </el-button>
        <h2 v-if="promotion">{{ promotion.name }}</h2>
      </div>
      <div class="header-actions">
        <el-button @click="exportToCSV">
          <el-icon><Download /></el-icon>
          导出
        </el-button>
        <el-button
          v-for="action in availableActions"
          :key="action.target"
          :type="action.type"
          @click="handleStatusTransition(action.target)"
        >
          {{ action.label }}
        </el-button>
      </div>
    </div>

    <el-card v-loading="loading" class="basic-info-card">
      <template #header>
        <div class="card-header">
          <span>基本信息</span>
          <el-tag v-if="promotion" :type="getStatusTagType(promotion.status)" size="large">
            {{ PROMOTION_STATUS_LABEL[promotion.status] }}
          </el-tag>
        </div>
      </template>
      
      <div class="info-grid" v-if="promotion">
        <div class="info-item">
          <div class="info-label">活动描述</div>
          <div class="info-value">{{ promotion.description || '无' }}</div>
        </div>
        
        <div class="info-item">
          <div class="info-label">优惠方式</div>
          <div class="info-value">
            {{ DISCOUNT_TYPE_LABEL[promotion.discountType] }}
            <span class="discount-value">
              {{ promotion.discountType === 'percentage' ? `${promotion.discountValue}%` : 
                 promotion.discountType === 'fixed_amount' ? `¥${promotion.discountValue}` : '组合价' }}
            </span>
          </div>
        </div>
        
        <div class="info-item">
          <div class="info-label">活动有效期</div>
          <div class="info-value">
            {{ formatDate(promotion.validFrom) }} 至 {{ formatDate(promotion.validTo) }}
          </div>
        </div>
        
        <div class="info-item">
          <div class="info-label">创建时间</div>
          <div class="info-value">{{ formatDateTime(promotion.createdAt) }}</div>
        </div>
        
        <div class="info-item">
          <div class="info-label">更新时间</div>
          <div class="info-value">{{ formatDateTime(promotion.updatedAt) }}</div>
        </div>
        
        <div class="info-item">
          <div class="info-label">组合药品数量</div>
          <div class="info-value">{{ promotion.items.length }} 个批次</div>
        </div>
      </div>
    </el-card>

    <el-card v-if="promotion" class="timeline-card">
      <template #header>
        <span>状态流转</span>
      </template>
      
      <el-steps :active="statusTimeline.findIndex(s => s.current)" finish-status="success" simple>
        <el-step
          v-for="step in statusTimeline"
          :key="step.status"
          :title="step.label"
        >
          <template #icon>
            <el-icon v-if="step.current" size="20" color="#409eff">
              <component :is="step.icon" />
            </el-icon>
            <el-icon v-else-if="step.passed" size="20" color="#67c23a">
              <Check />
            </el-icon>
            <el-icon v-else size="20" color="#c0c4cc">
              <component :is="step.icon" />
            </el-icon>
          </template>
        </el-step>
      </el-steps>
    </el-card>

    <el-card v-if="promotion" class="items-card">
      <template #header>
        <span>促销组合药品（{{ promotion.items.length }} 个批次）</span>
      </template>
      
      <el-table :data="promotion.items" stripe>
        <el-table-column prop="medicineName" label="药品名称" width="150">
          <template #default="{ row }">
            <div class="medicine-name">
              <span>{{ row.medicineName }}</span>
              <el-tag
                v-if="row.batch?.isPrescription"
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
        
        <el-table-column prop="batchNumber" label="批号" width="120" />
        
        <el-table-column label="效期信息" width="200">
          <template #default="{ row }">
            <div class="expiry-info">
              <div>{{ formatDate(row.batch?.expiryDate) }}</div>
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
        
        <el-table-column label="库存信息" width="150">
          <template #default="{ row }">
            <div>可用库存：{{ row.batch?.quantity }}</div>
            <div>最小购买：{{ row.minQuantity }}</div>
          </template>
        </el-table-column>
        
        <el-table-column label="价格信息" width="200">
          <template #default="{ row }">
            <div class="price-info">
              <span class="original-price">原价：¥{{ row.batch?.price.toFixed(2) }}</span>
              <span class="discount">折扣：¥{{ calculateDiscount(row.batch, promotion).toFixed(2) }}</span>
              <span class="final-price">优惠价：¥{{ calculateFinalPrice(row.batch, promotion).toFixed(2) }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column label="生产厂家" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.batch?.manufacturer || '-' }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.promotion-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h2 {
  margin: 0;
  font-size: 18px;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.info-item {
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
}

.info-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.info-value {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

.discount-value {
  margin-left: 8px;
  color: #f56c6c;
  font-weight: bold;
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

.price-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.original-price {
  color: #909399;
  text-decoration: line-through;
}

.discount {
  color: #e6a23c;
}

.final-price {
  color: #f56c6c;
  font-weight: bold;
  font-size: 14px;
}
</style>
