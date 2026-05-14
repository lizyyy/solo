<template>
  <el-container class="app-container">
    <el-header class="header">
      <div class="header-title">
        <el-icon size="28" color="#409eff"><DataAnalysis /></el-icon>
        <span>埋点验收台</span>
      </div>
      <div class="header-subtitle">Tracking Acceptance Console</div>
    </el-header>
    <el-container>
      <el-aside width="220px" class="aside">
        <el-menu :default-active="activeMenu" router class="menu">
          <el-menu-item index="/">
            <el-icon><DataLine /></el-icon>
            <span>数据概览</span>
          </el-menu-item>
          <el-menu-item index="/session">
            <el-icon><VideoPlay /></el-icon>
            <span>调试会话</span>
          </el-menu-item>
          <el-menu-item index="/detection">
            <el-icon><Warning /></el-icon>
            <span>漏报检测</span>
          </el-menu-item>
          <el-menu-item index="/tracking">
            <el-icon><Setting /></el-icon>
            <span>埋点管理</span>
          </el-menu-item>
          <el-menu-item index="/version">
            <el-icon><DocumentChecked /></el-icon>
            <span>版本复核</span>
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
  display: flex;
  align-items: center;
  padding: 0 30px;
}
.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 22px;
  font-weight: 600;
}
.header-subtitle {
  margin-left: 20px;
  font-size: 14px;
  opacity: 0.8;
}
.aside {
  background: #fff;
  border-right: 1px solid #e6e6e6;
}
.menu {
  border: none;
}
.main {
  background: #f5f7fa;
  padding: 24px;
}
</style>
