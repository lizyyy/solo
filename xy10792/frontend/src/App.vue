<template>
  <el-container class="app-container">
    <el-aside width="200px" class="sidebar">
      <div class="logo">
        <h2>简历复核系统</h2>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
      >
        <el-menu-item index="/">
          <el-icon><DataAnalysis /></el-icon>
          <span>数据看板</span>
        </el-menu-item>
        <el-menu-item index="/resumes">
          <el-icon><Document /></el-icon>
          <span>简历列表</span>
        </el-menu-item>
        <el-menu-item index="/jobs">
          <el-icon><Briefcase /></el-icon>
          <span>岗位管理</span>
        </el-menu-item>
        <el-menu-item index="/export">
          <el-icon><Download /></el-icon>
          <span>数据导出</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-title">{{ pageTitle }}</div>
      </el-header>
      <el-main class="main-content">
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

const pageTitle = computed(() => {
  const titles = {
    '/': '数据看板',
    '/resumes': '简历列表',
    '/jobs': '岗位管理',
    '/export': '数据导出'
  }
  return titles[route.path] || '简历解析复核系统'
})
</script>

<style scoped>
.app-container {
  height: 100vh;
}

.sidebar {
  background-color: #304156;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #2b3a4a;
}

.logo h2 {
  color: #fff;
  font-size: 16px;
  margin: 0;
}

.header {
  background-color: #fff;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  align-items: center;
  padding: 0 20px;
}

.header-title {
  font-size: 20px;
  font-weight: 500;
}

.main-content {
  background-color: #f0f2f5;
  padding: 20px;
}
</style>
