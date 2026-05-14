<template>
  <div id="app">
    <el-container style="height: 100vh">
      <el-header style="background: #409eff; color: white; font-size: 20px; font-weight: bold; display: flex; align-items: center">
        <span>内部服务健康巡检系统</span>
      </el-header>
      <el-container>
        <el-aside width="200px" style="background: #f5f7fa">
          <el-menu
            :default-active="$route.path"
            router
            style="border: none"
          >
            <el-menu-item index="/">
              <el-icon><Document /></el-icon>
              <span>巡检记录</span>
            </el-menu-item>
            <el-menu-item index="/services">
              <el-icon><Menu /></el-icon>
              <span>服务管理</span>
            </el-menu-item>
            <el-menu-item index="/duty-reports">
              <el-icon><Reading /></el-icon>
              <span>值班报告</span>
            </el-menu-item>
          </el-menu>
        </el-aside>
        <el-main style="background: white; padding: 20px">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { Document, Menu, Reading } from '@element-plus/icons-vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
}
</style>
