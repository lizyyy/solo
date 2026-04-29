<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { foodManager, FOOD_CATEGORIES } from '@/utils/foodManager'
import { recipeManager } from '@/utils/recipeManager'

const router = useRouter()

const availableIngredients = ref([])
const allRecipes = ref([])
const recommendedRecipes = ref([])
const currentMatchFilter = ref('all')
const showDetail = ref(false)
const currentRecipe = ref({})
const isLoading = ref(false)

const filteredRecipes = computed(() => {
  if (currentMatchFilter.value === 'all') {
    return recommendedRecipes.value
  }
  
  return recommendedRecipes.value.filter(recipe => {
    const percentage = recipe.matchInfo.matchPercentage
    if (currentMatchFilter.value === 'high') {
      return percentage >= 80
    }
    if (currentMatchFilter.value === 'medium') {
      return percentage >= 50 && percentage < 80
    }
    return true
  })
})

const loadData = () => {
  isLoading.value = true
  
  try {
    // 加载当前食材
    const foods = foodManager.getFoods()
    availableIngredients.value = foods.filter(f => f.status !== 'expired')
    
    // 为所有菜谱计算匹配度并按匹配度排序
    recommendedRecipes.value = recipeManager.recommendRecipes(availableIngredients.value, 0)
  } catch (error) {
    console.error('加载数据失败:', error)
    alert('加载失败，请重试')
  } finally {
    isLoading.value = false
  }
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

const getMatchLevel = (percentage) => {
  if (percentage >= 80) return 'high'
  if (percentage >= 50) return 'medium'
  return 'low'
}

const isIngredientMatched = (ingredientName, matchInfo) => {
  const availableNames = availableIngredients.value.map(i => i.name.toLowerCase())
  const ingLower = ingredientName.toLowerCase()
  
  return availableNames.some(name => 
    name.includes(ingLower) || ingLower.includes(name)
  )
}

const setMatchFilter = (filter) => {
  currentMatchFilter.value = filter
}

const viewRecipeDetail = (recipe) => {
  currentRecipe.value = recipe
  showDetail.value = true
}

const closeDetail = () => {
  showDetail.value = false
  currentRecipe.value = {}
}

const startCooking = (recipe) => {
  if (confirm(`确定要开始制作「${recipe.name}」吗？`)) {
    alert('祝您好胃口！')
    closeDetail()
  }
}

const goToAddFood = () => {
  router.push('/add-food')
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="page-container">
    <!-- 顶部标题区域 -->
    <div class="header-section">
      <div class="header-title">
        <span class="title-icon">🍳</span>
        <span class="title-text">菜谱推荐</span>
      </div>
      <div class="header-desc">
        <span>根据您冰箱里的食材，为您推荐合适的菜谱</span>
      </div>
    </div>

    <!-- 当前食材展示 -->
    <div class="ingredients-section">
      <div class="section-header">
        <span class="section-title">📦 当前食材</span>
        <span class="ingredient-count">({{ availableIngredients.length }}种)</span>
      </div>
      <div class="ingredients-list" v-if="availableIngredients.length > 0">
        <div 
          class="ingredient-tag" 
          v-for="ingredient in availableIngredients" 
          :key="ingredient.name"
        >
          <span class="tag-icon">{{ getCategoryIcon(ingredient.category) }}</span>
          <span class="tag-text">{{ ingredient.name }}</span>
          <span class="tag-quantity">{{ ingredient.quantity }}{{ ingredient.unit }}</span>
        </div>
      </div>
      <div class="empty-ingredients" v-else>
        <span class="empty-icon">🥗</span>
        <span class="empty-text">冰箱空空如也</span>
        <div class="add-btn" @click="goToAddFood">
          <span class="add-icon">+</span>
          <span>去添加食材</span>
        </div>
      </div>
    </div>

    <!-- 匹配度筛选 -->
    <div class="filter-section">
      <div class="section-header">
        <span class="section-title">📚 全部菜谱</span>
        <div class="match-filter">
          <div 
            class="filter-option" 
            :class="{ active: currentMatchFilter === 'all' }"
            @click="setMatchFilter('all')"
          >
            全部
          </div>
          <div 
            class="filter-option" 
            :class="{ active: currentMatchFilter === 'high' }"
            @click="setMatchFilter('high')"
          >
            高匹配
          </div>
          <div 
            class="filter-option" 
            :class="{ active: currentMatchFilter === 'medium' }"
            @click="setMatchFilter('medium')"
          >
            中匹配
          </div>
        </div>
      </div>
    </div>

    <!-- 菜谱列表 -->
    <div class="recipe-list">
      <!-- 空状态 -->
      <div class="empty-recipe" v-if="filteredRecipes.length === 0 && !isLoading">
        <span class="empty-icon">🤔</span>
        <span class="empty-text">暂无菜谱</span>
      </div>

      <!-- 加载状态 -->
      <div class="loading" v-if="isLoading">
        <span>加载中...</span>
      </div>

      <!-- 菜谱卡片 -->
      <div 
        class="recipe-card" 
        v-for="recipe in filteredRecipes" 
        :key="recipe.id"
        @click="viewRecipeDetail(recipe)"
      >
        <!-- 菜谱头部 -->
        <div class="recipe-header">
          <div class="recipe-title-row">
            <span class="recipe-name">{{ recipe.name }}</span>
            <div class="match-badge" :class="getMatchLevel(recipe.matchInfo.matchPercentage)">
              <span class="match-text">{{ Math.round(recipe.matchInfo.matchPercentage) }}%匹配</span>
            </div>
          </div>
          <div class="recipe-meta">
            <div class="meta-item">
              <span class="meta-icon">⏱️</span>
              <span class="meta-text">{{ recipe.cookTime }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-icon">📊</span>
              <span class="meta-text">{{ recipe.difficulty }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-icon">🍽️</span>
              <span class="meta-text">{{ recipe.category }}</span>
            </div>
          </div>
        </div>

        <!-- 食材匹配情况 -->
        <div class="ingredient-match">
          <div class="match-title">食材匹配：</div>
          <div class="match-ingredients">
            <div 
              class="match-tag matched"
              v-for="ing in recipe.ingredients.filter(i => isIngredientMatched(i.name, recipe.matchInfo))"
              :key="i.name"
            >
              <span class="check-icon">✓</span>
              <span>{{ i.name }}</span>
            </div>
            <div 
              class="match-tag missing"
              v-for="ing in recipe.ingredients.filter(i => !isIngredientMatched(i.name, recipe.matchInfo))"
              :key="i.name"
            >
              <span class="missing-icon">?</span>
              <span>{{ i.name }}</span>
            </div>
          </div>
        </div>

        <!-- 缺少食材提示 -->
        <div class="missing-hint" v-if="recipe.matchInfo.missingIngredients.length > 0">
          <span class="hint-icon">💡</span>
          <span class="hint-text">还需要：{{ recipe.matchInfo.missingIngredients.join('、') }}</span>
        </div>

        <!-- 底部操作 -->
        <div class="recipe-footer">
          <div class="footer-btn view-btn" @click.stop="viewRecipeDetail(recipe)">
            <span class="btn-icon">📖</span>
            <span class="btn-text">查看详情</span>
          </div>
          <div class="footer-btn cook-btn" @click.stop="startCooking(recipe)">
            <span class="btn-icon">👨‍🍳</span>
            <span class="btn-text">开始制作</span>
          </div>
        </div>
      </div>

      <!-- 底部留白 -->
      <div style="height: 20px;"></div>
    </div>

    <!-- 菜谱详情弹窗 -->
    <div class="detail-mask" v-if="showDetail" @click="closeDetail">
      <div class="detail-container" @click.stop>
        <div class="detail-header">
          <span class="detail-title">{{ currentRecipe.name }}</span>
          <div class="detail-close" @click="closeDetail">✕</div>
        </div>
        
        <div class="detail-content">
          <!-- 基本信息 -->
          <div class="detail-section">
            <div class="detail-section-title">📋 基本信息</div>
            <div class="detail-info-row">
              <span class="info-label">难度：</span>
              <span class="info-value">{{ currentRecipe.difficulty }}</span>
            </div>
            <div class="detail-info-row">
              <span class="info-label">烹饪时间：</span>
              <span class="info-value">{{ currentRecipe.cookTime }}</span>
            </div>
            <div class="detail-info-row">
              <span class="info-label">分类：</span>
              <span class="info-value">{{ currentRecipe.category }}</span>
            </div>
          </div>

          <!-- 所需食材 -->
          <div class="detail-section">
            <div class="detail-section-title">🥗 所需食材</div>
            <div class="detail-ingredients">
              <div 
                class="detail-ingredient" 
                v-for="(ing, index) in currentRecipe.ingredients" 
                :key="index"
              >
                <span class="ing-name">{{ ing.name }}</span>
                <span class="ing-amount">{{ ing.amount }}</span>
              </div>
            </div>
          </div>

          <!-- 烹饪步骤 -->
          <div class="detail-section">
            <div class="detail-section-title">👨‍🍳 烹饪步骤</div>
            <div class="detail-steps">
              <div 
                class="step-item" 
                v-for="(step, index) in currentRecipe.steps" 
                :key="index"
              >
                <div class="step-number">{{ index + 1 }}</div>
                <span class="step-text">{{ step }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="detail-footer">
          <div class="detail-btn primary" @click="startCooking(currentRecipe)">
            <span class="btn-icon">🍳</span>
            <span>开始制作</span>
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
  background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
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

/* 食材展示区域 */
.ingredients-section {
  background-color: #fff;
  margin: 12px;
  border-radius: 12px;
  padding: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.ingredient-count {
  font-size: 12px;
  color: #999;
  margin-left: 4px;
}

.ingredients-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ingredient-tag {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: #F0F7FF;
  border-radius: 16px;
  border: 1px solid #D0E8FF;
}

.tag-icon {
  font-size: 16px;
  margin-right: 4px;
}

.tag-text {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.tag-quantity {
  font-size: 12px;
  color: #666;
  margin-left: 4px;
}

.empty-ingredients {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0;
}

.empty-icon {
  font-size: 36px;
  margin-bottom: 8px;
}

.empty-text {
  font-size: 14px;
  color: #999;
  margin-bottom: 12px;
}

.add-btn {
  display: flex;
  align-items: center;
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.add-btn:active {
  opacity: 0.8;
}

.add-icon {
  font-size: 18px;
  margin-right: 4px;
}

/* 筛选区域 */
.filter-section {
  background-color: #fff;
  margin: 0 12px 12px;
  border-radius: 12px;
  padding: 12px 16px;
  position: relative;
  z-index: 100;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 12px;
}

.match-filter {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.filter-option {
  padding: 6px 14px;
  background-color: #f5f5f5;
  border-radius: 16px;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
  pointer-events: auto;
  border: 2px solid transparent;
  white-space: nowrap;
}

.filter-option:hover {
  background-color: #e8e8e8;
  border-color: #ccc;
}

.filter-option:active {
  transform: scale(0.95);
}

.filter-option.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-color: transparent;
}

/* 菜谱列表 */
.recipe-list {
  flex: 1;
  padding: 0 12px;
}

.empty-recipe {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 0;
}

.empty-hint {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
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

.recipe-card {
  background-color: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  cursor: pointer;
}

.recipe-card:active {
  opacity: 0.9;
}

.recipe-card.simple {
  padding: 12px 16px;
}

.recipe-header {
  margin-bottom: 12px;
}

.recipe-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.recipe-name {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.match-badge {
  padding: 2px 10px;
  border-radius: 10px;
}

.match-badge.high {
  background-color: #E8F8EF;
}

.match-badge.medium {
  background-color: #FFF7E6;
}

.match-badge.low {
  background-color: #FFF2F0;
}

.match-text {
  font-size: 12px;
  font-weight: 500;
}

.match-badge.high .match-text {
  color: #34C759;
}

.match-badge.medium .match-text {
  color: #FF9500;
}

.match-badge.low .match-text {
  color: #FF3B30;
}

.recipe-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 4px;
}

.meta-item {
  display: flex;
  align-items: center;
}

.meta-icon {
  font-size: 14px;
  margin-right: 4px;
}

.meta-text {
  font-size: 12px;
  color: #666;
}

.recipe-desc {
  font-size: 12px;
  color: #999;
}

/* 食材匹配 */
.ingredient-match {
  padding: 12px;
  background-color: #FAFAFA;
  border-radius: 8px;
  margin-bottom: 12px;
}

.match-title {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.match-ingredients {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.match-tag {
  display: flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 12px;
}

.match-tag.matched {
  background-color: #E8F8EF;
  color: #34C759;
}

.match-tag.missing {
  background-color: #FFF2F0;
  color: #FF3B30;
}

.check-icon {
  margin-right: 2px;
}

.missing-icon {
  margin-right: 2px;
}

/* 缺少食材提示 */
.missing-hint {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  background-color: #FFF7E6;
  border-radius: 6px;
  margin-bottom: 12px;
}

.hint-icon {
  font-size: 14px;
  margin-right: 4px;
}

.hint-text {
  font-size: 12px;
  color: #B8860B;
}

/* 底部操作 */
.recipe-footer {
  display: flex;
  gap: 12px;
}

.footer-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 0;
  border-radius: 8px;
}

.footer-btn:active {
  opacity: 0.8;
}

.view-btn {
  background-color: #f5f5f5;
}

.cook-btn {
  background-color: #FF6B6B;
}

.btn-icon {
  font-size: 16px;
  margin-right: 4px;
}

.view-btn .btn-text {
  font-size: 14px;
  color: #666;
}

.cook-btn .btn-text {
  font-size: 14px;
  color: #fff;
}

/* 全部菜谱区域 */
.all-recipes-section {
  margin-top: 12px;
}

/* 详情弹窗 */
.detail-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  z-index: 1000;
}

.detail-container {
  width: 100%;
  max-height: 85vh;
  background-color: #fff;
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.detail-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.detail-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f5f5;
  border-radius: 50%;
  font-size: 16px;
  color: #666;
  cursor: pointer;
}

.detail-close:active {
  opacity: 0.8;
}

.detail-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}

.detail-info-row {
  display: flex;
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f5;
}

.detail-info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 14px;
  color: #666;
  width: 90px;
}

.info-value {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.detail-ingredients {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.detail-ingredient {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: calc(50% - 6px);
  padding: 10px 12px;
  background-color: #FAFAFA;
  border-radius: 8px;
}

.ing-name {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.ing-amount {
  font-size: 12px;
  color: #999;
}

.detail-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-item {
  display: flex;
  gap: 12px;
}

.step-number {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #FF6B6B;
  color: #fff;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.step-text {
  flex: 1;
  font-size: 14px;
  color: #333;
  line-height: 1.8;
}

.detail-footer {
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
}

.detail-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 0;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  color: #fff;
  cursor: pointer;
}

.detail-btn:active {
  opacity: 0.8;
}

.detail-btn.primary {
  background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
}
</style>
