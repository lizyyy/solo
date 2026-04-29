<template>
  <div class="page">
    <div class="header flex items-center justify-between">
      <button class="header-btn" @click="goBack">
        ←
      </button>
      <h1 class="header-title">浏览历史</h1>
      <button class="btn-text text-primary text-sm" @click="clearHistory" v-if="history.length > 0">
        清空
      </button>
    </div>

    <div class="page-content p-4">
      <div v-if="displayHistory.length > 0" class="history-list">
        <div 
          v-for="(item, idx) in displayHistory" 
          :key="item.id"
          class="history-item card p-3 mb-3 cursor-pointer"
          @click="goToRecipe(item.recipeId)"
        >
          <div class="flex items-center gap-3">
            <div class="history-image w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
              <img :src="getRecipeImage(item.recipeId)" class="w-full h-full object-cover" />
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="font-medium text-base ellipsis mb-1">{{ getRecipeTitle(item.recipeId) }}</h4>
              <div class="flex items-center gap-2 text-xs text-secondary mb-1">
                <span>⭐ {{ getRecipeRating(item.recipeId) }}</span>
                <span>⏱️ {{ getRecipeTime(item.recipeId) }}</span>
              </div>
              <div class="text-xs text-light">{{ item.viewedAt }}</div>
            </div>
          </div>
        </div>

        <div v-if="hasMore" class="load-more text-center mt-4">
          <button class="btn btn-outline" @click="loadMore">
            加载更多
          </button>
        </div>
      </div>
      <div v-else class="empty-state">
        <div class="empty-icon">🕐</div>
        <p>还没有浏览历史</p>
        <p class="text-sm text-secondary mt-1">快去发现美食吧</p>
        <button class="btn btn-primary mt-4" @click="goToHome">
          去逛逛
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { recipes } from '@/data/mockData'

const router = useRouter()
const userStore = useUserStore()

const displayCount = ref(10)

const history = computed(() => userStore.history)

const displayHistory = computed(() => {
  return history.value.slice(0, displayCount.value)
})

const hasMore = computed(() => {
  return history.value.length > displayCount.value
})

const goBack = () => {
  router.back()
}

const goToHome = () => {
  router.push('/home')
}

const goToRecipe = (recipeId) => {
  router.push(`/recipe/${recipeId}`)
}

const getRecipeTitle = (recipeId) => {
  const recipe = recipes.value.find(r => r.id === recipeId)
  return recipe?.title || ''
}

const getRecipeImage = (recipeId) => {
  const recipe = recipes.value.find(r => r.id === recipeId)
  return recipe?.image || ''
}

const getRecipeRating = (recipeId) => {
  const recipe = recipes.value.find(r => r.id === recipeId)
  return recipe?.rating || 0
}

const getRecipeTime = (recipeId) => {
  const recipe = recipes.value.find(r => r.id === recipeId)
  return recipe?.time || ''
}

const clearHistory = () => {
  if (confirm('确定要清空浏览历史吗？')) {
    history.value.splice(0, history.value.length)
  }
}

const loadMore = () => {
  displayCount.value += 10
}
</script>

<style scoped>
.empty-state {
  padding: 64px 24px;
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}
</style>
