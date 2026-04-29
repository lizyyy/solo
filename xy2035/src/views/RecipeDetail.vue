<template>
  <div class="page">
    <div class="recipe-header">
      <button class="header-btn back-btn" @click="goBack">
        ←
      </button>
      <div class="header-actions">
        <button class="header-btn" @click="shareRecipe">
          📤
        </button>
        <button class="header-btn" @click="toggleFavorite">
          <span>{{ recipe?.isFavorite ? '❤️' : '🤍' }}</span>
        </button>
      </div>
    </div>

    <div class="page-content" v-if="recipe">
      <div class="recipe-cover">
        <img :src="recipe.image" :alt="recipe.title" />
        <div class="recipe-cover-overlay"></div>
        <div class="recipe-cover-info">
          <h1 class="recipe-title text-xl font-bold text-white mb-2">{{ recipe.title }}</h1>
          <div class="recipe-tags flex gap-2">
            <span v-for="tag in recipe.tags" :key="tag" class="tag tag-primary opacity-90">
              {{ tag }}
            </span>
          </div>
        </div>
      </div>

      <div class="recipe-author p-4 bg-white">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <img :src="recipe.author.avatar" class="avatar-lg" />
            <div>
              <div class="font-medium text-base">{{ recipe.author.name }}</div>
              <div class="text-sm text-secondary">
                Lv.{{ recipe.author.level }} · {{ recipe.author.followers }} 粉丝
              </div>
            </div>
          </div>
          <button class="btn btn-sm" :class="isFollowing ? 'btn-primary' : 'btn-outline'" @click="toggleFollow">
            {{ isFollowing ? '已关注' : '+ 关注' }}
          </button>
        </div>
      </div>

      <div class="recipe-stats p-4 bg-white mt-2">
        <div class="stats-grid">
          <div class="stat-item text-center">
            <div class="stat-value text-primary font-bold text-xl">{{ recipe.rating }}</div>
            <div class="stat-label text-sm text-secondary">评分</div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item text-center">
            <div class="stat-value text-primary font-bold text-xl">{{ formatNumber(recipe.ratingCount) }}</div>
            <div class="stat-label text-sm text-secondary">评价</div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item text-center">
            <div class="stat-value text-primary font-bold text-xl">{{ formatNumber(recipe.favoriteCount) }}</div>
            <div class="stat-label text-sm text-secondary">收藏</div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item text-center">
            <div class="stat-value text-primary font-bold text-xl">{{ formatNumber(recipe.viewCount) }}</div>
            <div class="stat-label text-sm text-secondary">浏览</div>
          </div>
        </div>
      </div>

      <div class="recipe-meta-tags p-4 bg-white mt-2">
        <div class="meta-tags flex flex-wrap gap-3">
          <div class="meta-tag flex items-center gap-2">
            <span class="meta-icon">⏱️</span>
            <span class="text-sm">{{ recipe.time }}</span>
          </div>
          <div class="meta-tag flex items-center gap-2">
            <span class="meta-icon">📊</span>
            <span class="text-sm">{{ recipe.difficulty }}</span>
          </div>
          <div class="meta-tag flex items-center gap-2">
            <span class="meta-icon">🔥</span>
            <span class="text-sm">{{ recipe.calories }} 卡路里</span>
          </div>
        </div>
        <div class="recipe-desc mt-3 text-secondary text-sm">
          {{ recipe.description }}
        </div>
      </div>

      <div class="recipe-section p-4 bg-white mt-2">
        <h2 class="section-title text-lg font-bold mb-4 flex items-center gap-2">
          <span>🥬</span> 食材用料
        </h2>
        <div class="ingredients-list">
          <div 
            v-for="(ingredient, index) in recipe.ingredients" 
            :key="index"
            class="ingredient-item flex items-center justify-between py-3"
            :class="{ 'border-b': index < recipe.ingredients.length - 1 }"
          >
            <span class="ingredient-name">{{ ingredient.name }}</span>
            <span class="ingredient-amount text-secondary">
              {{ ingredient.amount }}{{ ingredient.unit }}
            </span>
          </div>
        </div>
      </div>

      <div class="recipe-section p-4 bg-white mt-2">
        <h2 class="section-title text-lg font-bold mb-4 flex items-center gap-2">
          <span>📝</span> 做法步骤
        </h2>
        <div class="steps-list">
          <div v-for="step in recipe.steps" :key="step.order" class="step-item mb-6">
            <div class="step-header flex items-center gap-3 mb-3">
              <div class="step-number bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">
                {{ step.order }}
              </div>
              <span class="step-order text-secondary text-sm">第 {{ step.order }} 步</span>
            </div>
            <div class="step-image rounded-lg overflow-hidden mb-3" v-if="step.image">
              <img :src="step.image" class="w-full" style="height: 200px; object-fit: cover;" />
            </div>
            <p class="step-desc text-base leading-relaxed">{{ step.description }}</p>
          </div>
        </div>
      </div>

      <div class="recipe-section p-4 bg-white mt-2">
        <h2 class="section-title text-lg font-bold mb-3 flex items-center gap-2">
          <span>💡</span> 小贴士
        </h2>
        <div class="tips-box bg-secondary/10 p-4 rounded-lg">
          <p class="text-secondary text-sm leading-relaxed">{{ recipe.tips }}</p>
        </div>
      </div>

      <div class="recipe-section p-4 bg-white mt-2">
        <div class="flex items-center justify-between mb-4">
          <h2 class="section-title text-lg font-bold flex items-center gap-2">
            <span>💬</span> 评论 ({{ recipeComments.length }})
          </h2>
          <button class="btn-text text-primary text-sm" @click="showAllComments = true">
            查看全部
          </button>
        </div>

        <div class="comment-input-wrapper mb-4">
          <div class="flex gap-3">
            <img :src="currentUser.avatar" class="avatar-sm" />
            <div class="flex-1 flex gap-2">
              <input 
                v-model="newComment"
                type="text" 
                placeholder="写下你的评论..."
                class="input flex-1"
              />
              <button class="btn btn-primary" @click="submitComment">
                发送
              </button>
            </div>
          </div>
          <div class="rating-input mt-3 flex items-center gap-2">
            <span class="text-sm text-secondary">评分：</span>
            <div class="stars flex gap-1">
              <button 
                v-for="i in 5" 
                :key="i"
                class="star-btn text-2xl"
                @click="commentRating = i"
              >
                {{ i <= commentRating ? '⭐' : '☆' }}
              </button>
            </div>
            <span class="text-sm text-secondary">{{ commentRating }} 分</span>
          </div>
        </div>

        <div class="comments-list">
          <div v-for="comment in displayComments" :key="comment.id" class="comment-item py-4 border-b">
            <div class="flex gap-3">
              <img :src="comment.userAvatar" class="avatar-sm" />
              <div class="flex-1">
                <div class="flex items-center justify-between mb-1">
                  <span class="font-medium text-sm">{{ comment.userName }}</span>
                  <span class="text-xs text-secondary">{{ comment.createdAt }}</span>
                </div>
                <div class="comment-rating flex items-center gap-1 mb-2" v-if="comment.rating">
                  <span v-for="i in 5" :key="i" class="text-xs">
                    {{ i <= comment.rating ? '⭐' : '☆' }}
                  </span>
                </div>
                <p class="text-sm text-secondary">{{ comment.content }}</p>
                <div class="comment-images flex gap-2 mt-2" v-if="comment.images?.length">
                  <img 
                    v-for="(img, idx) in comment.images" 
                    :key="idx" 
                    :src="img" 
                    class="comment-image w-20 h-20 rounded-lg object-cover"
                  />
                </div>
                <div class="replies-list mt-3 ml-4" v-if="comment.replies?.length">
                  <div 
                    v-for="reply in comment.replies" 
                    :key="reply.id" 
                    class="reply-item bg-secondary/10 p-3 rounded-lg mb-2"
                  >
                    <div class="flex items-center gap-2 mb-1">
                      <img :src="reply.userAvatar" class="avatar-xs" />
                      <span class="font-medium text-xs text-primary">{{ reply.userName }}</span>
                      <span class="text-xs text-secondary">回复</span>
                    </div>
                    <p class="text-sm">{{ reply.content }}</p>
                    <span class="text-xs text-secondary">{{ reply.createdAt }}</span>
                  </div>
                </div>
                <div class="comment-actions flex items-center gap-4 mt-2 text-xs text-secondary">
                  <button class="flex items-center gap-1" @click="likeComment(comment.id)">
                    <span>{{ comment.isLiked ? '❤️' : '🤍' }}</span>
                    <span>{{ comment.likes }}</span>
                  </button>
                  <button class="flex items-center gap-1" @click="startReply(comment)">
                    <span>💬</span>
                    <span>回复 ({{ comment.replies?.length || 0 }})</span>
                  </button>
                </div>
                <div class="reply-input-wrapper mt-3 p-3 bg-secondary/10 rounded-lg" v-if="replyingToCommentId === comment.id">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs text-secondary">回复 @{{ replyingToUserName }}：</span>
                    <button class="text-xs text-primary" @click="cancelReply">取消</button>
                  </div>
                  <div class="flex gap-2">
                    <input 
                      v-model="replyContent"
                      type="text" 
                      placeholder="写下你的回复..."
                      class="input flex-1 text-sm"
                      @keyup.enter="submitReply"
                    />
                    <button class="btn btn-primary btn-sm" @click="submitReply">
                      发送
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="p-4"></div>
    </div>

    <div class="recipe-bottom-bar safe-bottom" v-if="recipe">
      <div class="bottom-actions flex items-center gap-4">
        <button class="action-btn flex flex-col items-center gap-1" @click="toggleFavorite">
          <span class="text-xl">{{ recipe.isFavorite ? '❤️' : '🤍' }}</span>
          <span class="text-xs text-secondary">收藏</span>
        </button>
        <button class="action-btn flex flex-col items-center gap-1" @click="shareRecipe">
          <span class="text-xl">📤</span>
          <span class="text-xs text-secondary">分享</span>
        </button>
        <button class="action-btn flex flex-col items-center gap-1" @click="goToCheckin">
          <span class="text-xl">📅</span>
          <span class="text-xs text-secondary">打卡</span>
        </button>
      </div>
      <button class="btn btn-primary flex-1 ml-4" @click="startCooking">
        开始烹饪
      </button>
    </div>

    <div v-if="showShareModal" class="modal-mask" @click="showShareModal = false">
      <div class="modal-content p-4" @click.stop>
        <h3 class="text-lg font-bold mb-4 text-center">分享菜谱</h3>
        <div class="share-options grid grid-cols-4 gap-4 mb-4">
          <button class="share-option flex flex-col items-center gap-2" @click="doShare('wechat')">
            <span class="text-3xl">💬</span>
            <span class="text-xs text-secondary">微信</span>
          </button>
          <button class="share-option flex flex-col items-center gap-2" @click="doShare('moments')">
            <span class="text-3xl">🌐</span>
            <span class="text-xs text-secondary">朋友圈</span>
          </button>
          <button class="share-option flex flex-col items-center gap-2" @click="doShare('qq')">
            <span class="text-3xl">🐧</span>
            <span class="text-xs text-secondary">QQ</span>
          </button>
          <button class="share-option flex flex-col items-center gap-2" @click="doShare('poster')">
            <span class="text-3xl">🖼️</span>
            <span class="text-xs text-secondary">海报</span>
          </button>
        </div>
        <button class="btn btn-outline w-full" @click="showShareModal = false">
          取消
        </button>
      </div>
    </div>

    <div v-if="showCookingModal && recipe" class="modal-mask" @click="showCookingModal = false">
      <div class="modal-content p-0" style="max-width: 90%;" @click.stop>
        <div class="cooking-step-display p-6 text-center">
          <div class="cooking-step-number text-primary text-6xl font-bold mb-4">
            {{ currentCookingStep + 1 }}
          </div>
          <div class="cooking-step-image rounded-lg overflow-hidden mb-4" v-if="recipe.steps[currentCookingStep]?.image">
            <img :src="recipe.steps[currentCookingStep]?.image" class="w-full" style="height: 200px; object-fit: cover;" />
          </div>
          <p class="cooking-step-text text-lg mb-4">{{ recipe.steps[currentCookingStep]?.description }}</p>
          <div class="cooking-progress flex items-center justify-center gap-2 mb-4">
            <span v-for="(_, idx) in recipe.steps.length" :key="idx" class="progress-dot">
              <span 
                class="inline-block w-2 h-2 rounded-full"
                :class="idx <= currentCookingStep ? 'bg-primary' : 'bg-secondary'"
              ></span>
            </span>
          </div>
          <div class="cooking-controls flex items-center justify-center gap-4">
            <button 
              class="btn btn-outline" 
              :disabled="currentCookingStep === 0"
              @click="prevStep"
            >
              上一步
            </button>
            <button 
              class="btn btn-primary"
              :disabled="currentCookingStep >= recipe.steps.length - 1"
              @click="nextStep"
            >
              {{ currentCookingStep >= recipe.steps.length - 1 ? '完成' : '下一步' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { getRecipeById, getCommentsByRecipe, currentUser, recipes } from '@/data/mockData'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const recipe = ref(null)
const recipeComments = ref([])
const displayComments = ref([])
const newComment = ref('')
const commentRating = ref(5)
const showAllComments = ref(false)
const showShareModal = ref(false)
const showCookingModal = ref(false)
const currentCookingStep = ref(0)
const replyingToCommentId = ref(null)
const replyingToUserName = ref('')
const replyContent = ref('')

const isFollowing = computed(() => {
  if (recipe.value) {
    return userStore.checkFollowing(recipe.value.author.id)
  }
  return false
})

onMounted(() => {
  const id = parseInt(route.params.id)
  recipe.value = getRecipeById(id)
  recipeComments.value = getCommentsByRecipe(id)
  displayComments.value = recipeComments.value.slice(0, 3)
  
  if (recipe.value) {
    userStore.addBrowseHistory(recipe.value.id)
  }
})

const goBack = () => {
  router.back()
}

const toggleFavorite = () => {
  if (recipe.value) {
    userStore.toggleFavorite(recipe.value.id)
    recipe.value = { ...recipe.value }
  }
}

const toggleFollow = () => {
  if (!recipe.value) return
  userStore.toggleFollow(recipe.value.author.id)
  recipe.value = { ...recipe.value }
}

const shareRecipe = () => {
  showShareModal.value = true
}

const doShare = async (platform) => {
  let message = ''
  const shareUrl = `${window.location.origin}${router.resolve(`/recipe/${recipe.value.id}`).href}`
  
  switch (platform) {
    case 'wechat':
      message = '已分享到微信'
      break
    case 'moments':
      message = '已分享到朋友圈'
      break
    case 'qq':
      message = '已分享到QQ'
      break
    case 'copy':
      try {
        await navigator.clipboard.writeText(shareUrl)
        message = '链接已复制到剪贴板'
      } catch (err) {
        const textArea = document.createElement('textarea')
        textArea.value = shareUrl
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        message = '链接已复制到剪贴板'
      }
      break
  }
  
  alert(message)
  showShareModal.value = false
}

const submitComment = () => {
  if (!newComment.value.trim()) return
  
  const comment = userStore.addRecipeComment(
    recipe.value.id,
    newComment.value,
    commentRating.value
  )
  
  recipeComments.value.unshift(comment)
  displayComments.value.unshift(comment)
  newComment.value = ''
  commentRating.value = 5
}

const likeComment = (commentId) => {
  const comment = recipeComments.value.find(c => c.id === commentId)
  if (comment) {
    comment.isLiked = !comment.isLiked
    comment.likes += comment.isLiked ? 1 : -1
  }
}

const startReply = (comment) => {
  replyingToCommentId.value = comment.id
  replyingToUserName.value = comment.userName
  replyContent.value = ''
}

const cancelReply = () => {
  replyingToCommentId.value = null
  replyingToUserName.value = ''
  replyContent.value = ''
}

const submitReply = () => {
  if (!replyContent.value.trim()) return
  
  const comment = recipeComments.value.find(c => c.id === replyingToCommentId.value)
  if (comment) {
    if (!comment.replies) {
      comment.replies = []
    }
    
    const newReply = {
      id: Date.now(),
      userId: currentUser.value.id,
      userName: currentUser.value.name,
      userAvatar: currentUser.value.avatar,
      content: replyContent.value,
      createdAt: new Date().toLocaleString('zh-CN')
    }
    
    comment.replies.push(newReply)
    
    cancelReply()
  }
}

const startCooking = () => {
  currentCookingStep.value = 0
  showCookingModal.value = true
}

const prevStep = () => {
  if (currentCookingStep.value > 0) {
    currentCookingStep.value--
  }
}

const nextStep = () => {
  if (currentCookingStep.value < recipe.value.steps.length - 1) {
    currentCookingStep.value++
  } else {
    showCookingModal.value = false
    alert('恭喜完成烹饪！快去打卡吧！')
  }
}

const goToCheckin = () => {
  router.push('/checkin')
}

const formatNumber = (num) => {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  }
  return num.toString()
}
</script>

<style scoped>
.recipe-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
  padding-top: calc(12px + env(safe-area-inset-top));
}

