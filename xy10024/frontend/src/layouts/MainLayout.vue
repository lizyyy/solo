<template>
  <el-container class="layout-container">
    <el-aside width="220px" class="sidebar" style="background-color: #304156;">
      <div style="padding: 20px; text-align: center; color: white; font-size: 18px; font-weight: bold;">
        <el-icon :size="20"><Monitor /></el-icon>
        设备管理
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/devices">
          <el-icon><Box /></el-icon>
          <span>设备管理</span>
        </el-menu-item>
        <el-menu-item index="/borrows">
          <el-icon><Document /></el-icon>
          <span>借用记录</span>
        </el-menu-item>
        <el-menu-item index="/my-borrows">
          <el-icon><User /></el-icon>
          <span>我的借用</span>
        </el-menu-item>
        <el-menu-item v-if="userStore.user?.role === 'admin'" index="/users">
          <el-icon><Users /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
        <el-menu-item v-if="userStore.user?.role === 'admin'" index="/audit">
          <el-icon><Timer /></el-icon>
          <span>审计日志</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header style="background: white; display: flex; justify-content: space-between; align-items: center; padding: 0 20px;">
        <div style="font-size: 18px; font-weight: bold;">
          {{ pageTitle }}
        </div>
        <div style="display: flex; align-items: center; gap: 16px;">
          <el-dropdown @command="handleCommand">
            <span style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <el-avatar :size="32" style="background: #409eff;">
                {{ userStore.user?.full_name?.charAt(0) || 'U' }}
              </el-avatar>
              <span>{{ userStore.user?.full_name }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人信息</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const activeMenu = computed(() => route.path)

const pageTitle = computed(() => {
  const titles = {
    '/dashboard': '仪表盘',
    '/devices': '设备管理',
    '/borrows': '借用记录',
    '/my-borrows': '我的借用',
    '/users': '用户管理',
    '/audit': '审计日志'
  }
  return titles[route.path] || '设备借用管理系统'
})

function handleCommand(command) {
  if (command === 'logout') {
    userStore.logout()
    router.push('/login')
  }
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
