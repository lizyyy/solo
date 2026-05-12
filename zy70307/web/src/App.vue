<template>
  <el-container class="app-container">
    <el-aside width="220px" class="app-aside">
      <div class="logo">
        <el-icon><Monitor /></el-icon>
        <span>限流策略台</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#001529"
        text-color="#bfcbd9"
        active-text-color="#409eff"
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <span>总览</span>
        </el-menu-item>
        <el-menu-item index="/tenants">
          <el-icon><User /></el-icon>
          <span>租户管理</span>
        </el-menu-item>
        <el-menu-item index="/interface-groups">
          <el-icon><Grid /></el-icon>
          <span>接口分组</span>
        </el-menu-item>
        <el-menu-item index="/rules">
          <el-icon><Setting /></el-icon>
          <span>规则管理</span>
        </el-menu-item>
        <el-menu-item index="/releases">
          <el-icon><Upload /></el-icon>
          <span>发布批次</span>
        </el-menu-item>
        <el-menu-item index="/preview">
          <el-icon><VideoPlay /></el-icon>
          <span>策略预演</span>
        </el-menu-item>
        <el-menu-item index="/hit-logs">
          <el-icon><Document /></el-icon>
          <span>命中日志</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="app-header">
        <div class="header-title">
          <el-badge v-if="currentRelease" :value="currentRelease.version" type="success" class="release-badge">
            <span>当前生效: {{ currentRelease.name }}</span>
          </el-badge>
          <span v-else class="no-release">当前无激活策略</span>
        </div>
        <div class="header-actions">
          <el-button type="primary" size="small" @click="refreshCurrentRelease">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </el-header>
      <el-main class="app-main">
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
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { releasesApi } from './api';

const route = useRoute();
const currentRelease = ref(null);

const activeMenu = computed(() => route.path);

async function refreshCurrentRelease() {
  try {
    const res = await releasesApi.current();
    currentRelease.value = res.data;
  } catch (err) {
    ElMessage.error(err.message);
  }
}

onMounted(() => {
  refreshCurrentRelease();
});
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
}

.app-container {
  height: 100%;
}

.app-aside {
  background-color: #001529;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 100;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  border-bottom: 1px solid #1f2f3d;
}

.logo .el-icon {
  margin-right: 8px;
  font-size: 24px;
}

.el-menu {
  border-right: none;
}

.app-container > el-container {
  margin-left: 220px;
  min-height: 100vh;
}

.app-header {
  background-color: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 60px;
  position: sticky;
  top: 0;
  z-index: 50;
}

.header-title {
  font-size: 16px;
  font-weight: 500;
}

.release-badge {
  margin-right: 8px;
}

.no-release {
  color: #909399;
  font-style: italic;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.app-main {
  background-color: #f5f7fa;
  min-height: calc(100vh - 60px);
  padding: 24px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.page-card {
  background-color: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.page-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.page-actions {
  display: flex;
  gap: 12px;
}

.status-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.tag-draft { background: #f4f4f5; color: #909399; }
.tag-active { background: #f0f9eb; color: #67c23a; }
.tag-pending { background: #fdf6ec; color: #e6a23c; }
.tag-paused { background: #f4f4f5; color: #909399; }
.tag-deprecated { background: #fef0f0; color: #f56c6c; }
.tag-rolled-back { background: #fef0f0; color: #f56c6c; }

.tag-allow { background: #f0f9eb; color: #67c23a; }
.tag-rate-limited { background: #fdf6ec; color: #e6a23c; }
.tag-rejected { background: #fef0f0; color: #f56c6c; }

.stat-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 24px;
  color: #fff;
}

.stat-card.green {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

.stat-card.orange {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-card.blue {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-value {
  font-size: 36px;
  font-weight: bold;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
}

.expand-detail {
  background: #fafafa;
  padding: 16px;
  border-radius: 8px;
  margin-top: 8px;
}

.expand-detail p {
  margin: 4px 0;
  color: #606266;
  font-size: 13px;
}

.rule-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  background: #fff;
  transition: all 0.3s;
}

.rule-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.rule-name {
  font-size: 16px;
  font-weight: 600;
}

.rule-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  color: #909399;
  font-size: 13px;
}
</style>
