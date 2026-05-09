<template>
  <el-container class="app-container">
    <el-header class="app-header">
      <div class="header-content">
        <div class="logo">
          <el-icon :size="24" color="#409eff"><Document /></el-icon>
          <span class="title">外包交付验收门户</span>
        </div>
        <div class="header-actions">
          <el-button @click="handleExportOverview" :icon="Download" :loading="exportLoading">
            导出总览报告
          </el-button>
          <el-button @click="handleRefresh" :icon="Refresh">
            刷新
          </el-button>
        </div>
      </div>
    </el-header>
    <el-main class="app-main">
      <router-view ref="currentView" />
    </el-main>
  </el-container>
</template>

<script setup>
import { ref } from 'vue'
import { Document, Download, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { exportOverviewReport } from './api/reports'

const currentView = ref(null)
const exportLoading = ref(false)

async function handleExportOverview() {
  if (exportLoading.value) return
  exportLoading.value = true
  try {
    const response = await exportOverviewReport()
    const blob = new Blob([response.data], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = '项目验收总览.xlsx'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败：' + (error.message || '未知错误'))
  } finally {
    exportLoading.value = false
  }
}

function handleRefresh() {
  if (currentView.value) {
    if (typeof currentView.value.loadProjects === 'function') {
      currentView.value.loadProjects()
      ElMessage.success('已刷新')
    } else if (typeof currentView.value.loadData === 'function') {
      currentView.value.loadData()
      ElMessage.success('已刷新')
    } else {
      ElMessage.success('已刷新')
    }
  } else {
    location.reload()
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
  width: 100%;
  height: 100%;
}

.app-container {
  height: 100vh;
  background-color: #f5f7fa;
}

.app-header {
  background-color: #fff;
  border-bottom: 1px solid #e4e7ed;
  padding: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  height: 100%;
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

.title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.app-main {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
  width: 100%;
}
</style>