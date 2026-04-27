<template>
  <div class="page">
    <div class="page-header">
      <div class="header-content">
        <span class="back-btn" @click="goBack">‹</span>
        <span class="header-title">求助详情</span>
        <span></span>
      </div>
    </div>
    
    <div class="content" v-if="request">
      <!-- 状态标签 -->
      <div class="status-banner" :style="{ backgroundColor: STATUS_COLORS[request.status] }">
        {{ STATUS_LABELS[request.status] }}
      </div>
      
      <!-- 求助信息 -->
      <div class="card">
        <div class="request-title-section">
          <h1 class="request-title">{{ request.title }}</h1>
          <div class="request-categories">
            <span 
              class="category-tag" 
              :style="{ backgroundColor: getCategoryColor(request.category), color: 'white' }"
            >
              {{ getCategoryName(request.category) }}
            </span>
            <span 
              v-if="request.category === 'emergency'" 
              class="urgent-tag"
            >
              紧急
            </span>
          </div>
        </div>
        
        <div class="request-info-row">
          <div class="info-item">
            <span class="info-label">📍 位置</span>
            <span class="info-value">{{ request.location }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">⏰ 期望时间</span>
            <span class="info-value">{{ request.estimatedTime }}</span>
          </div>
        </div>
        
        <div class="request-info-row">
          <div class="info-item">
            <span class="info-label">💰 感谢</span>
            <span class="info-value reward-value">{{ request.reward }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">📅 发布时间</span>
            <span class="info-value">{{ formatDate(request.createdAt) }}</span>
          </div>
        </div>
        
        <div class="request-description">
          <h3 class="section-subtitle">详细描述</h3>
          <p class="description-text">{{ request.description }}</p>
        </div>
        
        <div class="request-tags-section" v-if="request.tags && request.tags.length > 0">
          <h3 class="section-subtitle">相关标签</h3>
          <div class="tags-container">
            <span v-for="tag in request.tags" :key="tag" class="skill-tag">
              {{ tag }}
            </span>
          </div>
        </div>
      </div>
      
      <!-- 发布者信息 -->
      <div class="card" v-if="requester">
        <h3 class="section-subtitle">发布者</h3>
        <div class="user-info-section">
          <div class="user-avatar">{{ requester.avatar }}</div>
          <div class="user-details">
            <div class="user-name">{{ requester.name }}</div>
            <div class="user-stats-small">
              <span>⭐ {{ requester.rating || 0 }}分</span>
              <span>🌟 信用{{ requester.creditScore }}分</span>
              <span>✅ 帮助{{ requester.completedTasks }}次</span>
            </div>
            <div class="user-skills" v-if="requester.skills && requester.skills.length > 0">
              <span v-for="skill in requester.skills.slice(0, 3)" :key="skill" class="skill-tag">
                {{ skill }}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 接受者信息 -->
      <div class="card" v-if="helper">
        <h3 class="section-subtitle">接受帮助者</h3>
        <div class="user-info-section">
          <div class="user-avatar">{{ helper.avatar }}</div>
          <div class="user-details">
            <div class="user-name">{{ helper.name }}</div>
            <div class="user-stats-small">
              <span>⭐ {{ helper.rating || 0 }}分</span>
              <span>🌟 信用{{ helper.creditScore }}分</span>
              <span>✅ 帮助{{ helper.completedTasks }}次</span>
            </div>
            <div class="user-skills" v-if="helper.skills && helper.skills.length > 0">
              <span v-for="skill in helper.skills.slice(0, 3)" :key="skill" class="skill-tag">
                {{ skill }}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 智能匹配推荐 -->
      <div class="card" v-if="showMatches && matchedUsers.length > 0">
        <h3 class="section-subtitle">🤖 智能匹配推荐</h3>
        <p class="match-desc">根据技能、信用、评价为您推荐最适合的邻居，点击"选择TA"即可匹配</p>
        <div class="matched-users">
          <div 
            v-for="(match, index) in matchedUsers" 
            :key="match.user.id" 
            class="matched-user"
          >
            <div class="match-rank">#{{ index + 1 }}</div>
            <div class="user-avatar-small">{{ match.user.avatar }}</div>
            <div class="match-info">
              <div class="match-name">{{ match.user.name }}</div>
              <div class="match-score">匹配度: {{ match.matchScore }}分</div>
              <div class="match-tags">
                <span v-for="skill in match.user.skills.slice(0, 2)" :key="skill" class="skill-tag">
                  {{ skill }}
                </span>
              </div>
            </div>
            <div class="match-stats">
              <span>⭐ {{ match.user.rating || 0 }}</span>
              <span>🌟 {{ match.user.creditScore }}</span>
            </div>
            <div class="match-action">
              <button 
                class="btn btn-primary small-btn"
                @click="selectHelper(match.user.id)"
              >
                选择TA
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 评价区域 -->
      <div class="card" v-if="showRating">
        <h3 class="section-subtitle">请评价这次互助</h3>
        <div class="rating-section">
          <div class="rating-item" v-if="isRequester && !hasRequesterRated">
            <p class="rating-label">您对帮助者的评价：</p>
            <div class="rating-stars">
              <span 
                v-for="star in 5" 
                :key="star" 
                class="star" 
                :class="{ filled: star <= helperRating }"
                @click="setHelperRating(star)"
              >
                ★
              </span>
            </div>
            <button 
              class="btn btn-primary" 
              @click="submitHelperRating"
              :disabled="helperRating === 0"
            >
              提交评价
            </button>
          </div>
          
          <div class="rating-item" v-if="isHelper && !hasHelperRated">
            <p class="rating-label">您对求助者的评价：</p>
            <div class="rating-stars">
              <span 
                v-for="star in 5" 
                :key="star" 
                class="star" 
                :class="{ filled: star <= requesterRating }"
                @click="setRequesterRating(star)"
              >
                ★
              </span>
            </div>
            <button 
              class="btn btn-primary" 
              @click="submitRequesterRating"
              :disabled="requesterRating === 0"
            >
              提交评价
            </button>
          </div>
        </div>
      </div>
      
      <!-- 已完成评价显示 -->
      <div class="card" v-if="showCompletedRating">
        <h3 class="section-subtitle">✅ 互助评价</h3>
        <div class="completed-ratings">
          <div class="completed-rating-item" v-if="hasRequesterRated">
            <div class="rating-header">
              <span class="rating-role">求助者 → 帮助者</span>
              <div class="rating-stars-display">
                <span 
                  v-for="star in 5" 
                  :key="star" 
                  class="star-display"
                  :class="{ filled: star <= request.rating.requesterToHelper }"
                >
                  ★
                </span>
                <span class="rating-score">{{ request.rating.requesterToHelper }}分</span>
              </div>
            </div>
            <p class="rating-note">评价时间：{{ formatDate(request.updatedAt) }}</p>
          </div>
          
          <div class="completed-rating-item" v-if="hasHelperRated">
            <div class="rating-header">
              <span class="rating-role">帮助者 → 求助者</span>
              <div class="rating-stars-display">
                <span 
                  v-for="star in 5" 
                  :key="star" 
                  class="star-display"
                  :class="{ filled: star <= request.rating.helperToRequester }"
                >
                  ★
                </span>
                <span class="rating-score">{{ request.rating.helperToRequester }}分</span>
              </div>
            </div>
            <p class="rating-note">评价时间：{{ formatDate(request.updatedAt) }}</p>
          </div>
          
          <div class="rating-summary" v-if="hasRequesterRated && hasHelperRated">
            <p class="summary-text">🎉 双方已完成互评，互助圆满结束！</p>
          </div>
        </div>
      </div>
      
      <!-- 操作按钮 -->
      <div class="action-buttons" v-if="userStore.isLoggedIn">
        <button 
          v-if="canAccept" 
          class="btn btn-primary full-width" 
          @click="acceptRequest"
        >
          接受求助
        </button>
        
        <button 
          v-if="canStart" 
          class="btn btn-primary full-width" 
          @click="startRequest"
        >
          开始帮助
        </button>
        
        <button 
          v-if="canCancel" 
          class="btn btn-danger full-width" 
          @click="cancelRequest"
        >
          取消求助
        </button>
        
        <div v-if="showMatched" class="matched-info">
          <p>已匹配到：{{ helper?.name }}</p>
        </div>
      </div>
      
      <div v-else class="login-prompt">
        <p>请先登录查看详细操作</p>
        <button class="btn btn-primary" @click="goToLogin">立即登录</button>
      </div>
    </div>
    
    <div v-else class="loading">
      <div class="loading-spinner"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useHelpRequestsStore } from '../stores/helpRequests'
import { useUserStore } from '../stores/user'
import { CATEGORIES, STATUS_LABELS, STATUS_COLORS, formatDate, STATUS_OPTIONS } from '../utils/helpers'

const router = useRouter()
const route = useRoute()
const helpRequestsStore = useHelpRequestsStore()
const userStore = useUserStore()

const request = ref(null)
const helperRating = ref(0)
const requesterRating = ref(0)

onMounted(() => {
  userStore.checkAuth()
  const requestId = route.params.id
  if (requestId) {
    helpRequestsStore.initializeHelpRequests()
    request.value = helpRequestsStore.getHelpRequestById(requestId)
  }
})

const requester = computed(() => {
  if (!request.value) return null
  return userStore.getUserById(request.value.requesterId)
})

const helper = computed(() => {
  if (!request.value || !request.value.helperId) return null
  return userStore.getUserById(request.value.helperId)
})

const canAccept = computed(() => {
  if (!userStore.isLoggedIn || !request.value) return false
  if (request.value.status !== STATUS_OPTIONS.PENDING) return false
  if (userStore.currentUser.id === request.value.requesterId) return false
  return true
})

const canStart = computed(() => {
  if (!userStore.isLoggedIn || !request.value) return false
  if (request.value.status !== STATUS_OPTIONS.MATCHED) return false
  if (userStore.currentUser.id !== request.value.helperId) return false
  return true
})

const canCancel = computed(() => {
  if (!userStore.isLoggedIn || !request.value) return false
  if (request.value.status === STATUS_OPTIONS.COMPLETED || 
      request.value.status === STATUS_OPTIONS.CANCELLED) return false
  if (userStore.currentUser.id !== request.value.requesterId) return false
  return true
})

const showRating = computed(() => {
  if (!userStore.isLoggedIn || !request.value) return false
  if (request.value.status !== STATUS_OPTIONS.IN_PROGRESS && 
      request.value.status !== STATUS_OPTIONS.MATCHED) return false
  return true
})

const isRequester = computed(() => {
  if (!userStore.isLoggedIn || !request.value) return false
  return userStore.currentUser.id === request.value.requesterId
})

const isHelper = computed(() => {
  if (!userStore.isLoggedIn || !request.value) return false
  return userStore.currentUser.id === request.value.helperId
})

const hasRequesterRated = computed(() => {
  if (!request.value || !request.value.rating) return false
  return !!request.value.rating.requesterToHelper
})

const hasHelperRated = computed(() => {
  if (!request.value || !request.value.rating) return false
  return !!request.value.rating.helperToRequester
})

const showMatches = computed(() => {
  if (!userStore.isLoggedIn || !request.value) return false
  if (request.value.status !== STATUS_OPTIONS.PENDING) return false
  if (userStore.currentUser.id !== request.value.requesterId) return false
  return true
})

const matchedUsers = computed(() => {
  if (!request.value) return []
  return helpRequestsStore.getMatchesForRequest(request.value.id)
})

const showMatched = computed(() => {
  if (!request.value) return false
  return request.value.status === STATUS_OPTIONS.MATCHED
})

const showCompletedRating = computed(() => {
  if (!userStore.isLoggedIn || !request.value) return false
  if (request.value.status !== STATUS_OPTIONS.COMPLETED) return false
  return hasRequesterRated.value || hasHelperRated.value
})

function getCategoryColor(categoryId) {
  for (const key in CATEGORIES) {
    if (CATEGORIES[key].id === categoryId) {
      return CATEGORIES[key].color
    }
  }
  return '#4a90e2'
}

function getCategoryName(categoryId) {
  for (const key in CATEGORIES) {
    if (CATEGORIES[key].id === categoryId) {
      return CATEGORIES[key].name
    }
  }
  return '其他'
}

function goBack() {
  router.back()
}

function goToLogin() {
  router.push('/login')
}

function acceptRequest() {
  if (!request.value) return
  
  const result = helpRequestsStore.acceptHelpRequest(
    request.value.id,
    userStore.currentUser.id
  )
  
  if (result.success) {
    // 重新获取请求数据
    request.value = helpRequestsStore.getHelpRequestById(request.value.id)
  }
}

function selectHelper(helperId) {
  if (!request.value) return
  
  if (confirm('确定要选择这位邻居来帮助您吗？')) {
    const result = helpRequestsStore.acceptHelpRequest(
      request.value.id,
      helperId
    )
    
    if (result.success) {
      // 重新获取请求数据
      request.value = helpRequestsStore.getHelpRequestById(request.value.id)
      alert('匹配成功！已通知这位邻居')
    } else {
      alert(result.message || '匹配失败，请稍后重试')
    }
  }
}

function startRequest() {
  if (!request.value) return
  
  const result = helpRequestsStore.startHelpRequest(request.value.id)
  
  if (result.success) {
    request.value = helpRequestsStore.getHelpRequestById(request.value.id)
  }
}

function cancelRequest() {
  if (!request.value) return
  
  if (confirm('确定要取消这个求助吗？')) {
    const result = helpRequestsStore.cancelHelpRequest(
      request.value.id,
      userStore.currentUser.id
    )
    
    if (result.success) {
      request.value = helpRequestsStore.getHelpRequestById(request.value.id)
    }
  }
}

function setHelperRating(star) {
  helperRating.value = star
}

function setRequesterRating(star) {
  requesterRating.value = star
}

function submitHelperRating() {
  if (!request.value || helperRating.value === 0) return
  
  const result = helpRequestsStore.completeHelpRequest(
    request.value.id,
    helperRating.value,
    userStore.currentUser.id,
    request.value.helperId
  )
  
  if (result.success) {
    request.value = helpRequestsStore.getHelpRequestById(request.value.id)
    helperRating.value = 0
  }
}

function submitRequesterRating() {
  if (!request.value || requesterRating.value === 0) return
  
  const result = helpRequestsStore.completeHelpRequest(
    request.value.id,
    requesterRating.value,
    userStore.currentUser.id,
    request.value.requesterId
  )
  
  if (result.success) {
    request.value = helpRequestsStore.getHelpRequestById(request.value.id)
    requesterRating.value = 0
  }
}
</script>

<style scoped>
.page {
  padding-bottom: 100px;
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

.content {
  padding: 12px;
}

.status-banner {
  padding: 12px;
  text-align: center;
  color: white;
  font-weight: 600;
  border-radius: 8px;
  margin-bottom: 12px;
}

.request-title-section {
  margin-bottom: 16px;
}

.request-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #333;
}

.request-categories {
  display: flex;
  gap: 8px;
  align-items: center;
}

.request-info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.request-info-row:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.info-item {
  display: flex;
  flex-direction: column;
}

.info-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}

