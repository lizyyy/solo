<template>
  <el-container class="app-container">
    <el-aside width="220px" class="sidebar">
      <div class="logo">
        <el-icon :size="24" color="#409eff"><Stethoscope /></el-icon>
        <span class="title">牙科耗材补货台</span>
      </div>
      
      <el-menu
        :default-active="activeMenu"
        router
        class="nav-menu"
        background-color="#1f2937"
        text-color="#9ca3af"
        active-text-color="#fff"
      >
        <el-menu-item v-for="route in menuRoutes" :key="route.path" :index="route.path">
          <el-icon><component :is="route.meta.icon" /></el-icon>
          <template #title>{{ route.meta.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>
    
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-tag type="info" effect="plain" size="small">
            操作员: {{ operator }}
          </el-tag>
          <el-select v-model="operator" size="small" style="width: 120px; margin-left: 8px;">
            <el-option v-for="op in operators" :key="op" :label="op" :value="op" />
          </el-select>
        </div>
      </el-header>
      
      <el-main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :operator="operator" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import router from './router';

const route = useRoute();

const operator = ref('护士小王');
const operators = ['护士小王', '护士长', '库管小李', '医生小张'];

const menuRoutes = router.options.routes.filter(r => r.path !== '/:pathMatch(.*)*');
const activeMenu = computed(() => route.path);
const currentTitle = computed(() => route.meta.title || '工作台');
</script>

<style scoped>
.app-container {
  height: 100vh;
}

.sidebar {
  background-color: #1f2937;
  display: flex;
  flex-direction: column;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-bottom: 1px solid #374151;
  color: #fff;
}

.logo .title {
  font-size: 16px;
  font-weight: 600;
}

.nav-menu {
  border-right: none;
  flex: 1;
}

:deep(.el-menu-item) {
  height: 48px;
  line-height: 48px;
}

.header {
  background-color: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.header-right {
  display: flex;
  align-items: center;
}

.main-content {
  background-color: #f3f4f6;
  padding: 24px;
  overflow-y: auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
