<template>
  <el-container class="app-container">
    <el-aside width="200px" class="sidebar">
      <div class="logo">
        <h3>音频质检系统</h3>
      </div>
      <el-menu :default-active="activeMenu" router>
        <el-menu-item index="/audio">
          <el-icon><Document /></el-icon>
          <span>质检列表</span>
        </el-menu-item>
        <el-menu-item index="/export">
          <el-icon><Download /></el-icon>
          <span>导出面板</span>
        </el-menu-item>
        <el-menu-item index="/statistics">
          <el-icon><DataLine /></el-icon>
          <span>统计分析</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
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

<style scoped>
.app-container {
  height: 100vh;
}

.sidebar {
  background-color: #2c3e50;
  color: white;
}

.logo {
  padding: 20px;
  text-align: center;
  border-bottom: 1px solid #34495e;
}

.logo h3 {
  margin: 0;
  color: #ecf0f1;
  font-size: 16px;
}

:deep(.el-menu) {
  background-color: #2c3e50;
  border-right: none;
}

:deep(.el-menu-item) {
  color: #bdc3c7;
}

:deep(.el-menu-item:hover) {
  background-color: #34495e;
  color: white;
}

:deep(.el-menu-item.is-active) {
  background-color: #3498db;
  color: white;
}

.main-content {
  background-color: #f5f6fa;
  padding: 20px;
}
</style>
