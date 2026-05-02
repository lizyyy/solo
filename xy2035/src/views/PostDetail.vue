<template>
  <div class="page">
    <div class="header">
      <button class="header-btn" @click="goBack">
        ←
      </button>
      <h1 class="header-title">动态详情</h1>
      <button class="header-btn" @click="showActions = !showActions">
        ⋮
      </button>
    </div>

    <div class="page-content p-4" v-if="post">
      <div class="post-card card p-4 mb-4">
        <div class="post-header flex items-center justify-between mb-3">
          <div class="flex items-center gap-3">
            <img :src="post.author.avatar" class="avatar" />
            <div>
              <div class="font-medium">{{ post.author.name }}</div>
              <div class="text-xs text-secondary">Lv.{{ post.author.level }} · {{ post.createdAt }}</div>
            </div>
          </div>
          <button class="btn btn-outline py-1 text-sm">
            + 关注
          </button>
        </div>

        <div class="post-content mb-3">
          <h2 class="text-lg font-bold mb-2">{{ post.title }}</h2>
          <p class="text-base leading-relaxed">{{ post.content }}</p>
        </div>

        <div class="post-images mb-3" v-if="post.images?.length">
          <div class="images-grid" :class="'grid-' + Math.min(post.images.length, 3)">
            <div 
              v-for="(img, idx) in post.images.slice(0, 9)" 
              :key="idx"
              class="post-image rounded-lg overflow-hidden"
            >
              <img :src="img" class="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        <div class="post-tags flex gap-2 mb-3" v-if="post.tags?.length">
          <span v-for="tag in post.tags" :key="tag" class="tag text-xs">
            #{{ tag }}
          </span>
        </div>

        <div v-if="post.recipeId" class="post-recipe">
          <div class="recipe-link card card-hover flex items-center gap-3 p-3 bg-secondary/10 cursor-pointer" @click="goToRecipe(post.recipeId)">
            <div class="recipe-link-image w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
              <img :src="getRecipeImage(post.recipeId)" class="w-full h-full object-cover" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium flex items-center gap-1">
                <span>📖</span>
                <span class="ellipsis">{{ getRecipeTitle(post.recipeId) }}</span>
              </div>
              <div class="text-xs text-secondary mt-1">点击查看菜谱详情</div>
            </div>
            <span class="text-primary">→</span>
          </div>
        </div>

        <div class="post-actions flex items-center justify-between pt-3 mt-3 border-t">
          <div class="flex items-center gap-6">
            <button 
              class="action-btn flex items-center gap-1"
              :class="{ liked: post.isLiked }"
              @click="toggleLike"
            >
              <span class="text-xl">{{ post.isLiked ? '❤️' : '🤍' }}</span>
              <span>{{ post.likes }}</span>
            </button>
            <button class="action-btn flex items-center gap-1 text-secondary">
              <span class="text-xl">💬</span>
              <span>{{ post.comments }}</span>
            </button>
            <button class="action-btn flex items-center gap-1 text-secondary" @click="sharePost">
              <span class="text-xl">📤</span>
              <span>{{ post.shares }}</span>
            </button>
          </div>
          <button class="action-btn flex items-center gap-1 text-secondary" @click="generatePoster">
            <span class="text-xl">🖼️</span>
            <span>海报</span>
          </button>
        </div>
      </div>

      <div class="comments-section card p-4">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-bold">评论 ({{ comments.length }})</h3>
          <select v-model="sortBy" class="text-sm text-secondary bg-transparent border-none outline-none cursor-pointer">
            <option value="new">最新</option>
            <option value="hot">最热</option>
          </select>
        </div>

        <div class="comment-input-wrapper mb-4">
          <div class="flex gap-3">
            <img :src="currentUser.avatar" class="avatar-sm" />
            <div class="flex-1 flex gap-2">
              <input 
                v-model="newComment"
                type="text" 
                placeholder="说点什么..."
                class="input flex-1"
                @keyup.enter="submitComment"
              />
              <button class="btn btn-primary" @click="submitComment" :disabled="!newComment.trim()">
                发送
              </button>
            </div>
          </div>
        </div>

        <div class="comments-list">
          <div 
            v-for="comment in sortedComments" 
            :key="comment.id"
            class="comment-item py-4 border-b"
          >
            <div class="flex gap-3">
              <img :src="comment.userAvatar" class="avatar-sm" />
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-1">
                  <span class="font-medium text-sm">{{ comment.userName }}</span>
                  <span class="text-xs text-secondary">{{ comment.createdAt }}</span>
                </div>
                <p class="text-sm text-secondary">{{ comment.content }}</p>
                <div class="comment-actions flex items-center gap-4 mt-2 text-xs text-secondary">
                  <button class="flex items-center gap-1" @click="likeComment(comment.id)">
                    <span>{{ comment.isLiked ? '❤️' : '🤍' }}</span>
                    <span>{{ comment.likes }}</span>
                  </button>
                  <button class="flex items-center gap-1">
                    <span>💬</span>
                    <span>回复</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="comments.length === 0" class="empty-state py-8">
            <div class="empty-icon">💬</div>
            <p>暂无评论</p>
            <p class="text-sm text-secondary mt-1">快来抢沙发吧</p>
          </div>
        </div>
      </div>

      <div class="p-4"></div>
    </div>

    <div v-if="showShareModal" class="modal-mask" @click="showShareModal = false">
      <div class="modal-content p-4" @click.stop>
        <h3 class="text-lg font-bold mb-4 text-center">分享动态</h3>
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
          <button class="share-option flex flex-col items-center gap-2" @click="doShare('copy')">
            <span class="text-3xl">📋</span>
            <span class="text-xs text-secondary">复制链接</span>
          </button>
        </div>
        <button class="btn btn-outline w-full" @click="showShareModal = false">
          取消
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { getPostById, getCommentsByPost, currentUser, recipes } from '@/data/mockData'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const post = ref(null)
const comments = ref([])
const newComment = ref('')
const sortBy = ref('new')
const showActions = ref(false)
const showShareModal = ref(false)

