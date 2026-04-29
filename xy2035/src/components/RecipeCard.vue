<template>
  <div class="recipe-card card card-hover" @click="goToDetail">
    <div class="recipe-image">
      <img :src="recipe.image" :alt="recipe.title" />
      <div class="recipe-stats">
        <span class="stat-item">
          <span>⭐</span>
          <span>{{ recipe.rating }}</span>
        </span>
      </div>
      <div v-if="recipe.isFavorite" class="favorite-badge" @click.stop="$emit('toggleFavorite')">
        ❤️
      </div>
    </div>
    <div class="recipe-info p-3">
      <h3 class="recipe-title font-medium mb-2">{{ recipe.title }}</h3>
      <div class="recipe-meta flex items-center gap-2 text-sm text-secondary">
        <span class="tag tag-primary">{{ recipe.difficulty }}</span>
        <span>⏱️ {{ recipe.time }}</span>
        <span>🔥 {{ recipe.calories }}卡</span>
      </div>
      <div class="recipe-footer flex items-center justify-between mt-2 text-sm text-secondary">
        <div class="flex items-center gap-1">
          <img :src="recipe.author.avatar" class="avatar-sm" />
          <span>{{ recipe.author.name }}</span>
        </div>
        <div class="flex items-center gap-3">
          <span>👁️ {{ formatNumber(recipe.viewCount) }}</span>
          <span>❤️ {{ formatNumber(recipe.favoriteCount) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const props = defineProps({
  recipe: {
    type: Object,
    required: true
  }
})

defineEmits(['toggleFavorite'])

const router = useRouter()

const goToDetail = () => {
  router.push(`/recipe/${props.recipe.id}`)
}

const formatNumber = (num) => {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  }
  return num.toString()
}
</script>

<style scoped>
.recipe-card {
  margin-bottom: 16px;
}

.recipe-image {
  position: relative;
  width: 100%;
  height: 180px;
  overflow: hidden;
}

.recipe-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.recipe-stats {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  gap: 8px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 4px 8px;
  border-radius: var(--radius-full);
  font-size: 12px;
}

.favorite-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 6px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
}

.recipe-title {
  font-size: 15px;
  color: var(--text-primary);
}

.recipe-meta {
  margin-top: 8px;
}
</style>
