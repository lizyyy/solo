<template>
  <div id="app">
    <el-container style="height: 100vh">
      <el-aside width="220px" style="background-color: #304156; color: #fff">
        <div style="padding: 20px; text-align: center; font-size: 18px; font-weight: bold;">
          退货质检台
        </div>
        <el-menu
          :default-active="$route.path"
          router
          background-color="#304156"
          text-color="#bfcbd9"
          active-text-color="#409EFF"
        >
          <el-menu-item index="/orders">
            <el-icon><Document /></el-icon>
            <span>退货单管理</span>
          </el-menu-item>
          <el-menu-item index="/dashboard">
            <el-icon><DataAnalysis /></el-icon>
            <span>统计汇总</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-container>
        <el-header style="background-color: #fff; border-bottom: 1px solid #dcdfe6; display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 16px; font-weight: bold;">{{ $route.name === 'OrderList' ? '退货单列表' : $route.name === 'OrderDetail' ? '质检详情' : '统计汇总' }}</span>
          <el-button type="text" @click="refreshData">
            <el-icon><Refresh /></el-icon>
            刷新数据
          </el-button>
        </el-header>
        <el-main style="background-color: #f5f7fa">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { provide } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const refreshData = () => {
  provide('refreshTrigger', Date.now())
  ElMessage.success('数据已刷新')
  window.location.reload()
}
</script>

<style>
html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
}
.el-menu-item {
  height: 50px !important;
  line-height: 50px !important;
}
</style>