const sortedComments = computed(() => {
  if (sortBy.value === 'hot') {
    return [...comments.value].sort((a, b) => b.likes - a.likes)
  }
  return comments.value
})

onMounted(() => {
  const id = parseInt(route.params.id)
  post.value = getPostById(id)
  comments.value = getCommentsByPost(id)
})

const goBack = () => {
  router.back()
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

const toggleLike = () => {
  if (post.value) {
    userStore.togglePostLike(post.value.id)
    post.value = { ...post.value }
  }
}

const sharePost = () => {
  showShareModal.value = true
}

const generatePoster = () => {
  alert('海报生成中...')
}

const doShare = async (platform) => {
  let message = ''
  let shareUrl = ''
  if (post.value) {
    shareUrl = `${window.location.origin}${router.resolve(`/post/${post.value.id}`).href}`
  }
  
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
  
  const comment = userStore.addNewPostComment(
    post.value.id,
    newComment.value
  )
  
  comments.value.unshift(comment)
  
  if (post.value) {
    post.value.comments += 1
    post.value = { ...post.value }
  }
  
  newComment.value = ''
}

const likeComment = (commentId) => {
  const comment = comments.value.find(c => c.id === commentId)
  if (comment) {
    comment.isLiked = !comment.isLiked
    comment.likes += comment.isLiked ? 1 : -1
  }
}
</script>

<style scoped>
.images-grid {
  display: grid;
  gap: 4px;
}

.images-grid.grid-1 {
  grid-template-columns: 1fr;
}

.images-grid.grid-2 {
  grid-template-columns: repeat(2, 1fr);
}

.images-grid.grid-3 {
  grid-template-columns: repeat(3, 1fr);
}

.post-image {
  aspect-ratio: 1;
}

.post-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
}

.action-btn.liked {
  color: var(--primary-color);
}

.comment-item {
  border-bottom: 1px solid var(--border-color);
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

.empty-state {
  padding: 32px 24px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.page-content {
  padding-bottom: 80px;
}
</style>
