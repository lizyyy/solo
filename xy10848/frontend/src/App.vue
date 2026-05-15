<template>
  <el-container style="height: 100vh">
    <el-aside width="200px" style="background: #2c3e50; color: white">
      <div style="padding: 20px; font-size: 16px; font-weight: bold; border-bottom: 1px solid #34495e">
        额度管理系统
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#2c3e50"
        text-color="#fff"
        active-text-color="#409eff"
        style="border: none"
      >
        <el-menu-item index="/">
          <el-icon><Monitor /></el-icon>
          <span>总览</span>
        </el-menu-item>
        <el-menu-item index="/requests">
          <el-icon><Document /></el-icon>
          <span>生成请求</span>
        </el-menu-item>
        <el-menu-item index="/credits">
          <el-icon><Refund /></el-icon>
          <span>退费审核</span>
        </el-menu-item>
        <el-menu-item index="/reports">
          <el-icon><DataAnalysis /></el-icon>
          <span>报表导出</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-main style="background: #f5f7fa">
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

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
</style>
