<template>
  <el-config-provider :locale="zhCn">
    <el-container class="app-container">
      <el-aside width="220px" class="app-aside">
        <div class="logo">
          <el-icon :size="28"><TrendCharts /></el-icon>
          <span>股票模拟交易</span>
        </div>
        <el-menu
          :default-active="activeMenu"
          class="app-menu"
          background-color="#304156"
          text-color="#bfcbd9"
          active-text-color="#409EFF"
          router
        >
          <el-menu-item index="/dashboard">
            <el-icon><DataAnalysis /></el-icon>
            <span>总览看板</span>
          </el-menu-item>
          <el-menu-item index="/watchlist">
            <el-icon><List /></el-icon>
            <span>自选股/行情</span>
          </el-menu-item>
          <el-menu-item index="/trade-plan">
            <el-icon><Document /></el-icon>
            <span>交易计划</span>
          </el-menu-item>
          <el-menu-item index="/orders">
            <el-icon><Tickets /></el-icon>
            <span>订单流水</span>
          </el-menu-item>
          <el-menu-item index="/positions">
            <el-icon><Coin /></el-icon>
            <span>持仓看板</span>
          </el-menu-item>
          <el-menu-item index="/risk">
            <el-icon><Warning /></el-icon>
            <span>风险预警</span>
          </el-menu-item>
          <el-menu-item index="/timeline">
            <el-icon><Timer /></el-icon>
            <span>交易日时间线</span>
          </el-menu-item>
          <el-menu-item index="/review">
            <el-icon><EditPen /></el-icon>
            <span>复盘笔记</span>
          </el-menu-item>
          <el-menu-item index="/export">
            <el-icon><Download /></el-icon>
            <span>报告导出</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-container>
        <el-header class="app-header">
          <div class="header-left">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
              <el-breadcrumb-item>{{ currentPageTitle }}</el-breadcrumb-item>
            </el-breadcrumb>
          </div>
          <div class="header-right">
            <el-dropdown>
              <span class="user-info">
                <el-avatar :size="32" icon="UserFilled" />
                <span class="username">模拟交易者</span>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item>账户设置</el-dropdown-item>
                  <el-dropdown-item divided>退出</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </el-header>
        <el-main class="app-main">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </el-main>
      </el-container>
    </el-container>
  </el-config-provider>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'

const route = useRoute()

const activeMenu = computed(() => route.path)

const pageTitleMap = {
  '/dashboard': '总览看板',
  '/watchlist': '自选股/行情',
  '/trade-plan': '交易计划',
  '/orders': '订单流水',
  '/positions': '持仓看板',
  '/risk': '风险预警',
  '/timeline': '交易日时间线',
  '/review': '复盘笔记',
  '/export': '报告导出'
}

const currentPageTitle = computed(() => {
  return pageTitleMap[route.path] || '未知页面'
})
</script>

<style scoped>
.app-container {
  height: 100vh;
}

.app-aside {
  background-color: #304156;
  overflow-x: hidden;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  background-color: #263445;
}

.app-menu {
  border-right: none;
}

.app-header {
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.username {
  color: #606266;
}

.app-main {
  background-color: #f0f2f5;
  padding: 20px;
  overflow-y: auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
