<template>
  <div class="page">
    <div class="page-header">
      <div class="header-content">
        <span v-if="filterUserId" class="back-btn" @click="clearFilter">‹</span>
        <span></span>
        <span></span>
      </div>
      <div class="header-title-section">
        <span class="page-title">{{ filterUserId ? `${filterUserName}的求助` : '互助广场' }}</span>
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
          v-for="(category, key) in CATEGORIES" 
          :key="key"
          class="filter-item" 
          :class="{ active: activeCategory === category.id }"
          @click="setCategory(category.id)"
        >
          {{ category.icon }} {{ category.name }}
        </div>
      </div>
      
      <!-- 求助列表 -->
      <div class="requests-list">
        <div v-if="filteredRequests.length === 0" class="empty-state">
          <div class="empty-state-icon">📭</div>
          <p>暂无求助信息</p>
        </div>
        
        <div 
          v-for="request in filteredRequests" 
          :key="request.id" 
          class="request-card"
          @click="goToDetail(request.id)"
        >
          <div class="request-header">
            <div class="request-left">
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
            <div class="request-right">
              <span 
                class="status-tag" 
                :style="{ backgroundColor: STATUS_COLORS[request.status] }"
              >
                {{ STATUS_LABELS[request.status] }}
              </span>
            </div>
          </div>
          
          <h3 class="request-title">{{ request.title }}</h3>
          <p class="request-desc">{{ request.description.substring(0, 60) }}...</p>
          
          <div class="request-footer">
            <div class="request-info">
              <span class="request-location">📍 {{ request.location }}</span>
              <span class="request-time">{{ formatDate(request.createdAt) }}</span>
            </div>
            <div class="request-reward">
              💰 {{ request.reward }}
            </div>
          </div>
          
          <div class="request-tags" v-if="request.tags && request.tags.length > 0">
            <span v-for="tag in request.tags.slice(0, 3)" :key="tag" class="skill-tag">
              {{ tag }}
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 发布求助按钮 -->
    <button class="fab" @click="goToCreate">
      +
    </button>
    
    <TabBar />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useHelpRequestsStore } from '../stores/helpRequests'
import { useUserStore } from '../stores/user'
import TabBar from '../components/TabBar.vue'
import { CATEGORIES, STATUS_LABELS, STATUS_COLORS, formatDate } from '../utils/helpers'

const router = useRouter()
const route = useRoute()
const helpRequestsStore = useHelpRequestsStore()

const activeCategory = ref('all')
const filterUserId = ref(null)
const filterUserName = ref('')

onMounted(() => {
  helpRequestsStore.initializeHelpRequests()
  
  // 从URL参数获取分类
  const category = route.query.category
  if (category) {
    activeCategory.value = category
  }
  
  // 从URL参数获取用户ID
  const userId = route.query.userId
  if (userId) {
    filterUserId.value = userId
    // 尝试获取用户名称
    const userStore = useUserStore()
    userStore.initializeUsers()
    const user = userStore.getUserById(userId)
    if (user) {
      filterUserName.value = user.name
    }
  }
})

const filteredRequests = computed(() => {
  let allRequests = helpRequestsStore.helpRequests
  
  // 按用户筛选
  if (filterUserId.value) {
    allRequests = allRequests.filter(req => req.requesterId === filterUserId.value)
  }
  
  // 按分类筛选
  if (activeCategory.value !== 'all') {
    allRequests = allRequests.filter(req => req.category === activeCategory.value)
  }
  
  return allRequests
})

function setCategory(category) {
  activeCategory.value = category
}

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

function goToDetail(id) {
  router.push(`/help-requests/${id}`)
}

function clearFilter() {
  filterUserId.value = null
  filterUserName.value = ''
  router.push('/help-requests')
}

function goToCreate() {
  router.push('/create-request')
}
</script>

<style scoped>
.content {
  padding-bottom: 100px;
}

.category-filter {
  display: flex;
  overflow-x: auto;
  padding: 12px;
  background-color: white;
  gap: 8px;
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

.requests-list {
  padding: 12px;
}

.request-card {
  background-color: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.request-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.request-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.request-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: white;
  font-weight: 500;
}

.request-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.request-desc {
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
  line-height: 1.5;
}

.request-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.request-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #999;
}

.request-reward {
  font-size: 13px;
  color: #e67e22;
  font-weight: 500;
}

.request-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
