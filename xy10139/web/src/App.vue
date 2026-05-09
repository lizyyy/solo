<template>
  <el-container class="app-container">
    <el-header class="header">
      <div class="header-content">
        <h1 @click="router.push('/')" class="title">导入校验差异回放器</h1>
        <el-menu mode="horizontal" :router="true" class="nav-menu">
          <el-menu-item index="/">新建导入</el-menu-item>
          <el-menu-item index="/jobs">历史记录</el-menu-item>
        </el-menu>
      </div>
    </el-header>
    <el-main>
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<style>
html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.app-container {
  height: 100%;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0;
  height: 64px;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
}

.title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  cursor: pointer;
}

.nav-menu {
  background: transparent;
  border-bottom: none;
}

.nav-menu .el-menu-item {
  color: rgba(255,255,255,0.9) !important;
  border-bottom: 2px solid transparent;
}

.nav-menu .el-menu-item:hover {
  background: rgba(255,255,255,0.1);
}

.nav-menu .el-menu-item.is-active {
  background: rgba(255,255,255,0.15);
  border-bottom-color: #ffd04b;
  color: white !important;
}
</style>