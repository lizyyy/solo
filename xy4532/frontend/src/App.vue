<template>
  <el-config-provider :locale="zhCn">
    <div class="app-container">
      <el-container style="height: 100vh">
        <el-aside :width="sidebarCollapsed ? '64px' : '220px'" class="sidebar">
          <div class="logo">
            <el-icon :size="28" color="#409eff"><Promotion /></el-icon>
            <span v-show="!sidebarCollapsed" class="logo-text">海上风电运维</span>
          </div>
          <el-menu
            :default-active="currentRoute"
            :collapse="sidebarCollapsed"
            :router="true"
            background-color="#304156"
            text-color="#bfcbd9"
            active-text-color="#409eff"
            class="sidebar-menu"
          >
            <el-menu-item index="/dashboard">
              <el-icon><DataLine /></el-icon>
              <template #title>仪表盘</template>
            </el-menu-item>
            
            <el-menu-item index="/turbines">
              <el-icon><Cpu /></el-icon>
              <template #title>风机管理</template>
            </el-menu-item>
            
            <el-menu-item index="/inspections">
              <el-icon><Document /></el-icon>
              <template #title>巡检管理</template>
            </el-menu-item>
            
            <el-menu-item index="/risk-assessments">
              <el-icon><Warning /></el-icon>
              <template #title>风险评估</template>
            </el-menu-item>
            
            <el-sub-menu index="data">
              <template #title>
                <el-icon><DataBox /></el-icon>
                <span>数据管理</span>
              </template>
              <el-menu-item index="/data-import">
                <el-icon><Upload /></el-icon>
                <template #title>数据导入</template>
              </el-menu-item>
              <el-menu-item index="/data-export">
                <el-icon><Download /></el-icon>
                <template #title>数据导出</template>
              </el-menu-item>
              <el-menu-item index="/alarms">
                <el-icon><Bell /></el-icon>
                <template #title>SCADA告警</template>
              </el-menu-item>
              <el-menu-item index="/work-orders">
                <el-icon><List /></el-icon>
                <template #title>维修工单</template>
              </el-menu-item>
            </el-sub-menu>
          </el-menu>
        </el-aside>
        
        <el-container>
          <el-header class="header">
            <div class="header-left">
              <el-icon 
                class="collapse-btn" 
                @click="toggleSidebar"
                :size="20"
              >
                <Fold v-if="!sidebarCollapsed" />
                <Expand v-else />
              </el-icon>
              <el-breadcrumb separator="/">
                <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
                <el-breadcrumb-item v-if="currentRoute !== '/dashboard'">
                  {{ currentPageTitle }}
                </el-breadcrumb-item>
              </el-breadcrumb>
            </div>
            <div class="header-right">
              <el-tooltip content="初始化示例数据" placement="bottom">
                <el-button type="primary" link @click="initSampleData">
                  <el-icon><MagicStick /></el-icon>
                  初始化示例数据
                </el-button>
              </el-tooltip>
              <el-avatar :size="32" icon="User" />
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
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores'
import { storeToRefs } from 'pinia'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { ElMessage, ElMessageBox } from 'element-plus'
import { initSampleData as initSampleDataApi } from '@/api/dashboard'

const route = useRoute()
const appStore = useAppStore()
const { sidebarCollapsed, currentRoute } = storeToRefs(appStore)
const { toggleSidebar } = appStore

const currentPageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/dashboard': '仪表盘',
    '/turbines': '风机管理',
    '/inspections': '巡检管理',
    '/risk-assessments': '风险评估',
    '/data-import': '数据导入',
    '/data-export': '数据导出',
    '/alarms': 'SCADA告警',
    '/work-orders': '维修工单',
  }
  return titles[route.path] || ''
})

const handleInitSampleData = async () => {
  try {
    await ElMessageBox.confirm(
      '此操作将初始化示例数据，是否继续？',
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    const result = await initSampleDataApi()
    ElMessage.success(`示例数据初始化成功：${result.turbines_created}台风机，${result.inspections_created}次巡检，${result.alarms_created}条告警，${result.work_orders_created}条工单`)
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('初始化示例数据失败：' + (error.message || '未知错误'))
    }
  }
}
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
  height: 100%;
}

.sidebar {
  background-color: #304156;
  transition: width 0.3s;
  overflow: hidden;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  border-bottom: 1px solid #1f2d3d;
}

.logo-text {
  margin-left: 12px;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
}

.sidebar-menu {
  border-right: none;
  height: calc(100vh - 60px);
}

.header {
  background-color: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collapse-btn {
  cursor: pointer;
  color: #606266;
  transition: color 0.3s;
}

.collapse-btn:hover {
  color: #409eff;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.main-content {
  background-color: #f0f2f5;
  padding: 20px;
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

.el-breadcrumb__inner {
  color: #606266;
}

.el-breadcrumb__item:last-child .el-breadcrumb__inner {
  color: #303133;
  font-weight: 500;
}
</style>
