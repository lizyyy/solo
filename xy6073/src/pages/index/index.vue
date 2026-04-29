<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { foodManager, FOOD_STATUS, FOOD_CATEGORIES, CATEGORY_NAMES } from '@/utils/foodManager'
import { formatExpireText } from '@/utils/dateUtils'

const router = useRouter()

const searchKeyword = ref('')
const currentFilter = ref('all')
const foods = ref([])
const filteredFoods = ref([])
const isLoading = ref(false)

const stats = computed(() => ({
  normal: foods.value.filter(f => f.status === FOOD_STATUS.NORMAL).length,
  expiring: foods.value.filter(f => f.status === FOOD_STATUS.EXPIRING).length,
  expired: foods.value.filter(f => f.status === FOOD_STATUS.EXPIRED).length
}))

const categories = computed(() => {
  return Object.entries(FOOD_CATEGORIES).map(([key, value]) => ({
    value: value,
    label: CATEGORY_NAMES[value]
  }))
})

const expiredFoods = computed(() => {
  return foods.value.filter(f => f.status === FOOD_STATUS.EXPIRED)
})

const expiringFoods = computed(() => {
  return foods.value.filter(f => f.status === FOOD_STATUS.EXPIRING)
})

const emptyText = computed(() => {
  if (searchKeyword.value) {
    return '没有找到匹配的食材'
  }
  if (currentFilter.value !== 'all') {
    return '该分类暂无食材'
  }
  return '冰箱空空如也，快去添加食材吧！'
})

const foodSections = computed(() => {
  if (searchKeyword.value || currentFilter.value !== 'all') {
    return [{
      title: '',
      icon: '',
      foods: filteredFoods.value
    }]
  }
  
  const sections = []
  
  // 过期食材
  if (expiredFoods.value.length > 0) {
    sections.push({
      title: '已过期',
      icon: '⚠️',
      foods: expiredFoods.value
    })
  }
  
  // 即将过期
  if (expiringFoods.value.length > 0) {
    sections.push({
      title: '即将过期',
      icon: '⏰',
      foods: expiringFoods.value
    })
  }
  
  // 正常食材
  const normalFoods = foods.value.filter(f => f.status === FOOD_STATUS.NORMAL)
  if (normalFoods.length > 0) {
    sections.push({
      title: '正常',
      icon: '✅',
      foods: normalFoods
    })
  }
  
  return sections
})

const loadFoods = () => {
  isLoading.value = true
  try {
    foods.value = foodManager.getFoods()
    applyFilter()
  } catch (error) {
    console.error('加载食材失败:', error)
    alert('加载失败，请重试')
  } finally {
    isLoading.value = false
  }
}

const applyFilter = () => {
  let result = [...foods.value]
  
  // 搜索过滤
  if (searchKeyword.value) {
    result = result.filter(food => 
      food.name.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
      (food.notes && food.notes.toLowerCase().includes(searchKeyword.value.toLowerCase()))
    )
  }
  
  // 分类过滤
  if (currentFilter.value !== 'all') {
    result = result.filter(food => food.category === currentFilter.value)
  }
  
  filteredFoods.value = result
}

const onSearch = () => {
  applyFilter()
}

const clearSearch = () => {
  searchKeyword.value = ''
  applyFilter()
}

const setFilter = (category) => {
  currentFilter.value = category
  applyFilter()
}

const filterByStatus = (status) => {
  currentFilter.value = 'all'
  searchKeyword.value = ''
  filteredFoods.value = foods.value.filter(f => f.status === status)
}

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

const formatExpireDays = (daysLeft) => {
  return formatExpireText(daysLeft)
}

