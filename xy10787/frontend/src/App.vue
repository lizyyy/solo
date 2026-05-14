<template>
  <el-container class="app-container">
    <el-header class="header">
      <h1>多语言文案发布台</h1>
    </el-header>
    <el-container>
      <el-aside width="200px" class="aside">
        <el-menu
          :default-active="activeMenu"
          router
          background-color="#545c64"
          text-color="#fff"
          active-text-color="#ffd04b"
        >
          <el-menu-item index="/translation">
            <el-icon><Document /></el-icon>
            <span>翻译管理</span>
          </el-menu-item>
          <el-menu-item index="/version">
            <el-icon><Collection /></el-icon>
            <span>版本管理</span>
          </el-menu-item>
          <el-menu-item index="/report">
            <el-icon><DataAnalysis /></el-icon>
            <span>覆盖率报告</span>
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
  background-color: #409eff;
  color: white;
  display: flex;
  align-items: center;
  padding: 0 20px;
}
.header h1 {
  margin: 0;
  font-size: 24px;
}
.aside {
  background-color: #545c64;
}
.main {
  background-color: #f5f7fa;
  padding: 20px;
}
</style>
