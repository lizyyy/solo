<template>
  <el-container class="app-container">
    <el-aside width="220px" class="sidebar">
      <div class="logo">
        <el-icon size="32" color="#409eff"><DocumentChecked /></el-icon>
        <span>陪护证办理系统</span>
      </div>
      <el-menu
        :default-active="currentRoute"
        router
        class="menu"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
      >
        <el-menu-item v-for="route in menuRoutes" :key="route.path" :index="route.path">
          <el-icon><component :is="route.meta.icon" /></el-icon>
          <span>{{ route.meta.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-title">{{ currentTitle }}</div>
        <div class="header-user">
          <el-icon><User /></el-icon>
          <span>管理员</span>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { DocumentChecked, User, DataBoard, RefreshRight, AlarmClock, Download, Document } from '@element-plus/icons-vue'

const route = useRoute()

const menuRoutes = [
  { path: '/dashboard', meta: { title: '工作台', icon: 'DataBoard' } },
  { path: '/patients', meta: { title: '患者列表', icon: 'User' } },
  { path: '/certificates', meta: { title: '证件办理', icon: 'Document' } },
  { path: '/replacements', meta: { title: '换人申请', icon: 'RefreshRight' } },
  { path: '/expiring', meta: { title: '过期提醒', icon: 'AlarmClock' } },
  { path: '/audit', meta: { title: '审计导出', icon: 'Download' } }
]

const currentRoute = computed(() => route.path)
const currentTitle = computed(() => route.meta?.title || '陪护证办理系统')
</script>

<style>
html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
}

.app-container {
  height: 100%;
}

.sidebar {
  background-color: #304156;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 100;
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60px;
  color: #fff;
  font-size: 16px;
  font-weight: bold;
  gap: 10px;
  border-bottom: 1px solid #1f2d3d;
}

.menu {
  border-right: none;
}

.header {
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  margin-left: 220px;
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  height: 60px;
  z-index: 99;
}

.header-title {
  font-size: 18px;
  font-weight: bold;
  color: #303133;
}

.header-user {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #606266;
}

.main {
  margin-left: 220px;
  margin-top: 60px;
  padding: 20px;
  background-color: #f5f7fa;
  min-height: calc(100vh - 60px);
}
</style>
