<template>
  <el-container class="app-container">
    <el-header class="header">
      <div class="header-left">
        <el-icon size="28"><DocumentChecked /></el-icon>
        <h1>发票OCR审核系统</h1>
      </div>
      <div class="header-right">
        <span class="user-info">质量负责人</span>
      </div>
    </el-header>
    <el-main class="main-content">
      <Dashboard />
    </el-main>
  </el-container>
</template>

<script setup>
import Dashboard from './views/Dashboard.vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f5f7fa;
}

.app-container {
  min-height: 100vh;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h1 {
  font-size: 22px;
  font-weight: 600;
}

.main-content {
  padding: 20px;
  background: #f5f7fa;
}
</style>
