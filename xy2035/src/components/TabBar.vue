<template>
  <div class="tab-bar">
    <router-link 
      v-for="item in tabs" 
      :key="item.path" 
      :to="item.path"
      class="tab-item"
      :class="{ active: isActive(item.path) }"
    >
      <span class="tab-icon">{{ item.icon }}</span>
      <span>{{ item.name }}</span>
    </router-link>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()

const tabs = [
  { path: '/home', name: '首页', icon: '🏠' },
  { path: '/category', name: '分类', icon: '📋' },
  { path: '/community', name: '美食圈', icon: '🌐' },
  { path: '/checkin', name: '打卡', icon: '📅' },
  { path: '/profile', name: '我的', icon: '👤' }
]

const isActive = (path) => {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<style scoped>
.tab-bar {
  display: flex;
  background-color: var(--bg-primary);
  border-top: 1px solid var(--border-color);
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 12px;
  transition: color 0.2s;
}

.tab-item.active {
  color: var(--primary-color);
}

.tab-icon {
  font-size: 24px;
  margin-bottom: 2px;
}
</style>
