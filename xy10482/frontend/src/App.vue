<template>
  <el-container class="app-container">
    <el-aside width="220px" class="sidebar">
      <div class="logo">
        <el-icon size="28"><Greenhouse /></el-icon>
        <span class="logo-text">农产品采收入库台</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        class="sidebar-menu"
        background-color="#001529"
        text-color="#fff"
        active-text-color="#1890ff"
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataBoard /></el-icon>
          <span>数据看板</span>
        </el-menu-item>
        <el-menu-item index="/plots">
          <el-icon><LocationFilled /></el-icon>
          <span>地块管理</span>
        </el-menu-item>
        <el-menu-item index="/harvest-tasks">
          <el-icon><Calendar /></el-icon>
          <span>采收任务</span>
        </el-menu-item>
        <el-menu-item index="/batches">
          <el-icon><Box /></el-icon>
          <span>入库批次</span>
        </el-menu-item>
        <el-menu-item index="/inspections">
          <el-icon><DocumentChecked /></el-icon>
          <span>质检管理</span>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>基础设置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-title">{{ currentPageTitle }}</div>
      </el-header>
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const activeMenu = computed(() => route.path)

const currentPageTitle = computed(() => {
  const titles = {
    '/dashboard': '数据看板',
    '/plots': '地块管理',
    '/harvest-tasks': '采收任务',
    '/batches': '入库批次',
    '/inspections': '质检管理',
    '/settings': '基础设置'
  }
  return titles[route.path] || '农产品采收入库台'
})
</script>

<style>
html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif;
}

.app-container {
  height: 100vh;
}

.sidebar {
  background-color: #001529;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 1000;
}

.logo {
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  color: #fff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo-text {
  margin-left: 10px;
  font-size: 16px;
  font-weight: bold;
}

.sidebar-menu {
  border-right: none;
}

.sidebar-menu .el-menu-item {
  height: 56px;
  line-height: 56px;
}

.app-container > .el-container {
  margin-left: 220px;
}

.header {
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  padding: 0 24px;
  display: flex;
  align-items: center;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.main-content {
  background: #f0f2f5;
  padding: 24px;
  min-height: calc(100vh - 64px);
}
</style>
