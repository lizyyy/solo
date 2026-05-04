<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSessionStore } from '@/stores/session'

const router = useRouter()
const route = useRoute()
const sessionStore = useSessionStore()

const currentPath = computed(() => route.name)

const navItems = [
  { name: 'Import', label: '数据导入', icon: 'Upload' },
  { name: 'Check', label: '自动检测', icon: 'Search' },
  { name: 'Review', label: '本地复核', icon: 'Edit' },
  { name: 'Export', label: '导出结果', icon: 'Download' },
]

function getStepStatus(itemName: string) {
  const statuses = ['Import', 'Check', 'Review', 'Export']
  const currentIndex = statuses.indexOf(currentPath.value as string)
  const itemIndex = statuses.indexOf(itemName)
  
  if (itemIndex < currentIndex) return 'finished'
  if (itemIndex === currentIndex) return 'active'
  return 'pending'
}

function navigateTo(name: string) {
  const sessionId = sessionStore.currentSession?.id
  if (sessionId) {
    router.push(`/session/${sessionId}/${name.toLowerCase()}`)
  }
}

function goHome() {
  sessionStore.clearCurrentSession()
  router.push('/')
}
</script>

<template>
  <div class="session-view">
    <header class="session-header">
      <div class="header-left">
        <el-button link @click="goHome" class="back-btn">
          <el-icon><ArrowLeft /></el-icon>
          返回首页
        </el-button>
        <div class="session-info">
          <h2 class="session-name">{{ sessionStore.currentSession?.name || '未命名会话' }}</h2>
          <span class="session-date">{{ sessionStore.currentSession?.date }}</span>
        </div>
      </div>
      <div class="header-right">
        <el-tag v-if="sessionStore.samples.length > 0" type="info">
          {{ sessionStore.samples.length }} 件样品
        </el-tag>
        <el-tag v-if="sessionStore.issues.length > 0" type="warning">
          {{ sessionStore.issues.length }} 个问题
        </el-tag>
      </div>
    </header>

    <nav class="steps-nav">
      <el-steps :active="navItems.findIndex(item => item.name === currentPath) + 1" align-center>
        <el-step
          v-for="item in navItems"
          :key="item.name"
          :title="item.label"
          :status="getStepStatus(item.name)"
          @click.native="navigateTo(item.name)"
          class="step-item"
        />
      </el-steps>
    </nav>

    <main class="session-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.session-view {
  min-height: 100vh;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;
}

.session-header {
  background: white;
  border-bottom: 1px solid #e4e7ed;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  padding: 8px 0;
  font-size: 14px;
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.session-name {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 0;
}

.session-date {
  font-size: 13px;
  color: #909399;
}

.header-right {
  display: flex;
  gap: 12px;
}

.steps-nav {
  background: white;
  padding: 20px 40px;
  border-bottom: 1px solid #e4e7ed;
}

.session-content {
  flex: 1;
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.step-item {
  cursor: pointer;
}
</style>
