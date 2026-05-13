<template>
  <el-container style="height: 100vh">
    <el-aside width="200px" style="background: #001529">
      <div style="color: white; text-align: center; padding: 20px 0; font-size: 18px; font-weight: bold">
        会议室预约系统
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#001529"
        text-color="#fff"
        active-text-color="#ffd04b"
      >
        <el-menu-item index="/">
          <el-icon><DataLine /></el-icon>
          <span>数据概览</span>
        </el-menu-item>
        <el-menu-item index="/booking">
          <el-icon><Calendar /></el-icon>
          <span>预约管理</span>
        </el-menu-item>
        <el-menu-item index="/device">
          <el-icon><Monitor /></el-icon>
          <span>设备管理</span>
        </el-menu-item>
        <el-menu-item index="/tea-service">
          <el-icon><CoffeeCup /></el-icon>
          <span>茶水服务</span>
        </el-menu-item>
        <el-menu-item index="/fault-ticket">
          <el-icon><Warning /></el-icon>
          <span>故障工单</span>
        </el-menu-item>
        <el-menu-item index="/anomaly">
          <el-icon><Bell /></el-icon>
          <span>异常看板</span>
        </el-menu-item>
        <el-menu-item index="/report">
          <el-icon><Document /></el-icon>
          <span>报表导出</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  DataLine,
  Calendar,
  Monitor,
  CoffeeCup,
  Warning,
  Bell,
  Document
} from '@element-plus/icons-vue'

const route = useRoute()
const activeMenu = computed(() => route.path)
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

.el-main {
  background-color: #f5f7fa;
  padding: 20px;
}
</style>
