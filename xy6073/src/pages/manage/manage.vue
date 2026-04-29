<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { foodManager, FOOD_STATUS, FOOD_CATEGORIES, CATEGORY_NAMES } from '@/utils/foodManager'
import { formatExpireText } from '@/utils/dateUtils'

const router = useRouter()

const foods = ref([])
const selectedIds = ref([])
const currentFilter = ref('all')
const showModal = ref(false)
const modalTitle = ref('')
const modalMessage = ref('')
const modalConfirmText = ref('')
let modalAction = null
const isLoading = ref(false)

const expiredFoods = computed(() => {
  return foods.value.filter(f => f.status === FOOD_STATUS.EXPIRED)
})

const expiringFoods = computed(() => {
  return foods.value.filter(f => f.status === FOOD_STATUS.EXPIRING)
})

const filteredFoods = computed(() => {
  switch (currentFilter.value) {
    case 'expired':
      return expiredFoods.value
    case 'expiring':
      return expiringFoods.value
    default:
      return foods.value
  }
})

const stats = computed(() => ({
  total: foods.value.length,
  expired: expiredFoods.value.length,
  selected: selectedIds.value.length
}))

const isAllSelected = computed(() => {
  if (filteredFoods.value.length === 0) return false
  return filteredFoods.value.every(food => selectedIds.value.includes(food.id))
})

const emptyText = computed(() => {
  switch (currentFilter.value) {
    case 'expired':
      return '没有过期的食材'
    case 'expiring':
      return '没有即将过期的食材'
    default:
      return '冰箱空空如也'
  }
})

const loadFoods = () => {
  isLoading.value = true
  try {
    foods.value = foodManager.getFoods()
    // 清除不在当前列表中的选中项
    const foodIds = foods.value.map(f => f.id)
    selectedIds.value = selectedIds.value.filter(id => foodIds.includes(id))
  } catch (error) {
    console.error('加载食材失败:', error)
    alert('加载失败，请重试')
  } finally {
    isLoading.value = false
  }
}

const setFilter = (filter) => {
  currentFilter.value = filter
}

// 切换选中状态
const toggleSelect = (id) => {
  const index = selectedIds.value.indexOf(id)
  if (index > -1) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(id)
  }
}

// 全选/取消全选
const toggleSelectAll = () => {
  if (isAllSelected.value) {
    // 取消全选：只取消当前筛选列表中的
    const filteredIds = filteredFoods.value.map(f => f.id)
    selectedIds.value = selectedIds.value.filter(id => !filteredIds.includes(id))
  } else {
    // 全选：添加当前筛选列表中未选中的
    const filteredIds = filteredFoods.value.map(f => f.id)
    filteredIds.forEach(id => {
      if (!selectedIds.value.includes(id)) {
        selectedIds.value.push(id)
      }
    })
  }
}

// 一键选中所有过期食材
const selectAllExpired = () => {
  const expiredIds = expiredFoods.value.map(f => f.id)
  expiredIds.forEach(id => {
    if (!selectedIds.value.includes(id)) {
      selectedIds.value.push(id)
    }
  })
}

// 清除选择
const clearSelection = () => {
  selectedIds.value = []
}

// 显示确认弹窗
const showConfirmModal = (title, message, confirmText, action) => {
  modalTitle.value = title
  modalMessage.value = message
  modalConfirmText.value = confirmText
  modalAction = action
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  modalAction = null
}

const confirmModalAction = () => {
  if (modalAction) {
    modalAction()
  }
  closeModal()
}

// 标记已用完
const markAsUsed = () => {
  const count = selectedIds.value.length
  showConfirmModal(
    '标记已用完',
    `确定要将选中的 ${count} 种食材标记为已用完吗？\n（将从列表中移除）`,
    '确定标记',
    () => {
      performBatchDelete('已标记为已用完')
    }
  )
}

// 批量删除
const batchDelete = () => {
  const count = selectedIds.value.length
  showConfirmModal(
    '确认删除',
    `确定要删除选中的 ${count} 种食材吗？\n此操作不可恢复。`,
    '确定删除',
    () => {
      performBatchDelete('删除成功')
    }
  )
}

// 执行批量删除
const performBatchDelete = (successMessage) => {
  isLoading.value = true
  try {
    const deletedCount = foodManager.batchDeleteFoods(selectedIds.value)
    isLoading.value = false
    
    // 重新加载数据
    loadFoods()
    
    // 清除选中状态
    selectedIds.value = []
    
    alert(`${successMessage}（${deletedCount}项）`)
  } catch (error) {
    isLoading.value = false
    console.error('操作失败:', error)
    alert('操作失败，请重试')
  }
}

