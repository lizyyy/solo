<template>
  <div class="app-container">
    <header class="app-header">
      <h1>设备借用管理系统</h1>
      <div class="user-info">
        <el-tag type="info">演示用户</el-tag>
      </div>
    </header>
    <div class="app-content">
      <aside class="app-sidebar">
        <el-menu
          :default-active="currentRoute"
          router
          background-color="#f5f7fa"
          text-color="#303133"
          active-text-color="#409eff"
        >
          <el-menu-item index="/devices">
            <el-icon><Monitor /></el-icon>
            <span>设备管理</span>
          </el-menu-item>
          <el-menu-item index="/borrow">
            <el-icon><Document /></el-icon>
            <span>借用记录</span>
          </el-menu-item>
          <el-menu-item index="/audit">
            <el-icon><Clock /></el-icon>
            <span>操作日志</span>
          </el-menu-item>
          <el-menu-item index="/reports">
            <el-icon><DataAnalysis /></el-icon>
            <span>报表导出</span>
          </el-menu-item>
        </el-menu>
      </aside>
      <main class="app-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const currentRoute = computed(() => route.path)
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.user-info {
  display: flex;
  align-items: center;
}
</style>
