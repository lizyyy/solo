<template>
  <div id="app">
    <el-container class="app-container">
      <el-header class="app-header">
        <div class="header-content">
          <h1 class="app-title">盲文教材转印放行工具</h1>
          <div class="header-right">
            <el-tag type="info" size="large">
              <el-icon class="mr-1"><Clock /></el-icon>
              {{ currentTime }}
            </el-tag>
          </div>
        </div>
      </el-header>
      
      <el-container>
        <el-aside width="220px" class="app-aside">
          <el-menu
            :default-active="activeMenu"
            class="aside-menu"
            router
            background-color="#304156"
            text-color="#bfcbd9"
            active-text-color="#409EFF"
          >
            <el-menu-item index="/">
              <el-icon><HomeFilled /></el-icon>
              <span>首页概览</span>
            </el-menu-item>
            <el-menu-item index="/import">
              <el-icon><UploadFilled /></el-icon>
              <span>数据导入</span>
            </el-menu-item>
            <el-menu-item index="/risks">
              <el-icon><WarningFilled /></el-icon>
              <span>风险检测</span>
            </el-menu-item>
            <el-menu-item index="/review">
              <el-icon><EditPen /></el-icon>
              <span>复核处理</span>
            </el-menu-item>
            <el-menu-item index="/export">
              <el-icon><Download /></el-icon>
              <span>导出放行</span>
            </el-menu-item>
          </el-menu>
        </el-aside>
        
        <el-main class="app-main">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

export default {
  name: 'App',
  setup() {
    const route = useRoute()
    const currentTime = ref('')
    let timer = null

    const activeMenu = computed(() => {
      return route.path
    })

    const updateTime = () => {
      const now = new Date()
      currentTime.value = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    }

    onMounted(() => {
      updateTime()
      timer = setInterval(updateTime, 1000)
    })

    onUnmounted(() => {
      if (timer) {
        clearInterval(timer)
      }
    })

    return {
      currentTime,
      activeMenu
    }
  }
}
</script>

<style lang="scss">
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: #f0f2f5;
}

#app {
  width: 100%;
  height: 100vh;
}

.app-container {
  height: 100%;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 100;
}

.header-content {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.app-title {
  color: white;
  font-size: 22px;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.app-aside {
  background-color: #304156;
  border-right: 1px solid #e4e7ed;
}

.aside-menu {
  border-right: none;
  height: 100%;
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

.mr-1 {
  margin-right: 4px;
}
</style>
