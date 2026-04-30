<template>
  <div class="app-container">
    <el-container>
      <el-header class="app-header">
        <div class="header-left">
          <el-icon class="logo-icon"><Tools /></el-icon>
          <span class="app-title">维修工单管理系统</span>
        </div>
        <div class="header-right">
          <router-link to="/">
            <el-button type="primary" :icon="View">看板视图</el-button>
          </router-link>
          <router-link to="/ticket/new">
            <el-button type="success" :icon="Plus">新建工单</el-button>
          </router-link>
        </div>
      </el-header>
      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { Tools, View, Plus } from '@element-plus/icons-vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', Arial, sans-serif;
}

.app-container {
  height: 100%;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 28px;
  color: #fff;
}

.app-title {
  font-size: 20px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 1px;
}

.header-right {
  display: flex;
  gap: 12px;
}

.app-main {
  background: #f0f2f5;
  padding: 20px;
  overflow-y: auto;
}
</style>