const viewFoodDetail = (food) => {
  const expireText = formatExpireDays(food.daysLeft)
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

const goToManage = () => {
  router.push('/manage')
}

watch(searchKeyword, () => {
  applyFilter()
})

onMounted(() => {
  loadFoods()
})
</script>

<template>
  <div class="page-container">
    <!-- 顶部搜索栏 -->
    <div class="search-bar">
      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input 
          class="search-input" 
          type="text" 
          placeholder="搜索食材..." 
          v-model="searchKeyword"
          @input="onSearch"
        />
        <span v-if="searchKeyword" class="clear-icon" @click="clearSearch">✕</span>
      </div>
    </div>

    <!-- 状态统计卡片 -->
    <div class="stats-card" v-if="!searchKeyword">
      <div class="stats-title">📊 食材状态</div>
      <div class="stats-list">
        <div class="stat-item normal" @click="filterByStatus('normal')">
          <span class="stat-count">{{ stats.normal }}</span>
          <span class="stat-label">正常</span>
        </div>
        <div class="stat-item expiring" @click="filterByStatus('expiring')">
          <span class="stat-count">{{ stats.expiring }}</span>
          <span class="stat-label">即将过期</span>
        </div>
        <div class="stat-item expired" @click="filterByStatus('expired')">
          <span class="stat-count">{{ stats.expired }}</span>
          <span class="stat-label">已过期</span>
        </div>
      </div>
    </div>

    <!-- 分类筛选 -->
    <div class="filter-section" v-if="!searchKeyword">
      <div class="filter-scroll">
        <div class="filter-list">
          <div 
            class="filter-item" 
            :class="{ active: currentFilter === 'all' }"
            @click="setFilter('all')"
          >
            全部
          </div>
          <div 
            class="filter-item" 
            :class="{ active: currentFilter === category.value }"
            v-for="category in categories" 
            :key="category.value"
            @click="setFilter(category.value)"
          >
            {{ category.label }}
          </div>
        </div>
      </div>
    </div>

    <!-- 食材列表 -->
    <div class="food-list">
      <!-- 过期提醒 -->
      <div class="expired-warning" v-if="expiredFoods.length > 0 && !searchKeyword && currentFilter === 'all'">
        <div class="warning-icon">⚠️</div>
        <div class="warning-content">
          <span class="warning-title">过期提醒</span>
          <span class="warning-text">您有 {{ expiredFoods.length }} 种食材已过期，请及时清理！</span>
        </div>
        <div class="warning-action" @click="goToManage">
          去清理
        </div>
      </div>

      <!-- 临期提醒 -->
      <div class="expiring-warning" v-if="expiringFoods.length > 0 && !searchKeyword && currentFilter === 'all'">
        <div class="warning-icon">⏰</div>
        <div class="warning-content">
          <span class="warning-title">临期提醒</span>
          <span class="warning-text">您有 {{ expiringFoods.length }} 种食材即将过期！</span>
        </div>
      </div>

      <!-- 空状态 -->
      <div class="empty-state" v-if="filteredFoods.length === 0 && !isLoading">
        <div class="empty-icon">🍽️</div>
        <span class="empty-text">{{ emptyText }}</span>
        <div class="empty-action" @click="goToAddFood" v-if="!searchKeyword && currentFilter === 'all'">
          + 添加食材
        </div>
      </div>

      <!-- 加载状态 -->
      <div class="loading" v-if="isLoading">
        <span>加载中...</span>
      </div>

      <!-- 食材列表 -->
      <div class="food-section" v-for="(section, sectionIndex) in foodSections" :key="sectionIndex">
        <div class="section-title" v-if="section.title">
          <span class="section-icon">{{ section.icon }}</span>
          <span class="section-name">{{ section.title }}</span>
          <span class="section-count">({{ section.foods.length }})</span>
        </div>
        <div 
          class="food-item" 
          v-for="food in section.foods" 
          :key="food.id"
          @click="viewFoodDetail(food)"
        >
          <div class="food-image">
            <img v-if="food.image" :src="food.image" class="food-img" />
            <div v-else class="food-placeholder">
              <span class="placeholder-icon">{{ getCategoryIcon(food.category) }}</span>
            </div>
          </div>
          
          <div class="food-info">
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
                {{ formatExpireDays(food.daysLeft) }}
              </span>
            </div>
          </div>
          
          <div class="food-arrow">›</div>
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
  padding-bottom: 20px;
}

/* 搜索栏 */
.search-bar {
  padding: 16px;
  background-color: #fff;
  position: sticky;
  top: 0;
  z-index: 100;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  background-color: #f0f0f0;
  border-radius: 20px;
  padding: 0 16px;
  height: 40px;
}

.search-icon {
  font-size: 18px;
  margin-right: 8px;
}

.search-input {
  flex: 1;
  height: 100%;
  font-size: 14px;
  background: transparent;
  border: none;
  outline: none;
}

.search-input::placeholder {
  color: #999;
}

.clear-icon {
  font-size: 14px;
  color: #999;
  padding: 4px;
  cursor: pointer;
}

/* 统计卡片 */
.stats-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  margin: 16px;
  border-radius: 12px;
  padding: 20px;
}

.stats-title {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.stats-list {
  display: flex;
  justify-content: space-between;
}

.stat-item {
  flex: 1;
  text-align: center;
  padding: 12px 8px;
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  margin: 0 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.stat-item:active {
  opacity: 0.8;
}

.stat-item:first-child {
  margin-left: 0;
}

.stat-item:last-child {
  margin-right: 0;
}

.stat-count {
  display: block;
  color: #fff;
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
}

.stat-label {
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
}

/* 分类筛选 */
.filter-section {
  background-color: #fff;
  padding: 12px 0;
  margin-bottom: 16px;
}

.filter-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.filter-list {
  display: inline-flex;
  padding: 0 16px;
}

.filter-item {
  display: inline-block;
  padding: 8px 16px;
  margin-right: 12px;
  background-color: #f5f5f5;
  border-radius: 16px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.filter-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

/* 食材列表 */
.food-list {
  flex: 1;
  padding: 0 16px;
}

/* 过期警告 */
.expired-warning {
  display: flex;
  align-items: center;
  background-color: #FFF2F0;
  border: 1px solid #FFCCC5;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

.expiring-warning {
  display: flex;
  align-items: center;
  background-color: #FFF7E6;
  border: 1px solid #FFE6B3;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
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
  color: #333;
  margin-bottom: 2px;
}

.warning-text {
  font-size: 12px;
  color: #666;
}

.warning-action {
  padding: 6px 12px;
  background-color: #FF3B30;
  color: #fff;
  border-radius: 16px;
  font-size: 12px;
  cursor: pointer;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
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

/* 加载状态 */
.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px;
}

.loading span {
  font-size: 14px;
  color: #999;
}

/* 食材分组 */
.food-section {
  margin-bottom: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  padding: 8px 0;
}

.section-icon {
  font-size: 18px;
  margin-right: 4px;
}

.section-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.section-count {
  font-size: 12px;
  color: #999;
  margin-left: 4px;
}

/* 食材项 */
.food-item {
  display: flex;
  align-items: center;
  background-color: #fff;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: all 0.2s;
}

.food-item:active {
  opacity: 0.8;
}

.food-image {
  width: 60px;
  height: 60px;
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

.food-info {
  flex: 1;
  min-width: 0;
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
  max-width: 60%;
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

.food-arrow {
  font-size: 18px;
  color: #CCC;
  margin-left: 8px;
  flex-shrink: 0;
}
</style>
