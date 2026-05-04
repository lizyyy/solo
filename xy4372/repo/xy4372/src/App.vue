<template>
  <el-config-provider :locale="zhCn">
    <div class="app-container">
      <el-header class="app-header">
        <div class="header-content">
          <div class="logo">
            <el-icon :size="28"><Horse /></el-icon>
            <span class="title">马术俱乐部赛前预检工具</span>
          </div>
          <el-menu
            :default-active="activeMenu"
            mode="horizontal"
            router
            class="header-menu"
            background-color="transparent"
            text-color="#fff"
            active-text-color="#ffd04b"
          >
            <el-menu-item index="/sessions">
              <el-icon><List /></el-icon>
              <span>赛事管理</span>
            </el-menu-item>
            <el-menu-item v-if="currentSessionId" index="/import">
              <el-icon><Upload /></el-icon>
              <span>数据导入</span>
            </el-menu-item>
            <el-menu-item v-if="currentSessionId" index="/review">
              <el-icon><Check /></el-icon>
              <span>风险复核</span>
            </el-menu-item>
            <el-menu-item v-if="currentSessionId" index="/export">
              <el-icon><Download /></el-icon>
              <span>报告导出</span>
            </el-menu-item>
            <el-menu-item index="/settings">
              <el-icon><Setting /></el-icon>
              <span>设置</span>
            </el-menu-item>
          </el-menu>
        </div>
        <div v-if="currentSession" class="session-info">
          <el-tag size="small" type="info">
            当前赛事: {{ currentSession.name || currentSession.eventName || '未选择' }}
          </el-tag>
        </div>
      </el-header>
      <el-main class="app-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
      <el-footer class="app-footer">
        <span>马术俱乐部赛前预检工具 v1.0.0</span>
      </el-footer>
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import {
  Horse,
  List,
  Upload,
  Check,
  Download,
  Setting,
} from '@element-plus/icons-vue'
import { useAppStore } from '@/stores'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()

const activeMenu = computed(() => route.path)
const currentSessionId = computed(() => appStore.currentSessionId)
const currentSession = computed(() => appStore.currentSession)
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #f5f7fa;
}

.app-header {
  background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
  padding: 0 20px;
  height: auto !important;
  min-height: 60px;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #fff;
}

.logo .title {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 1px;
}

.header-menu {
  border-bottom: none;
  background-color: transparent !important;
}

.header-menu :deep(.el-menu-item) {
  height: 60px;
  line-height: 60px;
  border-bottom: none;
}

.header-menu :deep(.el-menu-item:hover) {
  background-color: rgba(255, 255, 255, 0.1);
}

.session-info {
  padding: 8px 0;
}

.app-main {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.app-footer {
  background-color: #fff;
  border-top: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #909399;
  font-size: 12px;
  height: 40px !important;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.page-container {
  background-color: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #ebeef5;
}

.card-section {
  margin-bottom: 24px;
}

.card-section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}

.action-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.action-bar-right {
  margin-left: auto;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-color: #f9fafc;
  border-radius: 8px;
}

.stat-card .value {
  font-size: 32px;
  font-weight: 700;
  color: #409eff;
}

.stat-card .label {
  font-size: 14px;
  color: #909399;
  margin-top: 8px;
}

.table-container {
  margin-top: 16px;
}

.upload-area {
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  transition: all 0.3s;
}

.upload-area:hover {
  border-color: #409eff;
  background-color: #f5f7fa;
}

.upload-area.dragover {
  border-color: #409eff;
  background-color: #ecf5ff;
}

.risk-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.risk-badge.critical {
  background-color: #fef2f2;
  color: #dc2626;
}

.risk-badge.high {
  background-color: #fff7ed;
  color: #ea580c;
}

.risk-badge.medium {
  background-color: #fefce8;
  color: #ca8a04;
}

.risk-badge.low {
  background-color: #eff6ff;
  color: #2563eb;
}
</style>
