<template>
  <div class="page">
    <div class="page-header">
      <div class="header-content">
        <span class="back-btn" @click="goBack">‹</span>
        <span class="header-title">邻里圈</span>
        <span class="create-btn" @click="goToCreatePost">+ 发布</span>
      </div>
    </div>
    
    <div class="content">
      <!-- 分类筛选 -->
      <div class="category-filter">
        <div 
          class="filter-item" 
          :class="{ active: activeCategory === 'all' }"
          @click="setCategory('all')"
        >
          全部
        </div>
        <div 
          class="filter-item" 
          :class="{ active: activeCategory === 'story' }"
          @click="setCategory('story')"
        >
          互助故事
        </div>
        <div 
          class="filter-item" 
          :class="{ active: activeCategory === 'activity' }"
          @click="setCategory('activity')"
        >
          社区活动
        </div>
        <div 
          class="filter-item" 
          :class="{ active: activeCategory === 'notice' }"
          @click="setCategory('notice')"
        >
          通知公告
        </div>
        <div 
          class="filter-item" 
          :class="{ active: activeCategory === 'life' }"
          @click="setCategory('life')"
        >
          生活分享
        </div>
      </div>
      
      <!-- 动态列表 -->
      <div class="posts-list">
        <div v-if="filteredPosts.length === 0" class="empty-state">
          <div class="empty-state-icon">📝</div>
          <p>暂无{{ getCategoryText(activeCategory) }}动态</p>
          <button class="btn btn-primary" @click="goToCreatePost">发布第一条动态</button>
        </div>
        
        <div 
          v-for="post in filteredPosts" 
          :key="post.id" 
          class="post-card"
          @click="openPostDetail(post)"
        >
          <!-- 作者信息 -->
          <div class="post-header">
            <div class="user-info-section">
              <div class="user-avatar-small">{{ getAuthor(post.authorId)?.avatar || '👤' }}</div>
              <div class="user-details-small">
                <div class="user-name-small">{{ getAuthor(post.authorId)?.name || '匿名用户' }}</div>
                <div class="user-stats-tiny">
                  <span>{{ formatDate(post.createdAt) }}</span>
                  <span class="category-tag-mini" :style="{ backgroundColor: getCategoryColor(post.category) }">
                    {{ getCategoryName(post.category) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 动态内容 -->
          <div class="post-content">
            <h3 class="post-title">{{ post.title }}</h3>
            <p class="post-text">{{ post.content }}</p>
            
            <!-- 图片网格 -->
            <div v-if="post.images && post.images.length > 0" class="post-images">
              <div 
                v-for="(image, index) in post.images.slice(0, 9)" 
                :key="index"
                class="post-image"
                :class="{ 
                  'single-image': post.images.length === 1,
                  'two-images': post.images.length === 2,
                  'three-images': post.images.length === 3
                }"
              >
                <img :src="image" :alt="`图片${index + 1}`" />
              </div>
            </div>
            
            <!-- 标签 -->
            <div v-if="post.tags && post.tags.length > 0" class="post-tags">
              <span v-for="tag in post.tags" :key="tag" class="skill-tag">
                #{{ tag }}
              </span>
            </div>
          </div>
          
          <!-- 互动栏 -->
          <div class="post-actions">
            <div class="action-item" @click="toggleLike(post)">
              <span class="action-icon" :class="{ liked: isLiked(post, userStore.currentUser?.id) }">
                ❤️
              </span>
              <span class="action-count">{{ post.likes }}</span>
            </div>
            
            <div class="action-item" @click="toggleComments(post)">
              <span class="action-icon">💬</span>
              <span class="action-count">{{ post.comments.length }}</span>
            </div>
            
            <div class="action-item" @click="sharePost(post)">
              <span class="action-icon" :class="{ 'share-success': shareFeedback[post.id]?.success }">
                {{ shareFeedback[post.id] ? (shareFeedback[post.id].success ? '✅' : '❌') : '🔗' }}
              </span>
              <span class="action-count">{{ shareFeedback[post.id] ? shareFeedback[post.id].message : '分享' }}</span>
            </div>
          </div>
          
          <!-- 评论区 -->
          <div v-if="showComments[post.id]" class="comments-section">
            <div v-if="post.comments.length === 0" class="no-comments">
              暂无评论，快来发表第一条评论吧！
            </div>
            
            <div v-else class="comments-list">
              <div v-for="comment in post.comments" :key="comment.id" class="comment-item">
                <div class="comment-header">
                  <span class="comment-author">{{ getAuthor(comment.authorId)?.name || '匿名用户' }}</span>
                  <span class="comment-time">{{ formatDate(comment.createdAt) }}</span>
                </div>
                <p class="comment-text">{{ comment.content }}</p>
              </div>
            </div>
            
            <!-- 发表评论 -->
            <div class="comment-input-section">
              <input 
                v-model="commentInputs[post.id]"
                type="text" 
                class="comment-input" 
                placeholder="发表评论..."
                @keyup.enter="submitComment(post)"
              />
              <button 
                class="btn btn-primary small-btn"
                @click="submitComment(post)"
                :disabled="!commentInputs[post.id]?.trim()"
              >
                发送
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- TabBar -->
    <TabBar />
    
    <!-- 帖子详情模态框 -->
    <div v-if="selectedPost" class="modal-overlay" @click="closePostDetail">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <span class="modal-title">帖子详情</span>
          <span class="modal-close" @click="closePostDetail">×</span>
        </div>
        
        <div class="modal-body">
          <!-- 作者信息 -->
          <div class="post-header">
            <div class="user-info-section">
              <div class="user-avatar-small">{{ getAuthor(selectedPost.authorId)?.avatar || '👤' }}</div>
              <div class="user-details-small">
                <div class="user-name-small">{{ getAuthor(selectedPost.authorId)?.name || '匿名用户' }}</div>
                <div class="user-stats-tiny">
                  <span>{{ formatDate(selectedPost.createdAt) }}</span>
                  <span class="category-tag-mini" :style="{ backgroundColor: getCategoryColor(selectedPost.category) }">
                    {{ getCategoryName(selectedPost.category) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 动态内容 -->
          <div class="post-content">
            <h3 class="post-title">{{ selectedPost.title }}</h3>
            <p class="post-text">{{ selectedPost.content }}</p>
            
            <!-- 图片网格 -->
            <div v-if="selectedPost.images && selectedPost.images.length > 0" class="post-images">
              <div 
                v-for="(image, index) in selectedPost.images.slice(0, 9)" 
                :key="index"
                class="post-image"
                :class="{ 
                  'single-image': selectedPost.images.length === 1,
                  'two-images': selectedPost.images.length === 2,
                  'three-images': selectedPost.images.length === 3
                }"
              >
                <img :src="image" :alt="`图片${index + 1}`" />
              </div>
            </div>
            
            <!-- 标签 -->
            <div v-if="selectedPost.tags && selectedPost.tags.length > 0" class="post-tags">
              <span v-for="tag in selectedPost.tags" :key="tag" class="skill-tag">
                #{{ tag }}
              </span>
            </div>
          </div>
          
          <!-- 互动栏 -->
          <div class="post-actions">
            <div class="action-item" @click="toggleLike(selectedPost)">
              <span class="action-icon" :class="{ liked: isLiked(selectedPost, userStore.currentUser?.id) }">
                ❤️
              </span>
              <span class="action-count">{{ selectedPost.likes }}</span>
            </div>
            
            <div class="action-item">
              <span class="action-icon">💬</span>
              <span class="action-count">{{ selectedPost.comments.length }} 条评论</span>
            </div>
          </div>
          
          <!-- 评论区 -->
          <div class="comments-section">
            <div v-if="selectedPost.comments.length === 0" class="no-comments">
              暂无评论，快来发表第一条评论吧！
            </div>
            
            <div v-else class="comments-list">
              <div v-for="comment in selectedPost.comments" :key="comment.id" class="comment-item">
                <div class="comment-header">
                  <span class="comment-author">{{ getAuthor(comment.authorId)?.name || '匿名用户' }}</span>
                  <span class="comment-time">{{ formatDate(comment.createdAt) }}</span>
                </div>
                <p class="comment-text">{{ comment.content }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { useCommunityStore } from '../stores/community'
import TabBar from '../components/TabBar.vue'
import { formatDate } from '../utils/helpers'

const router = useRouter()
const userStore = useUserStore()
const communityStore = useCommunityStore()

const activeCategory = ref('all')
const showComments = reactive({})
const commentInputs = reactive({})
const shareFeedback = reactive({})
const selectedPost = ref(null)

const CATEGORY_NAMES = {
  story: '互助故事',
  activity: '社区活动',
  notice: '通知公告',
  life: '生活分享'
}

const CATEGORY_COLORS = {
  story: '#e67e22',
  activity: '#27ae60',
  notice: '#e74c3c',
  life: '#3498db'
}

onMounted(() => {
  if (!userStore.checkAuth()) {
    router.push('/login')
    return
  }
  
  communityStore.initializePosts()
})

const posts = computed(() => {
  return communityStore.posts
})

const filteredPosts = computed(() => {
  if (activeCategory.value === 'all') {
    return posts.value
  }
  return posts.value.filter(post => post.category === activeCategory.value)
})

function getAuthor(authorId) {
  return userStore.getUserById(authorId)
}

function getCategoryText(category) {
  if (category === 'all') return ''
  return CATEGORY_NAMES[category] || ''
}

function getCategoryName(category) {
  return CATEGORY_NAMES[category] || '其他'
}

function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || '#4a90e2'
}

function setCategory(category) {
  activeCategory.value = category
}

function isLiked(post, userId) {
  return post.likedBy && userId && post.likedBy.includes(userId)
}

function toggleLike(post) {
  if (!userStore.currentUser) {
    router.push('/login')
    return
  }
  
  communityStore.likePost(post.id, userStore.currentUser.id)
}

function toggleComments(post) {
  showComments[post.id] = !showComments[post.id]
  if (!commentInputs[post.id]) {
    commentInputs[post.id] = ''
  }
}

function submitComment(post) {
  const content = commentInputs[post.id]?.trim()
  if (!content) return
  
  communityStore.addComment(post.id, content)
  commentInputs[post.id] = ''
}

function goBack() {
  router.back()
}

function goToCreatePost() {
  router.push('/create-post')
}

function openPostDetail(post) {
  selectedPost.value = post
}

function closePostDetail() {
  selectedPost.value = null
}

async function sharePost(post) {
  const author = getAuthor(post.authorId)
  const shareText = `${author?.name || '匿名用户'}在邻里圈分享：${post.title}`
  const shareUrl = window.location.href

  // 检查是否支持原生分享
  if (navigator.share) {
    try {
      await navigator.share({
        title: post.title,
        text: shareText,
        url: shareUrl
      })
      shareFeedback[post.id] = { success: true, message: '分享成功！' }
    } catch (error) {
      if (error.name !== 'AbortError') {
        shareFeedback[post.id] = { success: false, message: '分享取消' }
      }
    }
  } else {
    // 不支持原生分享，尝试复制链接到剪贴板
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
      shareFeedback[post.id] = { success: true, message: '链接已复制到剪贴板！' }
    } catch (error) {
      shareFeedback[post.id] = { success: false, message: '复制失败，请手动复制' }
    }
  }

  // 3秒后清除反馈
  setTimeout(() => {
    delete shareFeedback[post.id]
  }, 3000)
}
</script>

<style scoped>
.page {
  padding-bottom: 80px;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.back-btn {
  font-size: 24px;
  cursor: pointer;
  padding: 0 8px;
}

.header-title {
  font-size: 17px;
  font-weight: 600;
}

.create-btn {
  font-size: 14px;
  color: #4a90e2;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.create-btn:hover {
  background-color: rgba(74, 144, 226, 0.1);
}

.content {
  padding: 12px;
}

.category-filter {
  display: flex;
  overflow-x: auto;
  padding: 12px;
  background-color: white;
  gap: 8px;
  margin-bottom: 12px;
  border-radius: 8px;
  -webkit-overflow-scrolling: touch;
}

.filter-item {
  flex-shrink: 0;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  background-color: #f5f5f5;
  color: #666;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid #eee;
}

.filter-item:hover {
  background-color: #e8f4fd;
  color: #4a90e2;
}

.filter-item.active {
  background-color: #4a90e2;
  color: white;
  border-color: #4a90e2;
}

.posts-list {
  padding: 0;
}

.post-card {
  background-color: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.post-header {
  margin-bottom: 12px;
}

.user-info-section {
  display: flex;
  align-items: center;
}

.user-avatar-small {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #4a90e2;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 16px;
  font-weight: 600;
  margin-right: 10px;
}

.user-details-small {
  flex: 1;
}

.user-name-small {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 2px;
  color: #333;
}

.user-stats-tiny {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #999;
}

.category-tag-mini {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  color: white;
  font-weight: 500;
}

.post-content {
  margin-bottom: 12px;
}

.post-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.post-text {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 12px;
}

.post-images {
  display: grid;
  gap: 4px;
  margin-bottom: 12px;
}

.post-image {
  overflow: hidden;
  border-radius: 4px;
  background-color: #f0f0f0;
}

.post-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.single-image {
  grid-template-columns: 1fr;
  max-height: 300px;
}

.two-images {
  grid-template-columns: repeat(2, 1fr);
}

.two-images .post-image {
  aspect-ratio: 1;
}

.three-images {
  grid-template-columns: repeat(3, 1fr);
}

.three-images .post-image {
  aspect-ratio: 1;
}

.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.post-actions {
  display: flex;
  align-items: center;
  gap: 24px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.action-item:hover {
  transform: scale(1.05);
}

.action-icon {
  font-size: 18px;
}

.action-icon.liked {
  animation: likeAnimation 0.3s ease;
}

.action-icon.share-success {
  animation: shareSuccessAnimation 0.5s ease;
}

@keyframes shareSuccessAnimation {
  0% { transform: scale(1); }
  50% { transform: scale(1.4); }
  100% { transform: scale(1); }
}

@keyframes likeAnimation {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

.action-count {
  font-size: 13px;
  color: #666;
}

.comments-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.no-comments {
  font-size: 13px;
  color: #999;
  text-align: center;
  padding: 16px;
}

.comments-list {
  margin-bottom: 12px;
}

.comment-item {
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 6px;
  margin-bottom: 8px;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.comment-author {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.comment-time {
  font-size: 11px;
  color: #999;
}

.comment-text {
  font-size: 13px;
  color: #666;
  line-height: 1.5;
}

.comment-input-section {
  display: flex;
  gap: 8px;
  align-items: center;
}

.comment-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 20px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s ease;
}

.comment-input:focus {
  border-color: #4a90e2;
}

.small-btn {
  padding: 6px 16px;
  font-size: 13px;
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-content {
  background-color: white;
  border-radius: 12px;
  max-height: 90vh;
  max-width: 500px;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.modal-close {
  font-size: 24px;
  cursor: pointer;
  color: #999;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.modal-close:hover {
  background-color: #f5f5f5;
  color: #666;
}

.modal-body {
  padding: 16px;
  overflow-y: auto;
}

.modal-body .post-card {
  margin-bottom: 0;
  box-shadow: none;
  padding: 0;
}

.modal-body .post-header {
  margin-bottom: 16px;
}

.modal-body .post-content {
  margin-bottom: 16px;
}

.modal-body .post-actions {
  margin-bottom: 16px;
}

.modal-body .comments-section {
  border-top: 1px solid #f0f0f0;
  padding-top: 12px;
}
</style>
