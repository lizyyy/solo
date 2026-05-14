<template>
  <el-container style="height: 100vh">
    <el-aside width="200px" style="background-color: #2d3748">
      <div style="padding: 20px; color: white; font-size: 18px; font-weight: bold;">
        A/B实验配置台
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#2d3748"
        text-color="#a0aec0"
        active-text-color="#fff"
      >
        <el-menu-item index="/">
          <el-icon><DataLine /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/experiments">
          <el-icon><List /></el-icon>
          <span>实验列表</span>
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

const route = useRoute()
const activeMenu = computed(() => route.path)
</script>

<style>
body {
  margin: 0;
  padding: 0;
}
</style>
