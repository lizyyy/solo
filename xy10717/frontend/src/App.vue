<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="header-content">
        <h1>
          <el-icon><Database /></el-icon>
          数据库迁移审批台
        </h1>
      </div>
    </el-header>
    <el-container>
      <el-aside width="220px" class="app-aside">
        <el-menu
          :default-active="$route.path"
          router
          background-color="#001529"
          text-color="#fff"
          active-text-color="#1890ff"
        >
          <el-menu-item index="/">
            <el-icon><List /></el-icon>
            <span>迁移脚本列表</span>
          </el-menu-item>
          <el-menu-item index="/create">
            <el-icon><Plus /></el-icon>
            <span>新建迁移脚本</span>
          </el-menu-item>
          <el-menu-item index="/logs">
            <el-icon><Document /></el-icon>
            <span>执行日志</span>
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
import { Database, List, Plus, Document } from '@element-plus/icons-vue'
</script>

<style scoped>
.app-container {
  height: 100vh;
}

.app-header {
  background: #fff;
  border-bottom: 1px solid #e6e6e6;
  padding: 0 20px;
}

.header-content h1 {
  margin: 0;
  font-size: 20px;
  line-height: 60px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.app-aside {
  background: #001529;
}

.app-main {
  background: #f0f2f5;
  padding: 20px;
}
</style>