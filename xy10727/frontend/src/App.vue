<template>
  <div id="app">
    <el-container style="height: 100vh">
      <el-header style="background: #409EFF; color: white; padding: 0 20px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 15px;">
          <el-icon :size="28"><Location /></el-icon>
          <h1 style="margin: 0; font-size: 20px;">地址解析纠偏服务</h1>
        </div>
        <div style="display: flex; gap: 10px;">
          <el-button type="success" @click="goToCreate">
            <el-icon><Plus /></el-icon>
            新增地址
          </el-button>
        </div>
      </el-header>
      <el-main style="background: #f5f7fa; padding: 20px;">
        <router-view />
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { Location, Plus } from '@element-plus/icons-vue'

const router = useRouter()

const goToCreate = () => {
  router.push('/create')
}
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

#app {
  width: 100%;
  height: 100vh;
}
</style>
