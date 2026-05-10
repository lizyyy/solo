<template>
  <el-container class="app-container">
    <el-header class="header">
      <div class="header-left">
        <el-icon size="24" color="#409EFF">
          <Calendar />
        </el-icon>
        <h1>桌游吧包场拼桌调度台</h1>
      </div>
      <div class="header-right">
        <el-tag type="success" effect="dark">
          <el-icon><CircleCheck /></el-icon>
          服务正常
        </el-tag>
      </div>
    </el-header>
    
    <el-container>
      <el-aside width="200px" class="sidebar">
        <el-menu
          :default-active="activeMenu"
          router
          class="sidebar-menu"
        >
          <el-menu-item index="/schedule">
            <el-icon><Calendar /></el-icon>
            <span>日程调度</span>
          </el-menu-item>
          <el-menu-item index="/waitlist">
            <el-icon><UserFilled /></el-icon>
            <span>拼桌候补</span>
          </el-menu-item>
          <el-menu-item index="/stats">
            <el-icon><DataAnalysis /></el-icon>
            <span>营收统计</span>
          </el-menu-item>
          <el-menu-item index="/manage">
            <el-icon><Setting /></el-icon>
            <span>资源管理</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      
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
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
}

.app-container {
  height: 100%;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h1 {
  font-size: 20px;
  font-weight: 600;
}

.sidebar {
  background-color: #f5f7fa;
}

.sidebar-menu {
  border-right: none;
}

.main-content {
  background-color: #f0f2f5;
  padding: 20px;
}
</style>