// 单个删除
const deleteSingleFood = (food) => {
  showConfirmModal(
    '确认删除',
    `确定要删除「${food.name}」吗？\n此操作不可恢复。`,
    '确定删除',
    () => {
      isLoading.value = true
      try {
        foodManager.deleteFood(food.id)
        isLoading.value = false
        loadFoods()
        alert('删除成功')
      } catch (error) {
        isLoading.value = false
        console.error('删除失败:', error)
        alert('删除失败，请重试')
      }
    }
  )
}

// 辅助方法
const getStatusText = (status) => {
  const statusMap = {
    [FOOD_STATUS.NORMAL]: '正常',
    [FOOD_STATUS.EXPIRING]: '临期',
    [FOOD_STATUS.EXPIRED]: '过期'
  }
  return statusMap[status] || '未知'
}

const getCategoryName = (category) => {
  return CATEGORY_NAMES[category] || '其他'
}

const getCategoryIcon = (category) => {
  const iconMap = {
    [FOOD_CATEGORIES.VEGETABLE]: '🥬',
    [FOOD_CATEGORIES.FRUIT]: '🍎',
    [FOOD_CATEGORIES.MEAT]: '🥩',
    [FOOD_CATEGORIES.SEAFOOD]: '🦐',
    [FOOD_CATEGORIES.DAIRY]: '🥛',
    [FOOD_CATEGORIES.GRAIN]: '🍚',
    [FOOD_CATEGORIES.CONDIMENT]: '🧂',
    [FOOD_CATEGORIES.OTHER]: '🍽️'
  }
  return iconMap[category] || '🍽️'
}

const viewFoodDetail = (food) => {
  const expireText = formatExpireText(food.daysLeft)
  const categoryName = getCategoryName(food.category)
  
  let content = `名称：${food.name}\n`
  content += `数量：${food.quantity}${food.unit}\n`
  content += `分类：${categoryName}\n`
  content += `保质期：${food.expireDate || '未设置'}\n`
  content += `状态：${expireText}`
  
  if (food.notes) {
    content += `\n备注：${food.notes}`
  }
  
  alert('食材详情\n\n' + content)
}

const goToAddFood = () => {
  router.push('/add-food')
}

onMounted(() => {
  loadFoods()
})
</script>

