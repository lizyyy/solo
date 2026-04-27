<template>
  <div class="page">
    <div class="page-header">
      我的
    </div>
    
    <div class="content">
      <!-- 用户信息卡片 -->
      <div v-if="userStore.isLoggedIn" class="user-profile-card">
        <div class="user-info-section">
          <div class="user-avatar-large">{{ userStore.currentUser.avatar }}</div>
          <div class="user-info">
            <h2 class="user-name">{{ userStore.currentUser.name }}</h2>
            <p class="user-location">📍 {{ userStore.currentUser.location || '未填写地址' }}</p>
            <div class="credit-score-large">
              <span class="credit-score-icon">🌟</span>
              <span>信用分: {{ userStore.currentUser.creditScore }}</span>
            </div>
          </div>
        </div>
        
        <div class="user-stats-section">
          <div class="stat-item">
            <span class="stat-value">{{ userStore.currentUser.helpRequests }}</span>
            <span class="stat-label">发布求助</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ userStore.currentUser.completedTasks }}</span>
            <span class="stat-label">帮助他人</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ userStore.currentUser.rating || 0 }}</span>
            <span class="stat-label">平均评分</span>
          </div>
        </div>
      </div>
      
      <!-- 未登录状态 -->
      <div v-else class="login-prompt">
        <div class="empty-state">
          <div class="empty-state-icon">👤</div>
          <p>请先登录查看个人信息</p>
          <button class="btn btn-primary" @click="goToLogin">立即登录</button>
        </div>
      </div>
      
      <!-- 功能菜单 -->
      <div class="menu-section">
        <div class="menu-card">
          <div v-if="userStore.isLoggedIn">
            <div class="menu-item" @click="goToMyRequests">
              <span class="menu-icon">📝</span>
              <span class="menu-text">我的求助</span>
              <span class="menu-arrow">›</span>
            </div>
            
            <div class="menu-item" @click="goToMyTasks">
              <span class="menu-icon">✅</span>
              <span class="menu-text">我的任务</span>
              <span class="menu-arrow">›</span>
            </div>
            
            <div class="menu-item" @click="goToEditProfile">
              <span class="menu-icon">⚙️</span>
              <span class="menu-text">编辑资料</span>
              <span class="menu-arrow">›</span>
            </div>
          </div>
          
          <div class="menu-item" @click="goToMatch">
            <span class="menu-icon">🎯</span>
            <span class="menu-text">智能匹配</span>
            <span class="menu-arrow">›</span>
          </div>
          
          <div class="menu-item" @click="goToCommunity">
            <span class="menu-icon">💬</span>
            <span class="menu-text">我的动态</span>
            <span class="menu-arrow">›</span>
          </div>
        </div>
        
        <!-- 退出登录 -->
        <div v-if="userStore.isLoggedIn" class="menu-card">
          <div class="menu-item logout-item" @click="handleLogout">
            <span class="menu-icon">🚪</span>
            <span class="menu-text">退出登录</span>
          </div>
        </div>
      </div>
      
      <!-- 关于我们 -->
      <div class="about-section">
        <div class="card">
          <h3 class="about-title">关于邻里互助帮</h3>
          <p class="about-desc">
            邻里互助帮致力于打造和谐邻里关系，让远亲不如近邻成为现实。
            通过平台，您可以发布求助、帮助他人、分享生活，让社区更温暖。
          </p>
          <p class="about-version">版本 1.0.0</p>
        </div>
      </div>
    </div>
    
    <TabBar />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import TabBar from '../components/TabBar.vue'

const router = useRouter()
const userStore = useUserStore()

onMounted(() => {
  userStore.checkAuth()
})

function goToLogin() {
  router.push('/login')
}

function goToMyRequests() {
  router.push('/my-requests')
}

function goToMyTasks() {
  router.push('/my-tasks')
}

function goToEditProfile() {
  router.push('/edit-profile')
}

function goToMatch() {
  router.push('/match')
}

function goToCommunity() {
  router.push('/community')
}

function handleLogout() {
  userStore.logout()
  router.push('/home')
}
</script>

<style scoped>
.content {
  padding-bottom: 80px;
}

.user-profile-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  color: white;
}

.user-info-section {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.user-avatar-large {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  margin-right: 16px;
}

.user-info {
  flex: 1;
}

.user-name {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 4px;
}

.user-location {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.credit-score-large {
  display: inline-flex;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.2);
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
}

.credit-score-large .credit-score-icon {
  margin-right: 4px;
}

.user-stats-section {
  display: flex;
  justify-content: space-around;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  opacity: 0.9;
}

.login-prompt {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40px 20px;
}

.login-prompt .empty-state {
  color: white;
}

.login-prompt .empty-state-icon {
  color: white;
  opacity: 0.8;
}

.login-prompt p {
  margin-bottom: 16px;
}

.menu-section {
  padding: 12px;
}

.menu-card {
  background-color: white;
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid #f0f0f0;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:hover {
  background-color: #f8f9fa;
}

.menu-icon {
  font-size: 20px;
  margin-right: 12px;
}

.menu-text {
  flex: 1;
  font-size: 15px;
  color: #333;
}

.menu-arrow {
  color: #ccc;
  font-size: 18px;
}

.logout-item {
  color: #e74c3c;
  justify-content: center;
}

.logout-item .menu-text {
  color: #e74c3c;
  flex: none;
}

.about-section {
  padding: 0 12px;
}

.about-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #333;
}

.about-desc {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 12px;
}

.about-version {
  font-size: 12px;
  color: #999;
  text-align: center;
}
</style>
