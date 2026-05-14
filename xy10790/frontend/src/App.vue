<template>
  <el-container class="app-container">
    <el-header class="header">
      <div class="header-content">
        <h1 class="title">
          <el-icon><Reading /></el-icon>
          在线课程进度管理系统
        </h1>
      </div>
    </el-header>
    <el-container>
      <el-aside width="220px" class="aside">
        <el-menu
          :default-active="activeMenu"
          router
          class="menu"
        >
          <el-menu-item index="/">
            <el-icon><DataLine /></el-icon>
            <span>数据概览</span>
          </el-menu-item>
          <el-menu-item index="/progress">
            <el-icon><User /></el-icon>
            <span>学员进度</span>
          </el-menu-item>
          <el-menu-item index="/remedial">
            <el-icon><Warning /></el-icon>
            <span>补学任务</span>
          </el-menu-item>
          <el-menu-item index="/certificates">
            <el-icon><Medal /></el-icon>
            <span>证书资格</span>
          </el-menu-item>
          <el-menu-item index="/reports">
            <el-icon><Document /></el-icon>
            <span>报表导出</span>
          </el-menu-item>
          <el-menu-item index="/logs">
            <el-icon><Operation /></el-icon>
            <span>操作日志</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main class="main">
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

<style scoped>
.app-container {
  height: 100vh;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0 20px;
  display: flex;
  align-items: center;
}

.header-content {
  display: flex;
  align-items: center;
  width: 100%;
}

.title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 22px;
  font-weight: 600;
}

.aside {
  background-color: #f5f7fa;
  border-right: 1px solid #e4e7ed;
}

.menu {
  border-right: none;
}

.main {
  background-color: #f0f2f5;
  padding: 20px;
  overflow-y: auto;
}
</style>
