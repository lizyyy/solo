<template>
  <div class="page">
    <div class="header">
      <h1 class="header-title">美食分享圈</h1>
      <button class="header-btn" @click="goToCreatePost">
        ✏️
      </button>
    </div>

    <div class="page-content">
      <div class="post-tabs flex p-4 bg-white">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          class="post-tab flex-1 py-2 text-base"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.name }}
        </button>
      </div>

      <div class="posts-list p-4">
        <div v-if="hasNoFollowingPosts" class="empty-state py-12 text-center">
          <div class="empty-icon text-6xl mb-4">🔍</div>
          <p class="text-lg font-medium mb-2">暂未关注任何人</p>
          <p class="text-sm text-secondary">去发现喜欢的美食作者吧！</p>
          <button class="btn btn-primary mt-4" @click="activeTab = 'recommend'">
            浏览推荐
          </button>
        </div>
        <div v-else-if="displayPosts.length === 0" class="empty-state py-12 text-center">
          <div class="empty-icon text-6xl mb-4">📭</div>
          <p class="text-lg font-medium mb-2">暂无帖子</p>
        </div>
        <template v-else>
          <div v-for="post in displayPosts" :key="post.id" class="post-card card mb-4">
            <div class="post-header p-4 flex items-center justify-between">
              <div class="flex items-center gap-3 cursor-pointer" @click="goToProfile(post.author.id)">
                <img :src="post.author.avatar" class="avatar" />
                <div>
                  <div class="font-medium">{{ post.author.name }}</div>
                  <div class="text-xs text-secondary">Lv.{{ post.author.level }} · {{ post.createdAt }}</div>
                </div>
              </div>
              <button class="btn-text text-sm text-secondary">
                ⋮
              </button>
            </div>

            <div class="post-content px-4 mb-3" @click="goToPostDetail(post.id)">
              <h3 class="post-title font-medium mb-2">{{ post.title }}</h3>
              <p class="post-desc text-secondary text-sm leading-relaxed">{{ post.content }}</p>
            </div>

            <div class="post-images px-4 mb-3" v-if="post.images?.length" @click="goToPostDetail(post.id)">
              <div class="images-grid" :class="'grid-' + Math.min(post.images.length, 3)">
                <div 
                  v-for="(img, idx) in post.images.slice(0, 9)" 
                  :key="idx"
                  class="post-image"
                >
                  <img :src="img" class="w-full h-full object-cover" />
                  <div v-if="idx === 8 && post.images.length > 9" class="more-images absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold">
                    +{{ post.images.length - 9 }}
                  </div>
                </div>
              </div>
            </div>

            <div class="post-tags px-4 mb-3 flex gap-2" v-if="post.tags?.length">
              <span v-for="tag in post.tags" :key="tag" class="tag text-xs">
                #{{ tag }}
              </span>
            </div>

            <div v-if="post.recipeId" class="post-recipe px-4 mb-3">
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

            <div class="post-actions flex items-center justify-between px-4 py-3 border-t">
              <div class="flex items-center gap-6">
                <button 
                  class="action-btn flex items-center gap-1 text-sm"
                  :class="{ liked: post.isLiked }"
                  @click="toggleLike(post.id)"
                >
                  <span class="text-lg">{{ post.isLiked ? '❤️' : '🤍' }}</span>
                  <span>{{ post.likes }}</span>
                </button>
                <button 
                  class="action-btn flex items-center gap-1 text-sm text-secondary"
                  @click="goToPostDetail(post.id)"
                >
                  <span class="text-lg">💬</span>
                  <span>{{ post.comments }}</span>
                </button>
                <button 
                  class="action-btn flex items-center gap-1 text-sm text-secondary"
                  @click="sharePost(post)"
                >
                  <span class="text-lg">📤</span>
                  <span>{{ post.shares }}</span>
                </button>
              </div>
              <button 
                class="action-btn flex items-center gap-1 text-sm text-secondary"
                @click="generatePoster(post)"
              >
                <span class="text-lg">🖼️</span>
                <span>海报</span>
              </button>
            </div>
          </div>
        </template>

        <div class="load-more p-4 text-center" v-if="displayPosts.length > 0 && !hasNoFollowingPosts">
          <button class="btn btn-outline" @click="loadMore">
            加载更多
          </button>
        </div>
      </div>

      <div class="p-4"></div>
    </div>

    <TabBar />

    <div v-if="showShareModal" class="modal-mask" @click="showShareModal = false">
      <div class="modal-content p-4" @click.stop>
        <h3 class="text-lg font-bold mb-4 text-center">分享帖子</h3>
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

    <div v-if="showPosterModal" class="modal-mask" @click="showPosterModal = false">
      <div class="modal-content p-0" style="max-width: 320px;" @click.stop>
        <div class="poster-preview bg-white p-4">
          <div class="poster-header text-center mb-4">
            <div class="poster-logo text-2xl font-bold text-primary mb-1">🍳 厨房大师</div>
            <div class="text-xs text-secondary">发现美食，分享美味</div>
          </div>
          
          <div v-if="selectedPost" class="poster-content">
            <div class="poster-images grid grid-cols-2 gap-2 mb-3" v-if="selectedPost.images?.length">
              <div 
                v-for="(img, idx) in selectedPost.images.slice(0, 4)" 
                :key="idx"
                class="poster-image rounded-lg overflow-hidden"
                :style="{ height: idx === 0 && selectedPost.images.length === 1 ? '180px' : '90px' }"
              >
                <img :src="img" class="w-full h-full object-cover" />
              </div>
            </div>
            
            <div class="poster-text mb-3">
              <h4 class="font-medium mb-1">{{ selectedPost.title }}</h4>
              <p class="text-xs text-secondary line-clamp-2">{{ selectedPost.content }}</p>
            </div>
            
            <div class="poster-footer flex items-center justify-between pt-3 border-t">
              <div class="flex items-center gap-2">
                <img :src="selectedPost.author.avatar" class="w-8 h-8 rounded-full" />
                <span class="text-sm">{{ selectedPost.author.name }}</span>
              </div>
              <div class="qr-code w-16 h-16 bg-secondary/20 rounded flex items-center justify-center">
                <span class="text-xs text-secondary">二维码</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="p-4 flex gap-3">
          <button class="btn btn-outline flex-1" @click="showPosterModal = false">
            关闭
          </button>
          <button class="btn btn-primary flex-1" @click="savePoster">
            保存图片
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
import { posts, recipes } from '@/data/mockData'
import TabBar from '@/components/TabBar.vue'

