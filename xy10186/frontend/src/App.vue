<template>
  <el-container class="app-container">
    <el-aside width="220px" class="app-aside">
      <div class="logo">
        <el-icon size="24"><Document /></el-icon>
        <span>门诊转诊闭环平台</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#001529"
        text-color="rgba(255,255,255,0.85)"
        active-text-color="#409EFF"
      >
        <el-menu-item
          v-for="route in menuRoutes"
          :key="route.path"
          :index="route.path"
        >
          <el-icon><component :is="route.meta.icon" /></el-icon>
          <template #title>{{ route.meta.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="app-header">
        <div class="breadcrumb">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-badge :value="unhandledExceptionCount" :max="99" :hidden="unhandledExceptionCount === 0">
            <el-button link type="danger" @click="goToExceptions">
              <el-icon><Bell /></el-icon>
              异常提醒
            </el-button>
          </el-badge>
          <el-button link @click="refreshPage">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </el-header>
      <el-main class="app-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'

const route = useRoute()
const router = useRouter()

const unhandledExceptionCount = ref(0)

const menuRoutes = computed(() => {
  return router.options.routes.filter(r => r.meta && !r.meta.hidden && r.path !== '/')
})

const activeMenu = computed(() => route.path)

const currentTitle = computed(() => {
  if (route.meta.title) return route.meta.title
  const matchedRoute = menuRoutes.value.find(r => route.path.startsWith(r.path))
  return matchedRoute?.meta.title || ''
})

const loadExceptionCount = async () => {
  try {
    const res = await axios.get('/api/dashboard/summary')
    if (res.data.success) {
      unhandledExceptionCount.value = res.data.data.unhandled_exceptions
    }
  } catch (e) {
    console.error('加载异常数量失败:', e)
  }
}

const goToExceptions = () => {
  router.push('/exceptions')
}

const refreshPage = () => {
  window.location.reload()
}

onMounted(() => {
  loadExceptionCount()
  setInterval(loadExceptionCount, 60000)
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  width: 100%;
}

.app-container {
  height: 100vh;
}

.app-aside {
  background-color: #001529;
  overflow: hidden;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  font-size: 16px;
  font-weight: bold;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.el-menu {
  border-right: none;
}

.app-header {
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 1px 4px rgba(0,21,41,0.08);
}

.header-right {
  display: flex;
  gap: 16px;
}

.app-main {
  background-color: #f0f2f5;
  padding: 20px;
  overflow-y: auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
}

.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 8px;
}

.filter-panel {
  background: #fff;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.table-card {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
}

.status-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.status-pending { background: #f4f4f5; color: #909399; }
.status-accepted { background: #ecf5ff; color: #409EFF; }
.status-checking { background: #fef0f0; color: #F56C6C; }
.status-reported { background: #f0f9eb; color: #67C23A; }
.status-closed { background: #e1f3d8; color: #67C23A; }
.status-cancelled { background: #f4f4f5; color: #909399; }

.exception-warning { color: #E6A23C; }
.exception-danger { color: #F56C6C; }

.detail-section {
  margin-bottom: 20px;
}

.detail-section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 3px solid #409EFF;
}

.detail-info {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.detail-item {
  padding: 8px 0;
}

.detail-label {
  color: #909399;
  font-size: 13px;
}

.detail-value {
  color: #303133;
  font-size: 14px;
  margin-top: 4px;
}

.timeline-item {
  padding-bottom: 20px;
}

.timeline-time {
  color: #909399;
  font-size: 12px;
}

.timeline-content {
  color: #303133;
  margin-top: 4px;
}

.upload-area {
  border: 2px dashed #d9d9d9;
  border-radius: 6px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.3s;
}

.upload-area:hover {
  border-color: #409EFF;
}

.chart-container {
  height: 300px;
  width: 100%;
}
</style>
