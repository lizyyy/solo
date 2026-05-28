<template>
  <div class="app-container">
    <el-container class="main-container">
      <el-header class="header">
        <div class="header-left">
          <el-icon class="logo-icon"><Tickets /></el-icon>
          <h1 class="title">发票红冲额度回补系统</h1>
        </div>
        <div class="header-right">
          <el-tag type="info">供应链平台 v1.0</el-tag>
        </div>
      </el-header>
      <el-container>
        <el-aside width="220px" class="aside">
          <el-menu
            :default-active="activeMenu"
            router
            class="sidebar-menu"
            background-color="#001529"
            text-color="#fff"
            active-text-color="#409eff"
          >
            <el-menu-item index="/dashboard">
              <el-icon><DataAnalysis /></el-icon>
              <span>数据概览</span>
            </el-menu-item>
            <el-menu-item index="/invoices">
              <el-icon><Document /></el-icon>
              <span>发票管理</span>
            </el-menu-item>
            <el-menu-item index="/redemption">
              <el-icon><RefreshLeft /></el-icon>
              <span>红冲申请</span>
            </el-menu-item>
            <el-menu-item index="/credit">
              <el-icon><Wallet /></el-icon>
              <span>授信额度</span>
            </el-menu-item>
            <el-menu-item index="/payment">
              <el-icon><Money /></el-icon>
              <span>回款流水</span>
            </el-menu-item>
            <el-menu-item index="/audit">
              <el-icon><Files /></el-icon>
              <span>审计导出</span>
            </el-menu-item>
          </el-menu>
        </el-aside>
        <el-main class="main-content">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const activeMenu = computed(() => route.path)
</script>

<style lang="scss">
.app-container {
  height: 100%;
  width: 100%;
}

.main-container {
  height: 100%;
}

.header {
  background: linear-gradient(90deg, #001529 0%, #002140 100%);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  height: 60px !important;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .logo-icon {
      font-size: 28px;
      color: #409eff;
    }

    .title {
      color: #fff;
      font-size: 20px;
      font-weight: 500;
      margin: 0;
    }
  }
}

.aside {
  background: #001529;
  height: calc(100vh - 60px);
}

.sidebar-menu {
  border-right: none;
}

.main-content {
  background: #f0f2f5;
  padding: 20px;
  overflow-y: auto;
}
</style>
