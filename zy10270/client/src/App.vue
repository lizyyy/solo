<template>
  <div id="app">
    <el-container style="height: 100vh;">
      <el-header style="background: #007bff; color: white; padding: 0 20px; display: flex; align-items: center;">
        <h1 style="margin: 0; font-size: 20px;">🏨 民宿布草洗涤追踪台</h1>
        <el-menu
          :default-active="activeMenu"
          mode="horizontal"
          router
          style="margin-left: 30px; background: transparent; border: none;"
          text-color="white"
          active-text-color="#ffd04b"
        >
          <el-menu-item index="/batches">洗涤批次</el-menu-item>
          <el-menu-item index="/linens">布草管理</el-menu-item>
          <el-menu-item index="/rooms">房源管理</el-menu-item>
          <el-menu-item index="/inventory">库存预警</el-menu-item>
          <el-menu-item index="/claims">赔付记录</el-menu-item>
        </el-menu>
      </el-header>
      <el-main style="padding: 20px; background: #f5f7fa;">
        <router-view />
      </el-main>
    </el-container>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

export default {
  name: 'App',
  setup() {
    const route = useRoute()
    const activeMenu = computed(() => route.path)
    return { activeMenu }
  }
}
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
}
#app {
  height: 100%;
}
</style>
