<template>
  <el-config-provider :locale="zhCn">
    <el-container class="app-container">
      <el-aside width="220px" class="sidebar">
        <div class="logo">
          <el-icon size="32" color="#667eea"><Brush /></el-icon>
          <span class="logo-text">手作工作室</span>
        </div>
        <el-menu
          :default-active="activeMenu"
          class="sidebar-menu"
          router
          background-color="#1a1a2e"
          text-color="#b1b1c0"
          active-text-color="#667eea"
        >
          <el-menu-item index="/">
            <el-icon><DataAnalysis /></el-icon>
            <span>运营看板</span>
          </el-menu-item>
          
          <el-sub-menu index="material">
            <template #title>
              <el-icon><Box /></el-icon>
              <span>材料管理</span>
            </template>
            <el-menu-item index="/materials">材料列表</el-menu-item>
            <el-menu-item index="/material-batches">材料批次</el-menu-item>
            <el-menu-item index="/suppliers">供应商管理</el-menu-item>
          </el-sub-menu>
          
          <el-menu-item index="/products">
            <el-icon><Goods /></el-icon>
            <span>产品管理</span>
          </el-menu-item>
          
          <el-menu-item index="/recipes">
            <el-icon><Document /></el-icon>
            <span>配方管理</span>
          </el-menu-item>
          
          <el-menu-item index="/production">
            <el-icon><Tools /></el-icon>
            <span>生产管理</span>
          </el-menu-item>
          
          <el-menu-item index="/orders">
            <el-icon><Order /></el-icon>
            <span>订单管理</span>
          </el-menu-item>
          
          <el-menu-item index="/customers">
            <el-icon><User /></el-icon>
            <span>客户管理</span>
          </el-menu-item>
          
          <el-sub-menu index="tools">
            <template #title>
              <el-icon><Setting /></el-icon>
              <span>工具</span>
            </template>
            <el-menu-item index="/import">数据导入</el-menu-item>
          </el-sub-menu>
        </el-menu>
      </el-aside>
      
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-config-provider>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

const route = useRoute()

const activeMenu = computed(() => route.path)
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
}

.app-container {
  height: 100%;
}

.sidebar {
  background-color: #1a1a2e;
  overflow-x: hidden;
  overflow-y: auto;
}

.logo {
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid #2d2d4a;
}

.logo-text {
  margin-left: 12px;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.sidebar-menu {
  border-right: none;
}

.sidebar-menu .el-menu-item,
.sidebar-menu .el-sub-menu__title {
  height: 50px;
  line-height: 50px;
}

.main-content {
  background-color: #f5f7fa;
  padding: 20px;
  overflow-y: auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.card-content {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
}

.search-bar {
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.search-bar .el-input {
  width: 200px;
}

.search-bar .el-select {
  width: 150px;
}

.table-actions {
  display: flex;
  gap: 8px;
}

.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.warning-badge {
  margin-left: 8px;
}

.form-section {
  margin-bottom: 24px;
}

.form-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #ebeef5;
}

.form-row {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.form-row .el-form-item {
  margin-bottom: 18px;
}

.danger-text {
  color: #f56c6c;
}

.success-text {
  color: #67c23a;
}

.warning-text {
  color: #e6a23c;
}

.info-text {
  color: #409eff;
}

.stats-card {
  text-align: center;
  padding: 20px;
}

.stats-card .el-statistic__content {
  margin-top: 8px;
}

.stats-card .el-statistic__number {
  font-size: 28px;
  font-weight: 600;
}

.stats-card .el-statistic__head {
  color: #909399;
  font-size: 14px;
  margin-bottom: 4px;
}

.quick-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.dashboard-section {
  margin-bottom: 24px;
}

.dashboard-section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
}

.risk-card {
  border-left: 4px solid;
  margin-bottom: 12px;
}

.risk-card.warning {
  border-left-color: #e6a23c;
}

.risk-card.danger {
  border-left-color: #f56c6c;
}

.risk-card.success {
  border-left-color: #67c23a;
}

.timeline-item {
  padding-bottom: 20px;
}

.import-section {
  margin-bottom: 24px;
}

.template-example {
  background: #f5f7fa;
  padding: 16px;
  border-radius: 8px;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  overflow-x: auto;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.quote-preview {
  background: #f5f7fa;
  padding: 16px;
  border-radius: 8px;
  margin-top: 16px;
}

.quote-preview .summary-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #ebeef5;
}

.quote-preview .summary-row:last-child {
  border-bottom: none;
  font-weight: 600;
  font-size: 16px;
}
</style>
