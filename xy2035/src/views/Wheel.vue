<template>
  <div class="page">
    <div class="header">
      <button class="header-btn" @click="goBack">
        ←
      </button>
      <h1 class="header-title">转盘抽奖</h1>
      <div class="header-placeholder"></div>
    </div>

    <div class="page-content">
      <div class="wheel-section p-6">
        <div class="wheel-container">
          <div class="wheel-wrapper" :style="{ transform: `rotate(${rotation}deg)`, transition: isSpinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none' }">
            <svg viewBox="0 0 200 200" class="wheel-svg">
              <circle cx="100" cy="100" r="100" :fill="wheelPrizes[0].color" />
              <path 
                v-for="(prize, index) in wheelPrizes" 
                :key="prize.id"
                :d="getSlicePath(index)"
                :fill="prize.color"
              />
              <text 
                v-for="(prize, index) in wheelPrizes" 
                :key="'text-' + prize.id"
                :transform="getTextTransform(index)"
                class="wheel-text"
                text-anchor="middle"
                dominant-baseline="middle"
              >
                {{ prize.name }}
              </text>
            </svg>
          </div>
          <div class="wheel-pointer">
            ▼
          </div>
          <div class="wheel-center">
            🎰
          </div>
        </div>
        
        <div class="spin-info text-center mt-6">
          <div class="spin-chances mb-2">
            今日剩余抽奖机会：<span class="text-primary font-bold">{{ remainingChances }}</span> 次
          </div>
          <div class="spin-hint text-sm text-secondary">
            每次抽奖随机推荐3道美食
          </div>
        </div>
      </div>

      <div class="spin-actions p-4">
        <button 
          class="btn btn-primary w-full py-4 text-lg"
          :disabled="isSpinning || remainingChances <= 0"
          @click="spinWheel"
        >
          {{ isSpinning ? '抽奖中...' : remainingChances <= 0 ? '今日抽奖已用完' : '开始抽奖' }}
        </button>
      </div>

      <div class="prize-history p-4">
        <h2 class="section-title text-lg font-bold mb-4">🎁 抽奖记录</h2>
        <div v-if="prizeHistory.length === 0" class="empty-state py-8">
          <div class="empty-icon">🎰</div>
          <p>还没有抽奖记录</p>
          <p class="text-sm text-secondary mt-1">点击上方按钮开始抽奖</p>
        </div>
        <div v-else class="history-list">
          <div v-for="(record, idx) in prizeHistory" :key="idx" class="history-item card p-4 mb-3">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="text-2xl">🎉</span>
                <span class="font-medium">{{ record.prizeName }}</span>
              </div>
              <span class="text-sm text-secondary">{{ record.time }}</span>
            </div>
            <div class="recommended-recipes">
              <div class="text-sm text-secondary mb-2">推荐菜谱：</div>
              <div class="recipes-grid grid grid-cols-3 gap-3">
                <div 
                  v-for="recipe in record.recipes" 
                  :key="recipe.id"
                  class="recipe-preview card card-hover cursor-pointer"
                  @click="goToRecipe(recipe.id)"
                >
                  <div class="recipe-preview-image">
                    <img :src="recipe.image" :alt="recipe.title" />
                  </div>
                  <div class="recipe-preview-name text-xs text-center p-2 ellipsis">
                    {{ recipe.title }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="p-4"></div>
    </div>

    <div v-if="showResultModal && currentPrize" class="modal-mask" @click="closeResultModal">
      <div class="modal-content p-0 result-modal" @click.stop>
        <div class="result-header bg-primary p-6 text-center text-white">
          <div class="result-icon text-6xl mb-3">🎉</div>
          <h2 class="text-2xl font-bold mb-2">恭喜获得</h2>
          <p class="text-xl">{{ currentPrize.name }}</p>
        </div>
        <div class="result-body p-6">
          <h3 class="text-base font-bold mb-4 text-center">为您推荐以下3道菜谱</h3>
          <div class="result-recipes grid grid-cols-3 gap-4">
            <div 
              v-for="recipe in resultRecipes" 
              :key="recipe.id"
              class="result-recipe card card-hover cursor-pointer"
              @click="goToRecipe(recipe.id)"
            >
              <div class="result-recipe-image">
                <img :src="recipe.image" :alt="recipe.title" />
              </div>
              <div class="result-recipe-info p-3">
                <div class="result-recipe-name text-sm font-medium ellipsis mb-1">
                  {{ recipe.title }}
                </div>
                <div class="result-recipe-meta flex items-center gap-2 text-xs text-secondary">
                  <span>⭐ {{ recipe.rating }}</span>
                  <span>⏱️ {{ recipe.time }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="result-footer p-4 flex gap-3">
          <button class="btn btn-outline flex-1" @click="closeResultModal">
            稍后查看
          </button>
          <button class="btn btn-primary flex-1" @click="spinAgain">
            再抽一次
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { wheelPrizes, recipes } from '@/data/mockData'

const router = useRouter()
const userStore = useUserStore()

const remainingChances = computed(() => userStore.totalWheelChances)
const rotation = ref(0)
const isSpinning = ref(false)
const prizeHistory = ref([])
const showResultModal = ref(false)
const currentPrize = ref(null)
const resultRecipes = ref([])

const sliceAngle = 360 / wheelPrizes.value.length

const getSlicePath = (index) => {
  const startAngle = index * sliceAngle - 90
  const endAngle = (index + 1) * sliceAngle - 90
  
  const startRadians = (startAngle * Math.PI) / 180
  const endRadians = (endAngle * Math.PI) / 180
  
  const x1 = 100 + 100 * Math.cos(startRadians)
  const y1 = 100 + 100 * Math.sin(startRadians)
  const x2 = 100 + 100 * Math.cos(endRadians)
  const y2 = 100 + 100 * Math.sin(endRadians)
  
  return `M100,100 L${x1},${y1} A100,100 0 0,1 ${x2},${y2} Z`
}

const getTextTransform = (index) => {
  const angle = index * sliceAngle + sliceAngle / 2 - 90
  const radians = (angle * Math.PI) / 180
  const distance = 65
  const x = 100 + distance * Math.cos(radians)
  const y = 100 + distance * Math.sin(radians)
  return `translate(${x}, ${y}) rotate(${angle + 90})`
}

const spinWheel = () => {
  if (isSpinning.value || !userStore.hasWheelChance) return
  
  if (!userStore.useOneWheelChance()) {
    alert('抽奖次数不足')
    return
  }
  
  isSpinning.value = true
  
  const spinCount = 5 + Math.floor(Math.random() * 3)
  const prizeIndex = Math.floor(Math.random() * wheelPrizes.value.length)
  const prize = wheelPrizes.value[prizeIndex]
  
  const targetRotation = (spinCount + 1) * 360 - prizeIndex * sliceAngle - sliceAngle / 2
  rotation.value += targetRotation
  
  setTimeout(() => {
    currentPrize.value = prize
    
    let selectedRecipes = []
    if (prize.recipeIds && prize.recipeIds.length > 0) {
      const shuffled = [...prize.recipeIds].sort(() => 0.5 - Math.random())
      const recipeIds = shuffled.slice(0, 3)
      selectedRecipes = recipeIds.map(id => recipes.value.find(r => r.id === id)).filter(Boolean)
      
      while (selectedRecipes.length < 3) {
        const randomRecipe = recipes.value[Math.floor(Math.random() * recipes.value.length)]
        if (!selectedRecipes.find(r => r.id === randomRecipe.id)) {
          selectedRecipes.push(randomRecipe)
        }
      }
    } else {
      const shuffled = [...recipes.value].sort(() => 0.5 - Math.random())
      selectedRecipes = shuffled.slice(0, 3)
    }
    
    resultRecipes.value = selectedRecipes
    
    prizeHistory.value.unshift({
      prizeName: prize.name,
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      recipes: selectedRecipes
    })
    
    showResultModal.value = true
    isSpinning.value = false
  }, 4200)
}

const goBack = () => {
  router.back()
}

const goToRecipe = (recipeId) => {
  closeResultModal()
  router.push(`/recipe/${recipeId}`)
}

const closeResultModal = () => {
  showResultModal.value = false
}

const spinAgain = () => {
  closeResultModal()
  if (remainingChances.value > 0) {
    spinWheel()
  }
}
</script>

<style scoped>
.wheel-section {
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.wheel-container {
  position: relative;
  width: 280px;
  height: 280px;
}

.wheel-wrapper {
  width: 100%;
  height: 100%;
}

.wheel-svg {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15));
}

.wheel-text {
  fill: white;
  font-size: 9px;
  font-weight: 500;
}

.wheel-pointer {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 32px;
  color: var(--primary-color);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  z-index: 10;
}

.wheel-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 50px;
  height: 50px;
  background-color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 5;
}

.spin-chances {
  font-size: 15px;
}

.section-title {
  color: var(--text-primary);
}

.recipes-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.recipe-preview-image {
  width: 100%;
  height: 80px;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  overflow: hidden;
}

.recipe-preview-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.result-modal {
  max-width: 340px;
  overflow: hidden;
}

.result-header {
  background: linear-gradient(135deg, var(--primary-color), var(--primary-light));
}

.result-recipes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.result-recipe-image {
  width: 100%;
  height: 100px;
  overflow: hidden;
}

.result-recipe-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.page-content {
  padding-bottom: 80px;
}
</style>
