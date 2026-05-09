<template>
  <el-container class="app-container">
    <el-aside width="220px" class="sidebar">
      <div class="logo">
        <el-icon><Monitor /></el-icon>
        <span class="logo-text">ResilienceHub</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <span>系统概览</span>
        </el-menu-item>
        <el-menu-item index="/circuit-breaker">
          <el-icon><Connection /></el-icon>
          <span>熔断管理</span>
        </el-menu-item>
        <el-menu-item index="/rate-limit">
          <el-icon><Timer /></el-icon>
          <span>限流配置</span>
        </el-menu-item>
        <el-menu-item index="/fault-injection">
          <el-icon><Warning /></el-icon>
          <span>故障注入</span>
        </el-menu-item>
        <el-menu-item index="/simulation">
          <el-icon><Cpu /></el-icon>
          <span>压力模拟</span>
        </el-menu-item>
        <el-menu-item index="/problems">
          <el-icon><Document /></el-icon>
          <span>问题追踪</span>
        </el-menu-item>
        <el-menu-item index="/report">
          <el-icon><Download /></el-icon>
          <span>报告导出</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentPageTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-tag type="success" effect="dark">系统运行正常</el-tag>
        </div>
      </el-header>
      <el-main class="main-content">
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
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const activeMenu = computed(() => route.path)

const pageTitles = {
  '/dashboard': '系统概览',
  '/circuit-breaker': '熔断管理',
  '/rate-limit': '限流配置',
  '/fault-injection': '故障注入',
  '/simulation': '压力模拟',
  '/problems': '问题追踪',
  '/report': '报告导出'
}

const currentPageTitle = computed(() => pageTitles[route.path] || '系统概览')

watch(
  () => route.path,
  () => {},
  { immediate: true }
)
</script>

<style scoped>
.app-container {
  height: 100vh;
}

.sidebar {
  background-color: #304156;
  overflow-y: auto;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  gap: 8px;
  border-bottom: 1px solid #1f2d3d;
}

.logo-text {
  letter-spacing: 1px;
}

.header {
  background-color: #fff;
  border-bottom: 1px solid #dcdfe6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.main-content {
  background-color: #f5f7fa;
  padding: 20px;
  overflow-y: auto;
}
</style>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