<template>
  <div class="page-container">
    <!-- 顶部标题区域 -->
    <div class="header-section">
      <div class="header-title">
        <span class="title-icon">🗂️</span>
        <span class="title-text">食材管理</span>
      </div>
      <div class="header-desc">
        <span>管理您的冰箱食材，一键清理已用完的食材</span>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-section">
      <div class="stats-card">
        <div class="stat-item">
          <span class="stat-count">{{ stats.total }}</span>
          <span class="stat-label">全部食材</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-count">{{ stats.expired }}</span>
          <span class="stat-label">已过期</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-count">{{ stats.selected }}</span>
          <span class="stat-label">已选择</span>
        </div>
      </div>
    </div>

    <!-- 筛选和操作栏 -->
    <div class="action-bar">
      <div class="filter-tabs">
        <div 
          class="filter-tab" 
          :class="{ active: currentFilter === 'all' }"
          @click="setFilter('all')"
        >
          全部
          <span class="tab-count">({{ foods.length }})</span>
        </div>
        <div 
          class="filter-tab" 
          :class="{ active: currentFilter === 'expired' }"
          @click="setFilter('expired')"
        >
          已过期
          <span class="tab-count">({{ expiredFoods.length }})</span>
        </div>
        <div 
          class="filter-tab" 
          :class="{ active: currentFilter === 'expiring' }"
          @click="setFilter('expiring')"
        >
          即将过期
          <span class="tab-count">({{ expiringFoods.length }})</span>
        </div>
      </div>
      
      <div class="batch-actions" v-if="filteredFoods.length > 0">
        <div 
          class="action-btn select-all" 
          :class="{ active: isAllSelected }"
          @click="toggleSelectAll"
        >
          <span class="btn-icon">{{ isAllSelected ? '✓' : '□' }}</span>
          <span class="btn-text">{{ isAllSelected ? '取消全选' : '全选' }}</span>
        </div>
      </div>
    </div>

    <!-- 食材列表 -->
    <div class="food-list">
      <!-- 过期提醒 -->
      <div class="expired-warning" v-if="expiredFoods.length > 0 && currentFilter === 'all'">
        <div class="warning-icon">⚠️</div>
        <div class="warning-content">
          <span class="warning-title">过期提醒</span>
          <span class="warning-text">您有 {{ expiredFoods.length }} 种食材已过期，建议及时清理</span>
        </div>
        <div class="warning-action" @click="selectAllExpired">
          一键选中
        </div>
      </div>

      <!-- 空状态 -->
      <div class="empty-state" v-if="filteredFoods.length === 0 && !isLoading">
        <span class="empty-icon">🗑️</span>
        <span class="empty-text">{{ emptyText }}</span>
        <div class="empty-action" @click="goToAddFood" v-if="currentFilter === 'all'">
          + 添加食材
        </div>
      </div>

      <!-- 加载状态 -->
      <div class="loading" v-if="isLoading">
        <span>加载中...</span>
      </div>

      <!-- 食材列表 -->
      <div 
        class="food-item" 
        v-for="food in filteredFoods" 
        :key="food.id"
      >
        <!-- 复选框 -->
        <div 
          class="checkbox" 
          :class="{ checked: selectedIds.includes(food.id), expired: food.status === 'expired' }"
          @click="toggleSelect(food.id)"
        >
          <span class="check-icon" v-if="selectedIds.includes(food.id)">✓</span>
        </div>

        <!-- 食材图片 -->
        <div class="food-image">
          <img v-if="food.image" :src="food.image" class="food-img" />
          <div v-else class="food-placeholder">
            <span class="placeholder-icon">{{ getCategoryIcon(food.category) }}</span>
          </div>
        </div>

        <!-- 食材信息 -->
        <div class="food-info" @click="viewFoodDetail(food)">
          <div class="food-header">
            <span class="food-name" :class="{ 'text-expired': food.status === 'expired' }">
              {{ food.name }}
            </span>
            <div class="food-badge" :class="food.status">
              {{ getStatusText(food.status) }}
            </div>
          </div>
          
          <div class="food-meta">
            <span class="meta-item">📦 {{ food.quantity }}{{ food.unit }}</span>
            <span class="meta-item">📁 {{ getCategoryName(food.category) }}</span>
          </div>
          
          <div class="food-expire">
            <span class="expire-label">保质期：</span>
            <span class="expire-date" :class="food.status">
              {{ formatExpireText(food.daysLeft) }}
            </span>
          </div>
        </div>

        <!-- 删除按钮 -->
        <div class="delete-btn" @click="deleteSingleFood(food)">
          <span class="delete-icon">🗑️</span>
        </div>
      </div>

      <!-- 底部留白 -->
      <div style="height: 100px;"></div>
    </div>

    <!-- 底部操作栏 -->
    <div class="bottom-actions" v-if="selectedIds.length > 0">
      <div class="selected-info">
        <span class="selected-text">已选择 {{ selectedIds.length }} 项</span>
        <div class="clear-selection" @click="clearSelection">
          取消选择
        </div>
      </div>
      <div class="action-buttons">
        <div class="bottom-btn mark-used-btn" @click="markAsUsed">
          <span class="btn-icon">✓</span>
          <span class="btn-text">标记已用完</span>
        </div>
        <div class="bottom-btn delete-btn" @click="batchDelete">
          <span class="btn-icon">🗑️</span>
          <span class="btn-text">批量删除</span>
        </div>
      </div>
    </div>

    <!-- 确认弹窗 -->
    <div class="modal-mask" v-if="showModal" @click="closeModal">
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <span class="modal-title">{{ modalTitle }}</span>
        </div>
        <div class="modal-content">
          <span class="modal-text">{{ modalMessage }}</span>
        </div>
        <div class="modal-footer">
          <div class="modal-btn cancel" @click="closeModal">
            取消
          </div>
          <div class="modal-btn confirm" @click="confirmModalAction">
            {{ modalConfirmText }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-container {
  min-height: 100%;
  background-color: #f5f5f5;
  display: flex;
  flex-direction: column;
}

/* 头部区域 */
.header-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px 16px;
  color: #fff;
}

