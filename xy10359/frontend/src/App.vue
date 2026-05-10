<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="header-content">
        <div class="logo">
          <el-icon :size="28" color="#409EFF"><Document /></el-icon>
          <h1>线上问诊处方复核台</h1>
        </div>
        <el-menu mode="horizontal" :default-active="activeMenu" class="header-menu" @select="handleMenuSelect">
          <el-menu-item index="prescriptions">
            <el-icon><List /></el-icon>
            <span>处方管理</span>
          </el-menu-item>
          <el-menu-item index="summary">
            <el-icon><DataAnalysis /></el-icon>
            <span>负责人汇总</span>
          </el-menu-item>
        </el-menu>
      </div>
    </el-header>
    <el-main class="app-main">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const activeMenu = ref('prescriptions')

watch(() => route.path, (path) => {
  if (path.includes('summary')) {
    activeMenu.value = 'summary'
  } else {
    activeMenu.value = 'prescriptions'
  }
}, { immediate: true })

const handleMenuSelect = (index) => {
  if (index === 'prescriptions') {
    router.push('/prescriptions')
  } else if (index === 'summary') {
    router.push('/summary')
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif;
}

.app-container {
  height: 100%;
}

.app-header {
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  padding: 0;
  height: 64px;
  line-height: 64px;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo h1 {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.header-menu {
  border-bottom: none;
}

.app-main {
  background: #f0f2f5;
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}
</style>
