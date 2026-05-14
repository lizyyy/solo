<template>
  <el-container class="app-container">
    <el-header class="header">
      <h1>定时任务日历中心</h1>
      <el-menu mode="horizontal" :router="true" default-active="/calendar">
        <el-menu-item index="/calendar">执行日历</el-menu-item>
        <el-menu-item index="/tasks">任务管理</el-menu-item>
        <el-menu-item index="/dashboard">图表看板</el-menu-item>
      </el-menu>
    </el-header>
    <el-main class="main-content">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup>
</script>

<style scoped>
.app-container {
  height: 100vh;
}
.header {
  background: #fff;
  display: flex;
  align-items: center;
  padding: 0 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.header h1 {
  margin: 0 40px 0 0;
  font-size: 20px;
  color: #409eff;
}
.main-content {
  background: #f5f7fa;
  padding: 20px;
}
</style>
