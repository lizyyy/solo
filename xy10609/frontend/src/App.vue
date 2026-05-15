<template>
  <el-container style="height: 100vh">
    <el-aside width="200px" style="background-color: #2c3e50">
      <div style="padding: 20px; color: white; font-size: 16px; font-weight: bold">
        政务材料预审补正
      </div>
      <el-menu
        :default-active="$route.path"
        class="el-menu-vertical-demo"
        background-color="#2c3e50"
        text-color="#fff"
        active-text-color="#ffd04b"
        router
      >
        <el-menu-item index="/">
          <el-icon><data-line /></el-icon>
          <span>数据概览</span>
        </el-menu-item>
        <el-menu-item index="/pre-review">
          <el-icon><calculator /></el-icon>
          <span>预审补正计算</span>
        </el-menu-item>
        <el-menu-item index="/matters">
          <el-icon><document /></el-icon>
          <span>办事事项</span>
        </el-menu-item>
        <el-menu-item index="/identity">
          <el-icon><user /></el-icon>
          <span>身份类型</span>
        </el-menu-item>
        <el-menu-item index="/attachments">
          <el-icon><paperclip /></el-icon>
          <span>附件管理</span>
        </el-menu-item>
        <el-menu-item index="/correction-opinions">
          <el-icon><edit /></el-icon>
          <span>补正意见</span>
        </el-menu-item>
        <el-menu-item index="/window-acceptances">
          <el-icon><office-building /></el-icon>
          <span>窗口受理</span>
        </el-menu-item>
        <el-menu-item index="/gaps">
          <el-icon><warning /></el-icon>
          <span>材料缺口</span>
        </el-menu-item>
        <el-menu-item index="/exceptions">
          <el-icon><circle-close /></el-icon>
          <span>异常看板</span>
        </el-menu-item>
        <el-menu-item index="/report">
          <el-icon><download /></el-icon>
          <span>报表导出</span>
        </el-menu-item>
        <el-menu-item index="/history">
          <el-icon><clock /></el-icon>
          <span>变更历史</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header style="background-color: #fff; border-bottom: 1px solid #eee; line-height: 60px; padding: 0 20px">
        <h2 style="margin: 0">{{ pageTitle }}</h2>
      </el-header>
      <el-main style="background-color: #f5f5f5; overflow-y: auto">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const pageTitle = computed(() => {
  const titles = {
    '/': '数据概览',
    '/pre-review': '预审补正计算',
    '/matters': '办事事项管理',
    '/identity': '身份类型管理',
    '/attachments': '附件管理',
    '/correction-opinions': '补正意见管理',
    '/window-acceptances': '窗口受理管理',
    '/gaps': '材料缺口管理',
    '/exceptions': '异常看板',
    '/report': '报表导出',
    '/history': '变更历史'
  }
  return titles[route.path] || '政务材料预审补正系统'
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
</style>
