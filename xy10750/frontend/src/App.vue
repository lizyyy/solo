<template>
  <el-container style="height: 100vh">
    <el-aside width="200px">
      <el-menu
        :default-active="$route.path"
        class="el-menu-vertical"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
      >
        <el-menu-item index="/preferences">
          <el-icon><Setting /></el-icon>
          <span>偏好管理</span>
        </el-menu-item>
        <el-menu-item index="/receipts">
          <el-icon><Document /></el-icon>
          <span>发送回执</span>
        </el-menu-item>
        <el-menu-item index="/retry-records">
          <el-icon><Refresh /></el-icon>
          <span>重试记录</span>
        </el-menu-item>
        <el-menu-item index="/exports">
          <el-icon><Download /></el-icon>
          <span>导出管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header style="background: #fff; border-bottom: 1px solid #e6e6e6">
        <h2 style="margin: 0; line-height: 60px">通知中心偏好管理系统</h2>
      </el-header>
      <el-main style="background: #f0f2f5">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { Setting, Document, Refresh, Download } from '@element-plus/icons-vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
}
</style>