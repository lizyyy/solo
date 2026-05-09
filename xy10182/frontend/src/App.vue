<template>
  <el-container style="height: 100vh;">
    <el-aside width="220px" style="background: #001529;">
      <div class="logo">
        <el-icon class="logo-icon" :size="24"><Beaker /></el-icon>
        <span class="logo-text">试剂追溯台</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#001529"
        text-color="#a7b1c2"
        active-text-color="#409EFF"
      >
        <el-menu-item
          v-for="route in menuRoutes"
          :index="route.path"
          :key="route.path"
        >
          <el-icon><component :is="route.meta.icon" /></el-icon>
          <span>{{ route.meta.title }}</span>
          <el-badge
            v-if="route.path === '/alerts' && appStore.totalAlerts > 0"
            :value="appStore.totalAlerts"
            class="alert-badge"
            type="danger"
          />
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header style="background: #fff; border-bottom: 1px solid #e6e6e6;">
        <div class="header-content">
          <div class="header-title">{{ currentTitle }}</div>
          <div class="header-actions">
            <el-button text @click="refreshData">
              <el-icon><Refresh /></el-icon>
              <span>刷新数据</span>
            </el-button>
            <el-tag v-if="appStore.totalAlerts > 0" type="danger" effect="dark" @click="goToAlerts" class="alert-tag" style="cursor: pointer;">
              <el-icon><Bell /></el-icon>
              <span>告警 {{ appStore.totalAlerts }}</span>
            </el-tag>
          </div>
        </div>
      </el-header>
      <el-main style="background: #f5f5f5; overflow: auto;">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from './store/app'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()

const menuRoutes = computed(() => {
  return router.options.routes.filter(r => r.meta && !r.meta.hidden)
})

const activeMenu = computed(() => route.path)
const currentTitle = computed(() => route.meta?.title || '实验室试剂领用追溯台')

let refreshTimer = null

function refreshData() {
  appStore.refreshAll()
}

function goToAlerts() {
  router.push('/alerts')
}

onMounted(() => {
  appStore.refreshAll()
  refreshTimer = setInterval(() => {
    appStore.fetchAlerts()
  }, 30000)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
}

html, body, #app {
  height: 100%;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  border-bottom: 1px solid #1a1a2e;
}

.logo-icon {
  margin-right: 8px;
  color: #409EFF;
}

.logo-text {
  color: #fff;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
}

.header-title {
  font-size: 18px;
  font-weight: 500;
  color: #303133;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.alert-tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.el-menu-item {
  border-bottom: 1px solid #1a1a2e;
}

.alert-badge {
  margin-left: 8px;
}
</style>
