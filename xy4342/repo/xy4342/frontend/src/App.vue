<template>
  <div class="app-container">
    <header class="app-header">
      <div class="header-content">
        <h1 class="app-title">🎬 分镜连续性检查台</h1>
        <div class="header-actions">
          <button 
            v-if="overview" class="stats-bar">
            <span class="stat-item">
              <span class="stat-label">章节</span>
              <span class="stat-value">{{ overview.chapters }}</span>
            </span>
            <span class="stat-item">
              <span class="stat-label">分镜</span>
              <span class="stat-value">{{ overview.panels }}</span>
            </span>
            <span class="stat-item">
              <span class="stat-label">角色</span>
              <span class="stat-value">{{ overview.characters }}</span>
            </span>
            <span class="stat-item stat-warning">
              <span class="stat-label">问题</span>
              <span class="stat-value">{{ overview.issues }}</span>
            </span>
          </div>
      </div>
    </header>
    
    <nav class="app-nav">
      <router-link to="/" class="nav-item">📥 导入数据</router-link>
      <router-link to="/issues" class="nav-item">🔍 问题列表</router-link>
      <router-link to="/chapters" class="nav-item">📖 章节查看</router-link>
      <router-link to="/export" class="nav-item">📤 导出报告</router-link>
    </nav>
    
    <main class="app-main">
      <router-view />
    </main>
    
    <footer class="app-footer">
      <p>分镜连续性检查台 v1.0.0 | 本地部署 | 数据持久化在本地数据库</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api'

const router = useRouter()
const overview = ref(null)

const loadOverview = async () => {
  try {
    const response = await api.getDataOverview()
    overview.value = response.data
  } catch (e) {
    console.error('Failed to load overview:', e)
  }
}

onMounted(() => {
  loadOverview()
})

watch(
  () => router.currentRoute.value.path,
  () => {
    loadOverview()
  }
)
</script>

<style>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem 2rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.app-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
}

.stats-bar {
  display: flex;
  gap: 1.5rem;
  background: rgba(255, 255, 255, 0.15);
  padding: 0.5rem 1rem;
  border-radius: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  text-align: center;
}

.stat-label {
  font-size: 0.75rem;
  opacity: 0.9;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 600;
}

.stat-warning .stat-value {
  color: #ffd700;
}

.app-nav {
  background: white;
  padding: 0.75rem 2rem;
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.nav-item {
  padding: 0.5rem 1.25rem;
  text-decoration: none;
  color: #666;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: #f0f0f0;
  color: #333;
}

.nav-item.router-link-active {
  background: #667eea;
  color: white;
}

.app-main {
  flex: 1;
  padding: 1.5rem 2rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.app-footer {
  background: #f8f9fa;
  padding: 1rem 2rem;
  text-align: center;
  color: #888;
  font-size: 0.875rem;
  border-top: 1px solid #e0e0e0;
}

.app-footer p {
  margin: 0;
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .app-nav {
    flex-wrap: wrap;
  }
  
  .nav-item {
    flex: 1;
    text-align: center;
  }
}
</style>
