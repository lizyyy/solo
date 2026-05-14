<template>
  <a-layout style="min-height: 100vh">
    <a-layout-sider v-model:collapsed="collapsed" collapsible>
      <div class="logo">
        <h2 v-if="!collapsed">OAuth 授权撤回中心</h2>
        <h2 v-else>OAuth</h2>
      </div>
      <a-menu v-model:selectedKeys="selectedKeys" mode="inline" theme="dark">
        <a-menu-item key="/">
          <template #icon><DashboardOutlined /></template>
          <span>仪表盘</span>
        </a-menu-item>
        <a-menu-item key="/applications">
          <template #icon><AppstoreOutlined /></template>
          <span>应用管理</span>
        </a-menu-item>
        <a-menu-item key="/tokens">
          <template #icon><KeyOutlined /></template>
          <span>令牌管理</span>
        </a-menu-item>
        <a-menu-item key="/revocations">
          <template #icon><StopOutlined /></template>
          <span>撤回记录</span>
        </a-menu-item>
        <a-menu-item key="/tasks">
          <template #icon><ScheduleOutlined /></template>
          <span>任务管理</span>
        </a-menu-item>
        <a-menu-item key="/audit">
          <template #icon><FileTextOutlined /></template>
          <span>审计日志</span>
        </a-menu-item>
      </a-menu>
    </a-layout-sider>
    <a-layout>
      <a-layout-header class="header">
        <div class="header-title">OAuth 授权撤回中心控制台</div>
      </a-layout-header>
      <a-layout-content class="content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  DashboardOutlined, AppstoreOutlined, KeyOutlined,
  StopOutlined, ScheduleOutlined, FileTextOutlined
} from '@ant-design/icons-vue'

const router = useRouter()
const route = useRoute()
const collapsed = ref(false)
const selectedKeys = ref([route.path])

watch(() => route.path, (newPath) => {
  selectedKeys.value = [newPath]
})
</script>

<style scoped>
.logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(24, 144, 255, 0.2);
}
.logo h2 {
  color: white;
  margin: 0;
  font-size: 16px;
}
.header {
  background: #fff;
  padding: 0 24px;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.header-title {
  font-size: 20px;
  font-weight: 500;
}
.content {
  margin: 24px;
  background: #fff;
  padding: 24px;
  border-radius: 8px;
  min-height: calc(100vh - 112px);
}
</style>
