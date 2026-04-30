<template>
  <div class="page">
    <div class="header">
      <h1 class="header-title">菜谱分类</h1>
      <button class="header-btn" @click="showUpload = true">
        <span>📝</span>
      </button>
    </div>

    <div class="page-content">
      <div class="category-grid p-4">
        <div 
          v-for="cat in categories" 
          :key="cat.id"
          class="category-item card card-hover"
          :style="{ borderLeftColor: cat.color }"
          @click="selectCategory(cat.id)"
        >
          <div class="category-icon text-2xl">{{ cat.icon }}</div>
          <div class="category-name text-base font-medium">{{ cat.name }}</div>
          <div class="category-count text-sm text-secondary">
            {{ getCategoryCount(cat.id) }} 道菜谱
          </div>
        </div>
      </div>

      <div v-if="selectedCategory" class="selected-category p-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="section-title text-lg font-bold">
            {{ getSelectedCategoryName() }}
          </h2>
          <button class="btn-text text-primary" @click="clearCategory">
            查看全部
          </button>
        </div>
        
        <div class="recipes-list">
          <RecipeCard 
            v-for="recipe in filteredRecipes" 
            :key="recipe.id"
            :recipe="recipe"
            @toggle-favorite="handleToggleFavorite(recipe.id)"
          />
        </div>
      </div>

      <div v-else class="all-recipes p-4">
        <h2 class="section-title text-lg font-bold mb-3">全部菜谱</h2>
        <div class="recipes-list">
          <RecipeCard 
            v-for="recipe in recipes" 
            :key="recipe.id"
            :recipe="recipe"
            @toggle-favorite="handleToggleFavorite(recipe.id)"
          />
        </div>
      </div>
    </div>

    <TabBar />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { categories, recipes, getRecipesByCategory } from '@/data/mockData'
import TabBar from '@/components/TabBar.vue'
import RecipeCard from '@/components/RecipeCard.vue'

const router = useRouter()
const userStore = useUserStore()

const selectedCategory = ref(null)
const showUpload = ref(false)

const filteredRecipes = computed(() => {
  if (!selectedCategory.value) return []
  return getRecipesByCategory(selectedCategory.value)
})

const getCategoryCount = (categoryId) => {
  return recipes.value.filter(r => r.categoryId === categoryId).length
}

const getSelectedCategoryName = () => {
  const cat = categories.value.find(c => c.id === selectedCategory.value)
  return cat ? cat.name : ''
}

const selectCategory = (categoryId) => {
  selectedCategory.value = categoryId
}

const clearCategory = () => {
  selectedCategory.value = null
}

const handleToggleFavorite = (recipeId) => {
  userStore.toggleFavorite(recipeId)
}
</script>

<style scoped>
.category-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.category-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 8px;
  border-left: 3px solid var(--primary-color);
  cursor: pointer;
}

.category-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.category-name {
  color: var(--text-primary);
  margin-bottom: 4px;
}

.recipes-list {
  margin-top: 12px;
}

.section-title {
  color: var(--text-primary);
}
</style>
