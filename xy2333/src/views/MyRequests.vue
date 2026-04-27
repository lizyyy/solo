<template>
  <div class="page">
    <div class="page-header">
      <div class="header-content">
        <span class="back-btn" @click="goBack">‹</span>
        <span class="header-title">我的求助</span>
        <span></span>
      </div>
    </div>
    
    <div class="content">
      <!-- 状态筛选 -->
      <div class="status-filter">
        <div 
          class="filter-item" 
          :class="{ active: activeStatus === 'all' }"
          @click="setStatus('all')"
        >
          全部
        </div>
        <div 
          class="filter-item" 
          :class="{ active: activeStatus === 'pending' }"
          @click="setStatus('pending')"
        >
          等待接单
        </div>
        <div 
          class="filter-item" 
          :class="{ active: activeStatus === 'matched' }"
          @click="setStatus('matched')"
        >
          已匹配
        </div>
        <div 
          class="filter-item" 
          :class="{ active: activeStatus === 'in_progress' }"
          @click="setStatus('in_progress')"
        >
          进行中
        </div>
        <div 
          class="filter-item" 
          :class="{ active: activeStatus === 'completed' }"
          @click="setStatus('completed')"
        >
          已完成
        </div>
      </div>
      
      <!-- 求助列表 -->
      <div class="requests-list">
        <div v-if="filteredRequests.length === 0" class="empty-state">
          <div class="empty-state-icon">📭</div>
          <p>暂无{{ getStatusText(activeStatus) }}求助</p>
          <button class="btn btn-primary" @click="goToCreate">发布新求助</button>
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
          <p class="request-desc">{{ request.description.substring(0, 50) }}...</p>
          
          <div class="request-footer">
            <div class="request-info">
              <span class="request-location">📍 {{ request.location }}</span>
              <span class="request-time">{{ formatDate(request.createdAt) }}</span>
            </div>
            <div class="request-reward">
              💰 {{ request.reward }}
            </div>
          </div>
          
          <!-- 操作按钮 -->
          <div class="request-actions" v-if="request.status === 'pending'">
            <button 
              class="btn btn-danger small-btn" 
              @click.stop="cancelRequest(request.id)"
            >
              取消求助
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { useHelpRequestsStore } from '../stores/helpRequests'
import { CATEGORIES, STATUS_LABELS, STATUS_COLORS, formatDate, STATUS_OPTIONS } from '../utils/helpers'

const router = useRouter()
const userStore = useUserStore()
const helpRequestsStore = useHelpRequestsStore()

const activeStatus = ref('all')

onMounted(() => {
  if (!userStore.checkAuth()) {
    router.push('/login')
    return
  }
  
  helpRequestsStore.initializeHelpRequests()
})

const myRequests = computed(() => {
  if (!userStore.currentUser) return []
  return helpRequestsStore.getHelpRequestsByRequester(userStore.currentUser.id)
})

const filteredRequests = computed(() => {
  if (activeStatus.value === 'all') {
    return myRequests.value
  }
  return myRequests.value.filter(req => req.status === activeStatus.value)
})

function getStatusText(status) {
  if (status === 'all') return ''
  return STATUS_LABELS[status] || ''
}

function setStatus(status) {
  activeStatus.value = status
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

function goBack() {
  router.back()
}

function goToDetail(id) {
  router.push(`/help-requests/${id}`)
}

function goToCreate() {
  router.push('/create-request')
}

function cancelRequest(id) {
  if (confirm('确定要取消这个求助吗？')) {
    helpRequestsStore.cancelHelpRequest(id, userStore.currentUser.id)
  }
}
</script>

<style scoped>
.page {
  padding-bottom: 20px;
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

.status-filter {
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

.requests-list {
  padding: 0;
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
  margin-bottom: 12px;
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

.request-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.small-btn {
  padding: 6px 16px;
  font-size: 13px;
}
</style>
