<template>
  <div class="page">
    <div class="page-header">
      <div class="header-content">
        <span class="back-btn" @click="goBack">‹</span>
        <span class="header-title">我的任务</span>
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
      
      <!-- 任务列表 -->
      <div class="tasks-list">
        <div v-if="filteredTasks.length === 0" class="empty-state">
          <div class="empty-state-icon">📋</div>
          <p>暂无{{ getStatusText(activeStatus) }}任务</p>
          <button class="btn btn-primary" @click="goToHelpRequests">去看看其他求助</button>
        </div>
        
        <div 
          v-for="task in filteredTasks" 
          :key="task.id" 
          class="task-card"
          @click="goToDetail(task.id)"
        >
          <div class="task-header">
            <div class="task-left">
              <span 
                class="category-tag" 
                :style="{ backgroundColor: getCategoryColor(task.category), color: 'white' }"
              >
                {{ getCategoryName(task.category) }}
              </span>
              <span 
                v-if="task.category === 'emergency'" 
                class="urgent-tag"
              >
                紧急
              </span>
            </div>
            <div class="task-right">
              <span 
                class="status-tag" 
                :style="{ backgroundColor: STATUS_COLORS[task.status] }"
              >
                {{ STATUS_LABELS[task.status] }}
              </span>
            </div>
          </div>
          
          <h3 class="task-title">{{ task.title }}</h3>
          <p class="task-desc">{{ task.description.substring(0, 50) }}...</p>
          
          <!-- 发布者信息 -->
          <div class="requester-info" v-if="getRequester(task.requesterId)">
            <div class="user-info-section">
              <div class="user-avatar-small">{{ getRequester(task.requesterId)?.avatar }}</div>
              <div class="user-details-small">
                <div class="user-name-small">{{ getRequester(task.requesterId)?.name }}</div>
                <div class="user-stats-tiny">
                  <span>📍 {{ task.location }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="task-footer">
            <div class="task-info">
              <span class="task-time">{{ formatDate(task.createdAt) }}</span>
            </div>
            <div class="task-reward">
              💰 {{ task.reward }}
            </div>
          </div>
          
          <!-- 操作按钮 -->
          <div class="task-actions" v-if="task.status === 'matched' || task.status === 'in_progress'">
            <button 
              v-if="task.status === 'matched'"
              class="btn btn-primary small-btn" 
              @click.stop="startTask(task.id)"
            >
              开始帮助
            </button>
            
            <!-- 评价区域 -->
            <div v-if="task.status === 'in_progress' && !hasRated(task)" class="rating-section">
              <p class="rating-label">评价求助者：</p>
              <div class="rating-stars">
                <span 
                  v-for="star in 5" 
                  :key="star" 
                  class="star" 
                  :class="{ filled: star <= getRating(task) }"
                  @click.stop="setRating(task, star)"
                >
                  ★
                </span>
              </div>
              <button 
                class="btn btn-primary small-btn" 
                @click.stop="submitRating(task)"
                :disabled="getRating(task) === 0"
              >
                提交评价
              </button>
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
import { useHelpRequestsStore } from '../stores/helpRequests'
import { CATEGORIES, STATUS_LABELS, STATUS_COLORS, formatDate } from '../utils/helpers'

const router = useRouter()
const userStore = useUserStore()
const helpRequestsStore = useHelpRequestsStore()

const activeStatus = ref('all')
const ratings = reactive({})

onMounted(() => {
  if (!userStore.checkAuth()) {
    router.push('/login')
    return
  }
  
  helpRequestsStore.initializeHelpRequests()
})

const myTasks = computed(() => {
  if (!userStore.currentUser) return []
  return helpRequestsStore.getHelpRequestsByHelper(userStore.currentUser.id)
})

const filteredTasks = computed(() => {
  if (activeStatus.value === 'all') {
    return myTasks.value
  }
  return myTasks.value.filter(task => task.status === activeStatus.value)
})

function getRequester(requesterId) {
  return userStore.getUserById(requesterId)
}

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

function hasRated(task) {
  return task.rating && task.rating.helperToRequester
}

function getRating(task) {
  return ratings[task.id] || 0
}

function setRating(task, star) {
  ratings[task.id] = star
}

function goBack() {
  router.back()
}

function goToDetail(id) {
  router.push(`/help-requests/${id}`)
}

function goToHelpRequests() {
  router.push('/help-requests')
}

function startTask(id) {
  helpRequestsStore.startHelpRequest(id)
}

function submitRating(task) {
  const rating = getRating(task)
  if (rating === 0) return
  
  helpRequestsStore.completeHelpRequest(
    task.id,
    rating,
    userStore.currentUser.id,
    task.requesterId
  )
  
  // 清除评分
  delete ratings[task.id]
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

.tasks-list {
  padding: 0;
}

.task-card {
  background-color: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.task-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.task-left {
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

.task-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.task-desc {
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
  line-height: 1.5;
}

.requester-info {
  margin-bottom: 12px;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 6px;
}

.user-info-section {
  display: flex;
  align-items: center;
}

.user-avatar-small {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: #4a90e2;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
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
  font-size: 12px;
  color: #666;
}

.task-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.task-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #999;
}

.task-reward {
  font-size: 13px;
  color: #e67e22;
  font-weight: 500;
}

.task-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.small-btn {
  padding: 6px 16px;
  font-size: 13px;
  align-self: flex-start;
}

.rating-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rating-label {
  font-size: 13px;
  color: #333;
}

.rating-stars {
  display: flex;
  gap: 4px;
}

.star {
  font-size: 22px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.star:hover {
  transform: scale(1.1);
}
</style>
