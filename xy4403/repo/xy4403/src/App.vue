<template>
  <el-container class="app-container">
    <el-aside width="220px" class="app-aside">
      <div class="logo">
        <h2>胶片暗房管理系统</h2>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
      >
        <el-menu-item index="/">
          <el-icon><HomeFilled /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/batches">
          <el-icon><Collection /></el-icon>
          <span>批次管理</span>
        </el-menu-item>
        <el-menu-item index="/appointments">
          <el-icon><Calendar /></el-icon>
          <span>预约管理</span>
        </el-menu-item>
        <el-menu-item index="/chemicals">
          <el-icon><Beaker /></el-icon>
          <span>药液管理</span>
        </el-menu-item>
        <el-menu-item index="/darkbags">
          <el-icon><Box /></el-icon>
          <span>暗袋管理</span>
        </el-menu-item>
        <el-menu-item index="/pickup">
          <el-icon><Tickets /></el-icon>
          <span>取片登记</span>
        </el-menu-item>
        <el-menu-item index="/audit">
          <el-icon><Document /></el-icon>
          <span>审计日志</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  HomeFilled,
  Collection,
  Calendar,
  Beaker,
  Box,
  Tickets,
  Document
} from '@element-plus/icons-vue'

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
  width: 100%;
}

.app-container {
  height: 100%;
}

.app-aside {
  background-color: #304156;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #263445;
}

.logo h2 {
  color: #fff;
  font-size: 16px;
  font-weight: 500;
}

.app-main {
  background-color: #f0f2f5;
  padding: 20px;
}

.el-menu {
  border-right: none;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.card-container {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.status-tag {
  margin-right: 5px;
}

.violation-warning {
  background-color: #fdf6ec;
  border-left: 4px solid #e6a23c;
  padding: 12px 16px;
  margin-bottom: 16px;
  border-radius: 4px;
}

.violation-warning .warning-title {
  font-weight: 600;
  color: #e6a23c;
  margin-bottom: 8px;
}

.violation-warning .warning-item {
  color: #606266;
  font-size: 14px;
  padding: 4px 0;
}
</style>
