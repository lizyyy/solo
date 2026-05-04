<template>
  <div class="app-container">
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8c2 0 3 2 3 4s-1 4-3 4-3-2-3-4 1-4 3-4z"/>
            <path d="M12 18c4 0 6-2 6-4"/>
          </svg>
        </div>
        <div class="brand">
          <h1>蓝牙巡检</h1>
          <span class="version">v1.0.0</span>
        </div>
      </div>

      <nav class="nav-menu">
        <router-link 
          v-for="item in menuItems" 
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
        >
          <span v-html="item.icon()" class="nav-icon-wrapper"></span>
          <span class="nav-label">{{ item.label }}</span>
          <span v-if="item.badge" class="nav-badge">{{ item.badge }}</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <div class="stats-summary">
          <div class="stat-item">
            <span class="stat-value">{{ stats.devices }}</span>
            <span class="stat-label">设备总数</span>
          </div>
          <div class="stat-item">
            <span class="stat-value warning">{{ stats.openAnomalies }}</span>
            <span class="stat-label">待处理异常</span>
          </div>
        </div>
      </div>
    </aside>

    <main class="main-content">
      <header class="page-header">
        <div class="header-left">
          <h2>{{ currentPageTitle }}</h2>
          <p v-if="currentPageSubtitle" class="subtitle">{{ currentPageSubtitle }}</p>
        </div>
        <div class="header-actions">
          <slot name="header-actions"></slot>
        </div>
      </header>

      <div class="content-area">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>

    <div v-if="notification.show" class="notification-overlay" @click="closeNotification">
      <div class="notification" :class="notification.type" @click.stop>
        <div class="notification-icon">
          <svg v-if="notification.type === 'success'" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          <svg v-else-if="notification.type === 'error'" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          <svg v-else width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </div>
        <div class="notification-content">
          <p class="notification-title">{{ notification.title }}</p>
          <p v-if="notification.message" class="notification-message">{{ notification.message }}</p>
        </div>
        <button class="notification-close" @click="closeNotification">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, provide } from 'vue'
import { useRoute } from 'vue-router'
import icons from './components/icons'
import { useApi } from './utils/api'

const route = useRoute()
const api = useApi()

const stats = ref({
  devices: 0,
  openAnomalies: 0
})

const notification = ref({
  show: false,
  type: 'info',
  title: '',
  message: ''
})

const menuItems = computed(() => [
  { 
    path: '/', 
    label: '设备看板', 
    icon: icons.DashboardIcon 
  },
  { 
    path: '/devices', 
    label: '设备管理', 
    icon: icons.DevicesIcon 
  },
  { 
    path: '/zones', 
    label: '区域视图', 
    icon: icons.ZonesIcon 
  },
  { 
    path: '/anomalies', 
    label: '异常队列', 
    icon: icons.AnomaliesIcon,
    badge: stats.value.openAnomalies > 0 ? stats.value.openAnomalies : null
  },
  { 
    path: '/import', 
    label: '数据导入', 
    icon: icons.ImportIcon 
  },
  { 
    path: '/reports', 
    label: '报告导出', 
    icon: icons.ReportsIcon 
  }
])

const currentPageTitle = computed(() => {
  const titles = {
    '/': '设备看板',
    '/devices': '设备管理',
    '/zones': '区域视图',
    '/anomalies': '异常队列',
    '/import': '数据导入',
    '/reports': '报告导出'
  }
  return titles[route.path] || '蓝牙巡检'
})

const currentPageSubtitle = computed(() => {
  const subtitles = {
    '/': '实时监控所有蓝牙设备状态',
    '/devices': '管理所有注册设备的详细信息',
    '/zones': '按区域查看设备分布和信号热力图',
    '/anomalies': '处理和跟踪所有异常事件',
    '/import': '导入扫描记录、设备台账、配对事件',
    '/reports': '生成和导出巡检分析报告'
  }
  return subtitles[route.path] || ''
})

const isActive = (path) => {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}

const showNotification = (type, title, message = '') => {
  notification.value = {
    show: true,
    type,
    title,
    message
  }

  setTimeout(() => {
    closeNotification()
  }, 4000)
}

const closeNotification = () => {
  notification.value.show = false
}

const loadStats = async () => {
  try {
    const response = await api.get('/stats')
    if (response.success) {
      stats.value = response.data
    }
  } catch (error) {
    console.error('Failed to load stats:', error)
  }
}

provide('showNotification', showNotification)
provide('api', api)

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
