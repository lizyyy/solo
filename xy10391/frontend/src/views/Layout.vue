<template>
  <el-container class="layout-container">
    <el-aside width="220px" class="sidebar">
      <div class="logo">
        <el-icon size="24" class="logo-icon"><Document /></el-icon>
        <span class="logo-text">会费管理系统</span>
      </div>
      
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
        class="sidebar-menu"
      >
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-icon><User /></el-icon>
              <span>{{ userStore.userInfo?.realName }}</span>
              <el-tag :type="roleTagType" size="small">{{ userStore.roleName }}</el-tag>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
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
</template>

<script setup>
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();

const activeMenu = computed(() => {
  const path = route.path;
  if (path.startsWith('/members/')) return '/members';
  return path;
});

const currentTitle = computed(() => route.meta.title || '');

const menuItems = computed(() => {
  const items = [
    { path: '/dashboard', title: '工作总览', icon: 'Odometer', roles: ['admin', 'manager', 'staff'] },
    { path: '/members', title: '会员管理', icon: 'User', roles: ['admin', 'manager', 'staff'] },
    { path: '/payments', title: '缴费记录', icon: 'Money', roles: ['admin', 'manager', 'staff'] },
    { path: '/reductions', title: '减免审批', icon: 'Discount', roles: ['admin', 'manager', 'staff'] },
    { path: '/fee-rules', title: '会费规则', icon: 'Tickets', roles: ['admin', 'manager'] },
    { path: '/reports', title: '年度报表', icon: 'DataLine', roles: ['admin', 'manager', 'staff'] }
  ];
  
  return items.filter(item => item.roles.includes(userStore.role));
});

const roleTagType = computed(() => {
  const map = {
    admin: 'danger',
    manager: 'warning',
    staff: 'info'
  };
  return map[userStore.role] || 'info';
});

function handleCommand(command) {
  if (command === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      userStore.logout();
      router.push('/login');
    }).catch(() => {});
  }
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.sidebar {
  background-color: #304156;
  overflow: hidden;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #2b3a4a;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
}

.logo-icon {
  margin-right: 8px;
  color: #409EFF;
}

.logo-text {
  white-space: nowrap;
}

.sidebar-menu {
  border-right: none;
}

.header {
  background-color: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  cursor: pointer;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 4px;
}

.user-info:hover {
  background-color: #f5f7fa;
}

.main-content {
  background-color: #f0f2f5;
  padding: 20px;
  overflow-y: auto;
}
</style>
