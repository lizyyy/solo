<template>
  <el-container class="app-container">
    <el-aside width="200px" class="app-aside">
      <div class="logo">
        <el-icon :size="28" color="#4A90D9">
          <Promotion />
        </el-icon>
        <span class="logo-text">窑炉排烧系统</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        class="sidebar-menu"
        background-color="#1e1e2e"
        text-color="#cdd6f4"
        active-text-color="#4A90D9"
        router
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/workbench">
          <el-icon><Setting /></el-icon>
          <span>排窑工作台</span>
        </el-menu-item>
        <el-menu-item index="/artworks">
          <el-icon><Picture /></el-icon>
          <span>作品管理</span>
        </el-menu-item>
        <el-menu-item index="/customers">
          <el-icon><User /></el-icon>
          <span>客户管理</span>
        </el-menu-item>
        <el-menu-item index="/materials">
          <el-icon><Box /></el-icon>
          <span>泥料釉料</span>
        </el-menu-item>
        <el-menu-item index="/kilns">
          <el-icon><OfficeBuilding /></el-icon>
          <span>窑炉管理</span>
        </el-menu-item>
        <el-menu-item index="/tasks">
          <el-icon><List /></el-icon>
          <span>烧窑任务</span>
        </el-menu-item>
        <el-menu-item index="/import-export">
          <el-icon><Download /></el-icon>
          <span>导入导出</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="app-header">
        <div class="header-title">
          <span>{{ currentPageTitle }}</span>
        </div>
        <div class="header-actions">
          <el-tag type="info">示例数据已加载</el-tag>
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
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  Promotion, DataAnalysis, Setting, Picture, User,
  Box, OfficeBuilding, List, Download
} from '@element-plus/icons-vue'

const route = useRoute()

const activeMenu = computed(() => route.path)

const currentPageTitle = computed(() => {
  return route.meta?.title || '陶艺工作室窑炉排烧系统'
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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.app-container {
  height: 100%;
}

.app-aside {
  background-color: #1e1e2e;
}

.logo {
  display: flex;
  align-items: center;
  padding: 20px 16px;
  border-bottom: 1px solid #313244;
}

.logo-text {
  margin-left: 12px;
  font-size: 16px;
  font-weight: 600;
  color: #cdd6f4;
}

.sidebar-menu {
  border-right: none;
}

.sidebar-menu .el-menu-item {
  height: 50px;
  line-height: 50px;
}

.app-header {
  background: #ffffff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.app-main {
  background: #f5f7fa;
  padding: 24px;
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

.card-container {
  background: #ffffff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}

.status-pending { background: #909399 !important; }
.status-in_kiln { background: #409EFF !important; }
.status-firing { background: #E6A23C !important; }
.status-out_kiln { background: #67C23A !important; }
.status-delivered { background: #909399 !important; }
.status-failed { background: #F56C6C !important; }
.status-cancelled { background: #909399 !important; }

.risk-error { background: #fef0f0; border-left: 4px solid #F56C6C; padding: 12px 16px; margin: 8px 0; border-radius: 4px; }
.risk-warning { background: #fdf6ec; border-left: 4px solid #E6A23C; padding: 12px 16px; margin: 8px 0; border-radius: 4px; }
.risk-info { background: #f4f4f5; border-left: 4px solid #909399; padding: 12px 16px; margin: 8px 0; border-radius: 4px; }
</style>
