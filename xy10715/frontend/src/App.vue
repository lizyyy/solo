<template>
  <el-container class="app-container">
    <el-header>
      <div class="header-content">
        <h1>缓存预热失效中心</h1>
        <el-menu mode="horizontal" :router="true" active-text-color="#409eff">
          <el-menu-item index="/">仪表盘</el-menu-item>
          <el-menu-item index="/rules">缓存规则</el-menu-item>
          <el-menu-item index="/reports">性能报告</el-menu-item>
        </el-menu>
      </div>
    </el-header>
    <el-main>
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </el-main>
  </el-container>
</template>

<script setup>
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.app-container {
  height: 100vh;
}

.el-header {
  background-color: #fff;
  border-bottom: 1px solid #e6e6e6;
  padding: 0;
  height: auto !important;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 40px;
}

.header-content h1 {
  font-size: 20px;
  color: #303133;
  white-space: nowrap;
}

.el-main {
  background-color: #f5f7fa;
  padding: 20px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