.info-value {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.reward-value {
  color: #e67e22;
  font-weight: 600;
}

.section-subtitle {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #333;
}

.request-description {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.description-text {
  font-size: 14px;
  color: #666;
  line-height: 1.8;
  white-space: pre-wrap;
}

.request-tags-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.user-info-section {
  display: flex;
  align-items: center;
}

.user-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background-color: #4a90e2;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  font-weight: 700;
  margin-right: 12px;
}

.user-details {
  flex: 1;
}

.user-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 6px;
  color: #333;
}

.user-stats-small {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #666;
  margin-bottom: 6px;
}

.user-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.match-desc {
  font-size: 13px;
  color: #666;
  margin-bottom: 12px;
}

.matched-users {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.matched-user {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e8f4fd;
}

.match-rank {
  font-size: 14px;
  font-weight: 700;
  color: #4a90e2;
  margin-right: 12px;
  width: 24px;
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
  margin-right: 12px;
}

.match-info {
  flex: 1;
}

.match-name {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #333;
}

.match-score {
  font-size: 12px;
  color: #4a90e2;
  margin-bottom: 4px;
}

.match-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.match-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #666;
}

.match-action {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e0e0e0;
}

.small-btn {
  padding: 6px 16px;
  font-size: 13px;
}

.rating-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rating-item {
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.rating-label {
  font-size: 14px;
  margin-bottom: 8px;
  color: #333;
}

.rating-stars {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.star {
  font-size: 28px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.star:hover {
  transform: scale(1.1);
}

.action-buttons {
  padding: 12px;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: white;
  border-top: 1px solid #eee;
  z-index: 100;
}

.full-width {
  width: 100%;
  padding: 14px;
  font-size: 16px;
}

.login-prompt {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

.login-prompt p {
  margin-bottom: 16px;
}

.matched-info {
  text-align: center;
  padding: 12px;
  background-color: #e8f4fd;
  border-radius: 8px;
  margin-top: 12px;
}

.matched-info p {
  font-size: 14px;
  color: #4a90e2;
}

.completed-ratings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.completed-rating-item {
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border-left: 3px solid #27ae60;
}

.rating-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.rating-role {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.rating-stars-display {
  display: flex;
  align-items: center;
  gap: 4px;
}

.star-display {
  font-size: 18px;
  color: #ddd;
}

.star-display.filled {
  color: #ffc107;
}

.rating-score {
  font-size: 13px;
  font-weight: 600;
  color: #ff9800;
  margin-left: 8px;
}

.rating-note {
  font-size: 12px;
  color: #999;
  margin: 0;
}

.rating-summary {
  text-align: center;
  padding: 12px;
  background-color: #e8f5e9;
  border-radius: 8px;
}

.summary-text {
  font-size: 14px;
  color: #27ae60;
  font-weight: 500;
  margin: 0;
}
</style>
