<template>
  <div class="app-container">
    <el-container>
      <el-aside width="220px" class="sidebar">
        <div class="logo">
          <el-icon size="28" color="#409EFF"><Battery /></el-icon>
          <span>叉车充电排班</span>
        </div>
        <el-menu
          :default-active="activeMenu"
          router
          background-color="#304156"
          text-color="#bfcbd9"
          active-text-color="#409EFF"
        >
          <el-menu-item index="/dashboard">
            <el-icon><DataAnalysis /></el-icon>
            <span>异常看板</span>
          </el-menu-item>
          <el-menu-item index="/tasks">
            <el-icon><List /></el-icon>
            <span>任务管理</span>
          </el-menu-item>
          <el-menu-item index="/stations">
            <el-icon><Connection /></el-icon>
            <span>充电桩管理</span>
          </el-menu-item>
          <el-menu-item index="/batteries">
            <el-icon><Battery /></el-icon>
            <span>电池管理</span>
          </el-menu-item>
          <el-menu-item index="/waves">
            <el-icon><Timer /></el-icon>
            <span>作业波次</span>
          </el-menu-item>
          <el-menu-item index="/anomalies">
            <el-icon><Warning /></el-icon>
            <span>异常处理</span>
          </el-menu-item>
          <el-menu-item index="/import">
            <el-icon><Upload /></el-icon>
            <span>批量导入</span>
          </el-menu-item>
          <el-menu-item index="/reports">
            <el-icon><Document /></el-icon>
            <span>历史报表</span>
          </el-menu-item>
          <el-menu-item index="/history">
            <el-icon><Clock /></el-icon>
            <span>变更历史</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-container>
        <el-header class="header">
          <div class="header-left">
            <span>{{ currentPageTitle }}</span>
          </div>
          <div class="header-right">
            <el-dropdown>
              <span class="user-info">
                <el-icon><User /></el-icon>
                <span>{{ operator }}</span>
                <el-icon><ArrowDown /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="changeOperator">切换用户</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </el-header>
        <el-main class="main-content">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const operator = ref('admin')

const activeMenu = computed(() => route.path)
const currentPageTitle = computed(() => {
  const titles = {
    '/dashboard': '异常看板',
    '/tasks': '任务管理',
    '/stations': '充电桩管理',
    '/batteries': '电池管理',
    '/waves': '作业波次',
    '/anomalies': '异常处理',
    '/import': '批量导入',
    '/reports': '历史报表',
    '/history': '变更历史'
  }
  return titles[route.path] || '叉车充电排班系统'
})

const changeOperator = () => {
  const newOperator = prompt('请输入用户名:', operator.value)
  if (newOperator && newOperator.trim()) {
    operator.value = newOperator.trim()
    localStorage.setItem('operator', operator.value)
  }
}

onMounted(() => {
  const saved = localStorage.getItem('operator')
  if (saved) {
    operator.value = saved
  }
})
</script>

<style>
html, body, #app, .app-container {
  height: 100%;
  margin: 0;
  padding: 0;
}

.sidebar {
  background-color: #304156;
  height: 100%;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 16px;
  font-weight: bold;
  gap: 8px;
  border-bottom: 1px solid #263445;
}

.header {
  background-color: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.header-left {
  font-size: 18px;
  font-weight: 500;
  color: #303133;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #606266;
}

.main-content {
  background-color: #f0f2f5;
  padding: 20px;
}

.el-menu {
  border-right: none;
}
</style>