const router = useRouter()
const userStore = useUserStore()

const activeTab = ref('recommend')
const displayCount = ref(5)
const showShareModal = ref(false)
const showPosterModal = ref(false)
const selectedPost = ref(null)

const tabs = [
  { id: 'recommend', name: '推荐' },
  { id: 'follow', name: '关注' },
  { id: 'hot', name: '热门' }
]

const displayPosts = computed(() => {
  let filtered = posts.value
  
  if (activeTab.value === 'hot') {
    filtered = [...posts.value].sort((a, b) => b.likes - a.likes)
  } else if (activeTab.value === 'follow') {
    filtered = posts.value.filter(p => userStore.checkFollowing(p.author.id))
  }
  
  return filtered.slice(0, displayCount.value)
})

const hasNoFollowingPosts = computed(() => {
  return activeTab.value === 'follow' && userStore.followingPosts.length === 0
})

const goToCreatePost = () => {
  router.push('/create-post')
}

const goToPostDetail = (postId) => {
  router.push(`/post/${postId}`)
}

const goToRecipe = (recipeId) => {
  router.push(`/recipe/${recipeId}`)
}

const goToProfile = (userId) => {
  router.push('/profile')
}

const getRecipeTitle = (recipeId) => {
  const recipe = recipes.value.find(r => r.id === recipeId)
  return recipe?.title || ''
}

const getRecipeImage = (recipeId) => {
  const recipe = recipes.value.find(r => r.id === recipeId)
  return recipe?.image || ''
}

const toggleLike = (postId) => {
  userStore.togglePostLike(postId)
  const post = posts.value.find(p => p.id === postId)
  if (post) {
    const updatedPost = { ...post }
    posts.value = posts.value.map(p => p.id === postId ? updatedPost : p)
  }
}

const sharePost = (post) => {
  selectedPost.value = post
  showShareModal.value = true
}

const generatePoster = (post) => {
  selectedPost.value = post
  showPosterModal.value = true
}

const doShare = async (platform) => {
  let message = ''
  let shareUrl = ''
  if (selectedPost.value) {
    shareUrl = `${window.location.origin}${router.resolve(`/post/${selectedPost.value.id}`).href}`
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

const savePoster = () => {
  alert('海报已保存到相册')
  showPosterModal.value = false
}

const loadMore = () => {
  displayCount.value += 3
}
</script>

<style scoped>
.post-tabs {
  display: flex;
  background-color: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
}

.post-tab {
  background: none;
  border: none;
  padding: 12px 0;
  font-size: 15px;
  color: var(--text-secondary);
  cursor: pointer;
  position: relative;
}

.post-tab.active {
  color: var(--primary-color);
  font-weight: 500;
}

.post-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 3px;
  background-color: var(--primary-color);
  border-radius: 2px;
}

.post-title {
  color: var(--text-primary);
}

.post-desc {
  color: var(--text-secondary);
}

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
  position: relative;
  border-radius: var(--radius-sm);
  overflow: hidden;
  aspect-ratio: 1;
}

.post-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.more-images {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
}

.action-btn.liked {
  color: var(--primary-color);
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

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.page-content {
  padding-bottom: 80px;
}
</style>
