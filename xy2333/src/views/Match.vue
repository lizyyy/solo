<template>
  <div class="page">
    <div class="page-header">
      <div class="header-content">
        <span class="back-btn" @click="goBack">‹</span>
        <span class="header-title">智能匹配</span>
        <span></span>
      </div>
    </div>
    
    <div class="content">
      <!-- 智能匹配说明 -->
      <div class="intro-section">
        <div class="card">
          <h3 class="section-title">🤖 智能匹配系统</h3>
          <p class="intro-text">
            系统根据您的技能标签、信用评分、历史评价等多个维度，为您推荐最适合的邻居。
            您可以查看邻居的详细信息，选择最信任的人进行互助。
          </p>
          <div class="match-criteria">
            <div class="criteria-item">
              <span class="criteria-icon">🛠️</span>
              <span class="criteria-text">技能匹配</span>
            </div>
            <div class="criteria-item">
              <span class="criteria-icon">🌟</span>
              <span class="criteria-text">信用评分</span>
            </div>
            <div class="criteria-item">
              <span class="criteria-icon">⭐</span>
              <span class="criteria-text">历史评价</span>
            </div>
            <div class="criteria-item">
              <span class="criteria-icon">✅</span>
              <span class="criteria-text">完成次数</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 我的技能标签 -->
      <div class="skills-section" v-if="userStore.currentUser">
        <div class="card">
          <h3 class="section-title">📋 我的技能标签</h3>
          <div class="my-skills">
            <span 
              v-if="userStore.currentUser.skills && userStore.currentUser.skills.length > 0"
              v-for="skill in userStore.currentUser.skills" 
              :key="skill" 
              class="skill-tag my-skill"
            >
              {{ skill }}
            </span>
            <span v-else class="no-skills">
              暂无技能标签，<span class="edit-link" @click="goToEditProfile">点击添加</span>
            </span>
          </div>
          <p class="skills-tip">添加更多技能标签可以获得更精准的匹配推荐</p>
        </div>
      </div>
      
      <!-- 推荐邻居列表 -->
      <div class="matches-section">
        <div class="card">
          <h3 class="section-title">👥 推荐邻居</h3>
          
          <div v-if="topUsers.length === 0" class="empty-state">
            <div class="empty-state-icon">👤</div>
            <p>暂无推荐邻居</p>
          </div>
          
          <div class="matched-users">
            <div 
              v-for="(user, index) in topUsers" 
              :key="user.id" 
              class="matched-user-card"
            >
              <div class="user-header">
                <div class="rank-badge" :style="{ backgroundColor: getRankColor(index) }">
                  #{{ index + 1 }}
                </div>
                <div class="user-avatar-large">{{ user.avatar }}</div>
                <div class="user-basic-info">
                  <div class="user-name-large">{{ user.name }}</div>
                  <div class="user-location-small">📍 {{ user.location || '未填写地址' }}</div>
                </div>
              </div>
              
              <div class="user-stats-row">
                <div class="stat-card">
                  <span class="stat-value-large">{{ user.rating || 0 }}</span>
                  <span class="stat-label-small">平均评分</span>
                </div>
                <div class="stat-card">
                  <span class="stat-value-large">{{ user.creditScore }}</span>
                  <span class="stat-label-small">信用分</span>
                </div>
                <div class="stat-card">
                  <span class="stat-value-large">{{ user.completedTasks }}</span>
                  <span class="stat-label-small">帮助次数</span>
                </div>
                <div class="stat-card">
                  <span class="stat-value-large">{{ user.helpRequests }}</span>
                  <span class="stat-label-small">求助次数</span>
                </div>
              </div>
              
              <div class="user-skills-section" v-if="user.skills && user.skills.length > 0">
                <h4 class="skills-title">技能标签：</h4>
                <div class="user-skills-tags">
                  <span v-for="skill in user.skills" :key="skill" class="skill-tag">
                    {{ skill }}
                  </span>
                </div>
              </div>
              
              <div class="user-tags-section" v-if="user.tags && user.tags.length > 0">
                <h4 class="skills-title">用户标签：</h4>
                <div class="user-tags">
                  <span v-for="tag in user.tags" :key="tag" class="category-tag">
                    {{ tag }}
                  </span>
                </div>
              </div>
              
              <div class="user-bio-section" v-if="user.bio">
                <h4 class="skills-title">个人简介：</h4>
                <p class="user-bio">{{ user.bio }}</p>
              </div>
              
              <div class="user-actions">
                <button 
                  class="btn btn-primary" 
                  @click="viewUserHelpRequests(user.id)"
                >
                  查看TA的求助
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 匹配算法说明 -->
      <div class="algorithm-section">
        <div class="card">
          <h3 class="section-title">📊 匹配算法说明</h3>
          <div class="algorithm-details">
            <div class="algorithm-item">
              <div class="algorithm-header">
                <span class="algorithm-name">技能匹配 (50%)</span>
                <span class="algorithm-weight">权重: 50分</span>
              </div>
              <p class="algorithm-desc">
                根据邻居的技能标签与求助需求的匹配程度进行评分。
                技能匹配越多，得分越高。
              </p>
            </div>
            
            <div class="algorithm-item">
              <div class="algorithm-header">
                <span class="algorithm-name">信用评分 (20%)</span>
                <span class="algorithm-weight">权重: 20分</span>
              </div>
              <p class="algorithm-desc">
                根据邻居的邻里信用分进行评分。
                信用分越高，得分越高（满分100分 × 0.2）。
              </p>
            </div>
            
            <div class="algorithm-item">
              <div class="algorithm-header">
                <span class="algorithm-name">历史评价 (20%)</span>
                <span class="algorithm-weight">权重: 20分</span>
              </div>
              <p class="algorithm-desc">
                根据邻居的历史平均评分进行评分。
                4.5分以上得20分，4.0-4.5分得15分，以此类推。
              </p>
            </div>
            
            <div class="algorithm-item">
              <div class="algorithm-header">
                <span class="algorithm-name">完成次数 (10%)</span>
                <span class="algorithm-weight">权重: 10分</span>
              </div>
              <p class="algorithm-desc">
                根据邻居的历史帮助完成次数进行评分。
                30次以上得10分，20-29次得8分，以此类推。
              </p>
            </div>
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

