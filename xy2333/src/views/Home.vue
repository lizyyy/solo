<template>
  <div class="page">
    <div class="page-header">
      邻里互助帮
    </div>
    
    <div class="content">
      <!-- 紧急求助入口 -->
      <div v-if="urgentRequests.length > 0" class="urgent-section">
        <div class="section-header">
          <span class="section-icon">🚨</span>
          <span class="section-title">紧急求助</span>
          <span class="urgent-count">{{ urgentRequests.length }}个求助</span>
        </div>
        <div class="urgent-cards">
          <div 
            v-for="request in urgentRequests.slice(0, 2)" 
            :key="request.id" 
            class="urgent-card"
            @click="goToRequestDetail(request.id)"
          >
            <div class="urgent-card-header">
              <span class="urgent-tag">紧急</span>
              <span class="urgent-time">{{ formatDate(request.createdAt) }}</span>
            </div>
            <h3 class="urgent-card-title">{{ request.title }}</h3>
            <p class="urgent-card-location">📍 {{ request.location }}</p>
          </div>
        </div>
      </div>
      
      <!-- 分类入口 -->
      <div class="category-section">
        <div class="section-header">
          <span class="section-icon">📋</span>
          <span class="section-title">互助分类</span>
        </div>
        <div class="category-grid">
          <div 
            class="category-item" 
            v-for="(category, key) in CATEGORIES" 
            :key="key"
            @click="goToCategory(category.id)"
            :style="{ borderColor: category.color }"
          >
            <span class="category-icon">{{ category.icon }}</span>
            <span class="category-name">{{ category.name }}</span>
          </div>
        </div>
      </div>
      
      <!-- 热门邻居 -->
      <div class="top-users-section">
        <div class="section-header">
          <span class="section-icon">⭐</span>
          <span class="section-title">热心邻居</span>
        </div>
        <div class="user-cards">
          <div 
            v-for="user in topUsers.slice(0, 3)" 
            :key="user.id" 
            class="user-card"
            @click="goToMatch"
          >
            <div class="user-avatar">{{ user.avatar }}</div>
            <div class="user-info">
              <h4 class="user-name">{{ user.name }}</h4>
              <div class="user-tags">
                <span v-for="tag in user.tags.slice(0, 2)" :key="tag" class="skill-tag">
                  {{ tag }}
                </span>
              </div>
              <div class="user-stats">
                <span class="user-stat">⭐ {{ user.rating }}</span>
                <span class="user-stat">✅ {{ user.completedTasks }}次帮助</span>
                <span class="credit-score">
                  <span class="credit-score-icon">🌟</span>
                  {{ user.creditScore }}分
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 最新求助 -->
      <div class="latest-requests-section">
        <div class="section-header">
          <span class="section-icon">📝</span>
          <span class="section-title">最新求助</span>
          <span class="view-all" @click="goToHelpRequests">查看全部 →</span>
        </div>
        <div class="request-cards">
          <div 
            v-for="request in latestRequests.slice(0, 3)" 
            :key="request.id" 
            class="request-card"
            @click="goToRequestDetail(request.id)"
          >
            <div class="request-card-header">
              <span 
                class="category-tag" 
                :style="{ backgroundColor: getCategoryColor(request.category), color: 'white' }"
              >
                {{ getCategoryName(request.category) }}
              </span>
              <span class="request-time">{{ formatDate(request.createdAt) }}</span>
            </div>
            <h3 class="request-card-title">{{ request.title }}</h3>
            <p class="request-card-desc">{{ request.description.substring(0, 50) }}...</p>
            <div class="request-card-footer">
              <span class="request-reward">💰 {{ request.reward }}</span>
              <span class="request-location">📍 {{ request.location }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <TabBar />
  </div>
</template>

<script setup>
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { useHelpRequestsStore } from '../stores/helpRequests'
import TabBar from '../components/TabBar.vue'
import { CATEGORIES, formatDate } from '../utils/helpers'

const router = useRouter()
const userStore = useUserStore()
const helpRequestsStore = useHelpRequestsStore()

onMounted(() => {
  userStore.checkAuth()
  helpRequestsStore.initializeHelpRequests()
})

const urgentRequests = computed(() => helpRequestsStore.urgentRequests)
const latestRequests = computed(() => helpRequestsStore.pendingRequests)
const topUsers = computed(() => userStore.getTopRatedUsers(5))

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

function goToCategory(categoryId) {
  router.push(`/help-requests?category=${categoryId}`)
}

function goToHelpRequests() {
  router.push('/help-requests')
}

function goToRequestDetail(id) {
  router.push(`/help-requests/${id}`)
}

function goToMatch() {
  router.push('/match')
}
</script>

<style scoped>
.content {
  padding-bottom: 80px;
}

.section-header {
  display: flex;
  align-items: center;
  padding: 16px 16px 8px;
  font-weight: 600;
}

.section-icon {
  margin-right: 8px;
}

.section-title {
  flex: 1;
  font-size: 16px;
}

.urgent-section {
  background-color: #fff5f5;
  padding-bottom: 8px;
}

.urgent-count {
  font-size: 12px;
  color: #e74c3c;
  font-weight: normal;
}

.urgent-cards {
  padding: 0 12px;
}

.urgent-card {
  background-color: white;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  border-left: 3px solid #e74c3c;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.urgent-card:hover {
  transform: translateY(-2px);
}

.urgent-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.urgent-time {
  font-size: 12px;
  color: #999;
}

.urgent-card-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.urgent-card-location {
  font-size: 12px;
  color: #666;
}

.category-section {
  background-color: white;
  margin: 12px;
  border-radius: 8px;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 0 12px 16px;
}

.category-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  background-color: #f8f9fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.category-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.category-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.category-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.top-users-section {
  background-color: white;
  margin: 12px;
  border-radius: 8px;
}

.user-cards {
  padding: 0 12px 12px;
}

.user-card {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.user-card:last-child {
  border-bottom: none;
}

.user-card:hover {
  background-color: #f8f9fa;
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
  font-weight: 600;
  margin-right: 12px;
}

.user-info {
  flex: 1;
}

.user-name {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
}

.user-tags {
  margin-bottom: 6px;
}

.user-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #666;
}

.user-stat {
  display: flex;
  align-items: center;
}

.latest-requests-section {
  background-color: white;
  margin: 12px;
  border-radius: 8px;
}

.view-all {
  font-size: 14px;
  color: #4a90e2;
  font-weight: normal;
  cursor: pointer;
}

.request-cards {
  padding: 0 12px 12px;
}

.request-card {
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.request-card:last-child {
  border-bottom: none;
}

.request-card:hover {
  background-color: #f8f9fa;
}

.request-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.request-time {
  font-size: 12px;
  color: #999;
}

.request-card-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.request-card-desc {
  font-size: 13px;
  color: #666;
  margin-bottom: 8px;
  line-height: 1.5;
}

.request-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #666;
}

.request-reward {
  color: #e67e22;
  font-weight: 500;
}
</style>
