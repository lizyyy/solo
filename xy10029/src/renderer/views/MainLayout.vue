<template>
  <div>
    <div class="sidebar">
      <div class="sidebar-brand">设备管理系统</div>
      <ul class="sidebar-menu">
        <li
          v-for="item in menuItems"
          :key="item.path"
          class="sidebar-menu-item"
          :class="{
            active: currentRoute === item.path,
            disabled: item.permission && !authStore.hasPermission(item.permission)
          }"
          @click="navigateTo(item)"
        >
          <span>{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </li>
      </ul>
    </div>

    <div class="main-content">
      <div class="topbar">
        <div></div>
        <div class="topbar-user">
          <span>
            <span
              class="role-badge"
              :class="{
                'role-admin': authStore.currentUser?.role === 'admin',
                'role-operator': authStore.currentUser?.role === 'operator',
                'role-user': authStore.currentUser?.role === 'user'
              }"
            >
              {{ roleLabel }}
            </span>
            <span class="topbar-username" style="margin-left: 8px;">
              {{ authStore.currentUser?.displayName }}
            </span>
          </span>
          <button class="btn btn-default btn-sm" @click="handleLogout">退出</button>
        </div>
      </div>

      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useToastStore } from '../stores/toast'
import { Permission, UserRole } from '@shared/types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const toastStore = useToastStore()

interface MenuItem {
  path: string
  label: string
  icon: string
  permission?: Permission
}

const menuItems: MenuItem[] = [
  { path: '/dashboard', label: '仪表盘', icon: '📊' },
  { path: '/devices', label: '设备管理', icon: '📦', permission: Permission.VIEW_DEVICES },
  { path: '/borrows', label: '借出记录', icon: '📋', permission: Permission.VIEW_HISTORY },
  { path: '/batch', label: '批量操作', icon: '⚡', permission: Permission.BATCH_OPERATIONS },
  { path: '/logs', label: '系统日志', icon: '📝', permission: Permission.VIEW_LOGS },
  { path: '/retry', label: '重试队列', icon: '🔄', permission: Permission.SYSTEM_SETTINGS },
  { path: '/users', label: '用户管理', icon: '👥', permission: Permission.MANAGE_USERS }
]

const currentRoute = computed(() => route.path)

const roleLabel = computed(() => {
  const role = authStore.currentUser?.role
  switch (role) {
    case UserRole.ADMIN:
      return '管理员'
    case UserRole.OPERATOR:
      return '操作员'
    case UserRole.USER:
      return '普通用户'
    default:
      return ''
  }
})

function navigateTo(item: MenuItem) {
  if (item.permission && !authStore.hasPermission(item.permission)) {
    toastStore.error('您没有权限访问此页面')
    return
  }
  router.push(item.path)
}

function handleLogout() {
  authStore.logout()
  toastStore.info('已退出登录')
  router.push('/login')
}
</script>
