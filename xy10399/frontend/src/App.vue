<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="header-content">
        <h1>📅 门店员工借调排班台</h1>
        <el-menu
          mode="horizontal"
          :router="true"
          :default-active="route.path"
          class="header-menu"
        >
          <el-menu-item index="/calendar">
            <el-icon><Calendar /></el-icon>
            <span>排班日历</span>
          </el-menu-item>
          <el-menu-item index="/requests">
            <el-icon><Document /></el-icon>
            <span>借调申请</span>
          </el-menu-item>
          <el-menu-item index="/approval">
            <el-icon><Checked /></el-icon>
            <span>审批管理</span>
          </el-menu-item>
        </el-menu>
      </div>
    </el-header>
    <el-main class="app-main">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { Calendar, Document, Checked } from '@element-plus/icons-vue'

const route = useRoute()
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

.app-header {
  background: linear-gradient(135deg, #409eff 0%, #667eea 100%);
  color: white;
  padding: 0 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.header-content {
  max-width: 1600px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
}

.header-content h1 {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 1px;
}

.header-menu {
  background: transparent;
  border: none;
}

.header-menu .el-menu-item {
  color: rgba(255, 255, 255, 0.9);
}

.header-menu .el-menu-item:hover {
  color: white;
  background: rgba(255, 255, 255, 0.1);
}

.header-menu .el-menu-item.is-active {
  color: white;
  background: rgba(255, 255, 255, 0.2);
}

.app-main {
  padding: 24px;
  background: #f5f7fa;
  min-height: calc(100vh - 60px);
}
</style>