.header-title {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.title-icon {
  font-size: 24px;
  margin-right: 8px;
}

.title-text {
  font-size: 20px;
  font-weight: 600;
}

.header-desc {
  font-size: 14px;
  opacity: 0.9;
}

/* 统计卡片 */
.stats-section {
  margin: 12px;
}

.stats-card {
  background-color: #fff;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.stat-count {
  font-size: 24px;
  font-weight: 700;
  color: #333;
  margin-bottom: 2px;
}

.stat-label {
  font-size: 12px;
  color: #999;
}

.stat-divider {
  width: 1px;
  height: 36px;
  background-color: #f0f0f0;
}

/* 操作栏 */
.action-bar {
  background-color: #fff;
  padding: 12px 16px;
  margin-bottom: 12px;
}

.filter-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.filter-tab {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background-color: #f5f5f5;
  border-radius: 20px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-tab:active {
  opacity: 0.8;
}

.filter-tab.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.tab-count {
  margin-left: 4px;
  opacity: 0.8;
}

.batch-actions {
  display: flex;
  justify-content: flex-end;
}

.action-btn {
  display: flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:active {
  opacity: 0.8;
}

.select-all {
  background-color: #f5f5f5;
  color: #666;
}

.select-all.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.btn-icon {
  margin-right: 4px;
}

/* 过期提醒 */
.expired-warning {
  display: flex;
  align-items: center;
  background-color: #FFF2F0;
  border: 1px solid #FFCCC5;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.warning-icon {
  font-size: 24px;
  margin-right: 12px;
}

.warning-content {
  flex: 1;
}

.warning-title {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #FF3B30;
  margin-bottom: 2px;
}

.warning-text {
  font-size: 12px;
  color: #666;
}

.warning-action {
  padding: 6px 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 16px;
  font-size: 12px;
  cursor: pointer;
}

.warning-action:active {
  opacity: 0.8;
}

/* 食材列表 */
.food-list {
  flex: 1;
  padding: 0 12px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 14px;
  color: #999;
  margin-bottom: 16px;
  text-align: center;
}

.empty-action {
  padding: 10px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
}

.empty-action:active {
  opacity: 0.8;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 30px;
}

.loading span {
  font-size: 14px;
  color: #999;
}

.food-item {
  display: flex;
  align-items: center;
  background-color: #fff;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

/* 复选框 */
.checkbox {
  width: 28px;
  height: 28px;
  border: 2px solid #ddd;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.2s;
}

.checkbox.checked {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
}

.checkbox.expired {
  border-color: #FF3B30;
}

.checkbox.checked.expired {
  background-color: #FF3B30;
  border-color: #FF3B30;
}

.check-icon {
  color: #fff;
  font-size: 14px;
  font-weight: bold;
}

/* 食材图片 */
.food-image {
  width: 56px;
  height: 56px;
  margin-right: 12px;
  flex-shrink: 0;
}

.food-img {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  object-fit: cover;
}

.food-placeholder {
  width: 100%;
  height: 100%;
  background-color: #f5f5f5;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-icon {
  font-size: 28px;
}

/* 食材信息 */
.food-info {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.food-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.food-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 55%;
}

.food-name.text-expired {
  color: #FF3B30;
  text-decoration: line-through;
}

.food-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  flex-shrink: 0;
}

.food-badge.normal {
  background-color: #E8F8EF;
  color: #34C759;
}

.food-badge.expiring {
  background-color: #FFF7E6;
  color: #FF9500;
}

.food-badge.expired {
  background-color: #FFF2F0;
  color: #FF3B30;
}

.food-meta {
  display: flex;
  margin-bottom: 4px;
}

.meta-item {
  font-size: 12px;
  color: #999;
  margin-right: 12px;
}

.food-expire {
  display: flex;
  align-items: center;
}

.expire-label {
  font-size: 12px;
  color: #999;
}

.expire-date {
  font-size: 12px;
  font-weight: 500;
}

.expire-date.normal {
  color: #34C759;
}

.expire-date.expiring {
  color: #FF9500;
}

.expire-date.expired {
  color: #FF3B30;
}

/* 删除按钮 */
.delete-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  flex-shrink: 0;
  cursor: pointer;
}

.delete-icon {
  font-size: 20px;
}

/* 底部操作栏 */
.bottom-actions {
  position: fixed;
  bottom: 60px;
  left: 0;
  right: 0;
  background-color: #fff;
  padding: 12px 16px;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
  z-index: 99;
}

.selected-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.selected-text {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.clear-selection {
  font-size: 12px;
  color: #667eea;
  cursor: pointer;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

.bottom-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.bottom-btn:active {
  opacity: 0.8;
}

.mark-used-btn {
  background-color: #34C759;
}

.delete-btn {
  background-color: #FF3B30;
}

/* 弹窗样式 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  width: 80%;
  max-width: 320px;
  background-color: #fff;
  border-radius: 16px;
  overflow: hidden;
}

.modal-header {
  padding: 20px 20px 12px;
  text-align: center;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.modal-content {
  padding: 0 20px 20px;
}

.modal-text {
  font-size: 14px;
  color: #666;
  line-height: 1.8;
  white-space: pre-wrap;
}

.modal-footer {
  display: flex;
  border-top: 1px solid #f0f0f0;
}

.modal-btn {
  flex: 1;
  padding: 14px 0;
  text-align: center;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-btn:active {
  background-color: #f5f5f5;
}

.modal-btn.cancel {
  color: #666;
  border-right: 1px solid #f0f0f0;
}

.modal-btn.confirm {
  color: #FF3B30;
  font-weight: 500;
}
</style>
