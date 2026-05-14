<template>
  <el-container class="app-container">
    <el-aside width="220px">
      <div class="logo">
        <el-icon size="32"><Location /></el-icon>
        <span>围栏告警系统</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#001529"
        text-color="#fff"
        active-text-color="#1890ff"
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <span>数据看板</span>
        </el-menu-item>
        <el-menu-item index="/geofences">
          <el-icon><Grid /></el-icon>
          <span>围栏管理</span>
        </el-menu-item>
        <el-menu-item index="/devices">
          <el-icon><Van /></el-icon>
          <span>设备管理</span>
        </el-menu-item>
        <el-menu-item index="/alerts">
          <el-icon><Warning /></el-icon>
          <span>告警列表</span>
        </el-menu-item>
        <el-menu-item index="/trajectory">
          <el-icon><Position /></el-icon>
          <span>轨迹回放</span>
        </el-menu-item>
        <el-menu-item index="/reports">
          <el-icon><Document /></el-icon>
          <span>轨迹报告</span>
        </el-menu-item>
        <el-menu-item index="/config">
          <el-icon><Setting /></el-icon>
          <span>策略配置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header>
        <div class="header-left">
          <h2>{{ pageTitle }}</h2>
        </div>
        <div class="header-right">
          <el-tag type="success">运维负责人</el-tag>
          <el-avatar :size="32" icon="User" />
        </div>
      </el-header>
      <el-main>
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
const pageTitle = computed(() => {
  const titles = {
    '/dashboard': '数据看板',
    '/geofences': '围栏管理',
    '/devices': '设备管理',
    '/alerts': '告警列表',
    '/trajectory': '轨迹回放',
    '/reports': '轨迹报告',
    '/config': '策略配置'
  }
  return titles[route.path] || '地图围栏告警系统'
})
</script>

<style scoped>
.app-container {
  height: 100vh;
}
.el-aside {
  background-color: #001529;
  color: #fff;
}
.logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 18px;
  font-weight: bold;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.el-header {
  background-color: #fff;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}
.header-left h2 {
  margin: 0;
  font-size: 20px;
  color: #333;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.el-main {
  background-color: #f0f2f5;
  overflow-y: auto;
}
</style>