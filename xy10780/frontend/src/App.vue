<template>
  <div id="app">
    <el-container style="height: 100vh">
      <el-header style="background: #fff; border-bottom: 1px solid #eee; display: flex; align-items: center; justify-content: space-between; padding: 0 24px">
        <div style="display: flex; align-items: center; gap: 12px">
          <el-icon :size="28" color="#409EFF"><Connection /></el-icon>
          <h1 style="margin: 0; font-size: 20px">边缘节点配置同步管理</h1>
        </div>
        <div>
          <el-button type="primary" @click="initData">
            <el-icon><Refresh /></el-icon>
            初始化测试数据
          </el-button>
        </div>
      </el-header>
      <el-main style="background: #f5f7fa; padding: 24px">
        <router-view />
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ElMessage } from 'element-plus'
import { Connection, Refresh } from '@element-plus/icons-vue'
import { initTestData } from './api'

const initData = async () => {
  try {
    await initTestData()
    ElMessage.success('测试数据初始化成功')
    window.location.reload()
  } catch (error) {
    ElMessage.error('初始化失败')
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

#app {
  width: 100%;
  height: 100vh;
}
</style>