.back-btn {
  width: 36px;
  height: 36px;
  background-color: rgba(0, 0, 0, 0.3);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 18px;
  cursor: pointer;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-actions .header-btn {
  width: 36px;
  height: 36px;
  background-color: rgba(0, 0, 0, 0.3);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 18px;
  cursor: pointer;
}

.recipe-cover {
  position: relative;
  width: 100%;
  height: 280px;
}

.recipe-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.recipe-cover-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 100%);
}

.recipe-cover-info {
  position: absolute;
  bottom: 20px;
  left: 16px;
  right: 16px;
}

.recipe-title {
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.stat-item {
  padding: 8px;
}

.stat-divider {
  width: 1px;
  background-color: var(--border-color);
}

.meta-tags {
  padding: 8px 0;
}

.meta-tag {
  padding: 6px 12px;
  background-color: var(--bg-secondary);
  border-radius: var(--radius-full);
}

.meta-icon {
  font-size: 16px;
}

.section-title {
  color: var(--text-primary);
}

.ingredient-item {
  border-bottom: 1px solid var(--border-color);
}

.ingredient-name {
  color: var(--text-primary);
}

.ingredient-amount {
  color: var(--text-secondary);
}

.step-number {
  background-color: var(--primary-color);
}

.step-desc {
  color: var(--text-primary);
}

.tips-box {
  background-color: rgba(107, 203, 119, 0.1);
  border-radius: var(--radius-md);
}

.comment-input-wrapper {
  padding: 12px;
  background-color: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.star-btn {
  background: none;
  border: none;
  cursor: pointer;
}

.comment-item {
  border-bottom: 1px solid var(--border-color);
}

.comment-image {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-sm);
  object-fit: cover;
}

.recipe-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  background-color: var(--bg-primary);
  border-top: 1px solid var(--border-color);
  z-index: 100;
}

.bottom-actions {
  display: flex;
  gap: 16px;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
}

.share-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.share-option {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
}

.cooking-step-display {
  padding: 24px;
}

.cooking-step-number {
  color: var(--primary-color);
}

.progress-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.page-content {
  padding-bottom: 80px;
}
</style>