const router = useRouter()
const userStore = useUserStore()

onMounted(() => {
  if (!userStore.checkAuth()) {
    router.push('/login')
    return
  }
})

const topUsers = computed(() => {
  return userStore.getTopRatedUsers(10)
})

function getRankColor(index) {
  if (index === 0) return '#ffc107' // 金色
  if (index === 1) return '#9e9e9e' // 银色
  if (index === 2) return '#cd7f32' // 铜色
  return '#4a90e2' // 默认蓝色
}

function goBack() {
  router.back()
}

function goToEditProfile() {
  router.push('/edit-profile')
}

function viewUserHelpRequests(userId) {
  router.push({
    path: '/help-requests',
    query: { userId: userId }
  })
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

.intro-text {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 16px;
}

.match-criteria {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.criteria-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.criteria-icon {
  font-size: 20px;
  margin-right: 8px;
}

.criteria-text {
  font-size: 13px;
  color: #333;
  font-weight: 500;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #333;
}

.my-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.my-skill {
  background-color: #4a90e2;
  color: white;
}

.no-skills {
  font-size: 14px;
  color: #999;
}

.edit-link {
  color: #4a90e2;
  cursor: pointer;
  text-decoration: underline;
}

.skills-tip {
  font-size: 12px;
  color: #999;
}

.matched-users {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.matched-user-card {
  background-color: #f8f9fa;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #e8f4fd;
}

.user-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.rank-badge {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 14px;
  margin-right: 12px;
}

.user-avatar-large {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background-color: #4a90e2;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
  font-weight: 700;
  margin-right: 12px;
}

.user-basic-info {
  flex: 1;
}

.user-name-large {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #333;
}

.user-location-small {
  font-size: 12px;
  color: #666;
}

.user-stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 16px;
  padding: 12px;
  background-color: white;
  border-radius: 8px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value-large {
  font-size: 18px;
  font-weight: 700;
  color: #4a90e2;
}

.stat-label-small {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}

.user-skills-section,
.user-tags-section,
.user-bio-section {
  margin-bottom: 12px;
}

.skills-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #666;
}

.user-skills-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.user-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.user-bio {
  font-size: 13px;
  color: #666;
  line-height: 1.6;
}

.user-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px solid #e0e0e0;
}

.algorithm-section {
  margin-top: 12px;
}

.algorithm-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.algorithm-item {
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border-left: 3px solid #4a90e2;
}

.algorithm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.algorithm-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.algorithm-weight {
  font-size: 12px;
  color: #4a90e2;
  font-weight: 500;
}

.algorithm-desc {
  font-size: 12px;
  color: #666;
  line-height: 1.6;
}
</style>
