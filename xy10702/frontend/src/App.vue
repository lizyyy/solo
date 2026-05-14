<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="header-content">
        <h1><el-icon><Tools /></el-icon> OAuth回调调试站</h1>
        <div class="header-actions">
          <el-button type="primary" @click="$router.push('/session/new')">
            <el-icon><Plus /></el-icon> 新建会话
          </el-button>
        </div>
      </div>
    </el-header>
    <el-container>
      <el-aside width="220px" class="app-aside">
        <el-menu
          :default-active="$route.path"
          class="nav-menu"
          router
        >
          <el-menu-item index="/">
            <el-icon><DataAnalysis /></el-icon>
            <span>数据看板</span>
          </el-menu-item>
          <el-menu-item index="/sessions">
            <el-icon><List /></el-icon>
            <span>会话列表</span>
          </el-menu-item>
          <el-menu-item index="/diff">
            <el-icon><Compare /></el-icon>
            <span>差异比较</span>
          </el-menu-item>
          <el-menu-item index="/exports">
            <el-icon><Download /></el-icon>
            <span>导出面板</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { Tools, Plus, DataAnalysis, List, Compare, Download } from '@element-plus/icons-vue'
</script>

<style scoped>
.app-container {
  height: 100vh;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0 24px;
  display: flex;
  align-items: center;
}

.header-content {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-content h1 {
  margin: 0;
  font-size: 22px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-aside {
  background: #f5f7fa;
  border-right: 1px solid #e4e7ed;
}

.nav-menu {
  border-right: none;
  background: transparent;
}

.app-main {
  background: #f0f2f5;
  padding: 24px;
  overflow-y: auto;
}
</style>
