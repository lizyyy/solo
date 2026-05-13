<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="header-content">
        <div class="logo">
          <el-icon size="32" color="#67C23A"><Tea /></el-icon>
          <span class="title">茶叶拼配试饮台</span>
        </div>
      </div>
    </el-header>
    <el-container>
      <el-aside width="220px" class="app-aside">
        <el-menu
          :default-active="activeMenu"
          router
          background-color="#5D4E37"
          text-color="#F5E6D3"
          active-text-color="#FFD700"
        >
          <el-menu-item index="/dashboard">
            <el-icon><DataLine /></el-icon>
            <span>数据概览</span>
          </el-menu-item>
          <el-menu-item index="/materials">
            <el-icon><Box /></el-icon>
            <span>原料批次</span>
          </el-menu-item>
          <el-menu-item index="/schemes">
            <el-icon><Document /></el-icon>
            <span>拼配方案</span>
          </el-menu-item>
          <el-menu-item index="/tastings">
            <el-icon><Coffee /></el-icon>
            <span>试饮反馈</span>
          </el-menu-item>
          <el-menu-item index="/products">
            <el-icon><Goods /></el-icon>
            <span>成品入库</span>
          </el-menu-item>
          <el-menu-item index="/sales">
            <el-icon><ShoppingCart /></el-icon>
            <span>销售记录</span>
          </el-menu-item>
          <el-menu-item index="/reports">
            <el-icon><TrendCharts /></el-icon>
            <span>转化报表</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const activeMenu = computed(() => route.path)
</script>

<style scoped>
.app-container {
  height: 100vh;
}

.app-header {
  background: linear-gradient(135deg, #5D4E37 0%, #8B7355 100%);
  padding: 0;
  height: 70px;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.header-content {
  padding: 0 24px;
  display: flex;
  align-items: center;
  width: 100%;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title {
  font-size: 22px;
  font-weight: 600;
  color: #F5E6D3;
  letter-spacing: 2px;
}

.app-aside {
  background-color: #5D4E37;
}

.app-main {
  background-color: #FAF8F5;
  padding: 24px;
  overflow-y: auto;
}
</style>
