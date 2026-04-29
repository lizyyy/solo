<template>
  <div class="page">
    <div class="header">
      <button class="header-btn" @click="goBack">
        ←
      </button>
      <h1 class="header-title">我的收藏</h1>
      <div class="header-placeholder"></div>
    </div>

    <div class="page-content p-4">
      <div v-if="favorites.length > 0" class="recipes-list">
        <RecipeCard 
          v-for="recipe in favorites" 
          :key="recipe.id"
          :recipe="recipe"
          @toggle-favorite="handleToggleFavorite(recipe.id)"
        />
      </div>
      <div v-else class="empty-state">
        <div class="empty-icon">🤍</div>
        <p>还没有收藏任何菜谱</p>
        <p class="text-sm text-secondary mt-1">快去发现美食吧</p>
        <button class="btn btn-primary mt-4" @click="goToHome">
          去逛逛
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import RecipeCard from '@/components/RecipeCard.vue'

const router = useRouter()
const userStore = useUserStore()

const favorites = computed(() => userStore.favorites)

const goBack = () => {
  router.back()
}

const goToHome = () => {
  router.push('/home')
}

const handleToggleFavorite = (recipeId) => {
  userStore.toggleFavorite(recipeId)
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
