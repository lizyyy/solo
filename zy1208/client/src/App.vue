<template>
  <el-config-provider :locale="zhCn">
    <div class="app-container">
      <el-container>
        <el-header class="app-header">
          <div class="header-content">
            <div class="logo">
              <el-icon :size="28" color="#409EFF"><DataAnalysis /></el-icon>
              <span class="app-title">数据库性能调优演练台</span>
            </div>
            <el-menu
              :default-active="activeMenu"
              mode="horizontal"
              background-color="transparent"
              text-color="#303133"
              active-text-color="#409EFF"
              router
            >
              <el-menu-item index="/">
                <el-icon><House /></el-icon>
                <span>演练列表</span>
              </el-menu-item>
              <el-menu-item index="/create">
                <el-icon><Plus /></el-icon>
                <span>新建演练</span>
              </el-menu-item>
            </el-menu>
          </div>
        </el-header>
        
        <el-main class="app-main">
          <router-view />
        </el-main>
        
        <el-footer class="app-footer">
          <span>数据库性能调优演练台 v1.0.0</span>
        </el-footer>
      </el-container>
    </div>
  </el-config-provider>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'

const route = useRoute()

const activeMenu = computed(() => {
  if (route.path.includes('/drill/')) {
    return '/'
  }
  return route.path
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

#app {
  height: 100%;
}

.app-container {
  height: 100%;
}

.el-container {
  height: 100%;
}

.app-header {
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 0;
  height: 60px !important;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.app-main {
  background: #f5f7fa;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  padding: 20px;
}

.app-footer {
  background: #fff;
  text-align: center;
  color: #909399;
  font-size: 12px;
  line-height: 40px;
  height: 40px !important;
}

.el-menu--horizontal > .el-menu-item {
  border-bottom: none !important;
  height: 60px;
  line-height: 60px;
}
</style>
