<template>
  <div class="app-container">
    <el-container style="height: 100vh">
      <el-aside width="220px" style="background-color: #001529">
        <div class="logo">
          <h2 style="color: #fff; margin: 0; padding: 20px; text-align: center">
            摊位管理系统
          </h2>
        </div>
        <el-menu
          :default-active="activeMenu"
          class="el-menu-vertical-demo"
          background-color="#001529"
          text-color="rgba(255,255,255,0.65)"
          active-text-color="#1890ff"
          router
        >
          <el-menu-item index="/">
            <el-icon><HomeFilled /></el-icon>
            <span>数据看板</span>
          </el-menu-item>
          
          <el-sub-menu index="1">
            <template #title>
              <el-icon><Shop /></el-icon>
              <span>基础资料</span>
            </template>
            <el-menu-item index="/booths">摊位管理</el-menu-item>
            <el-menu-item index="/merchants">商户管理</el-menu-item>
            <el-menu-item index="/schedules">档期管理</el-menu-item>
          </el-sub-menu>
          
          <el-menu-item index="/applications">
            <el-icon><Document /></el-icon>
            <span>商户申请</span>
          </el-menu-item>
          
          <el-menu-item index="/deposits">
            <el-icon><Wallet /></el-icon>
            <span>押金流水</span>
          </el-menu-item>
          
          <el-menu-item index="/electricity">
            <el-icon><Lightning /></el-icon>
            <span>用电审批</span>
          </el-menu-item>
          
          <el-menu-item index="/acceptance">
            <el-icon><Check /></el-icon>
            <span>入场撤场验收</span>
          </el-menu-item>
          
          <el-sub-menu index="2">
            <template #title>
              <el-icon><DataLine /></el-icon>
              <span>报表中心</span>
            </template>
            <el-menu-item index="/reports/calendar">摊位日历</el-menu-item>
            <el-menu-item index="/reports/electricity-risk">用电风险</el-menu-item>
            <el-menu-item index="/reports/income">收入报表</el-menu-item>
            <el-menu-item index="/reports/deduction">扣款明细</el-menu-item>
          </el-sub-menu>
        </el-menu>
      </el-aside>
      
      <el-container>
        <el-header style="background-color: #fff; border-bottom: 1px solid #e8e8e8; display: flex; align-items: center; justify-content: space-between">
          <div style="font-size: 18px; font-weight: 500">{{ currentTitle }}</div>
          <div style="display: flex; align-items: center; gap: 16px">
            <el-tag type="success">管理员</el-tag>
            <el-avatar :size="32" icon="UserFilled" />
          </div>
        </el-header>
        <el-main style="background-color: #f0f2f5">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const activeMenu = computed(() => route.path);

const currentTitle = computed(() => {
  const titleMap = {
    '/': '数据看板',
    '/booths': '摊位管理',
    '/merchants': '商户管理',
    '/schedules': '档期管理',
    '/applications': '商户申请',
    '/deposits': '押金流水',
    '/electricity': '用电审批',
    '/acceptance': '入场撤场验收',
    '/reports/calendar': '摊位日历',
    '/reports/electricity-risk': '用电风险',
    '/reports/income': '收入报表',
    '/reports/deduction': '扣款明细'
  };
  return titleMap[route.path] || '商场临时摊位管理系统';
});
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  margin: 0;
  padding: 0;
}

.el-menu-vertical-demo:not(.el-menu--collapse) {
  width: 220px;
  min-height: 400px;
}
</style>