<template>
  <el-container class="app-container">
    <el-aside width="220px" class="sidebar">
      <div class="logo">
        <el-icon size="32"><Warning /></el-icon>
        <span class="logo-text">扶梯停梯复盘</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
        router
      >
        <el-menu-item index="/dashboard">
          <el-icon><Odometer /></el-icon>
          <span>数据概览</span>
        </el-menu-item>
        <el-menu-item index="/import">
          <el-icon><Upload /></el-icon>
          <span>数据导入</span>
        </el-menu-item>
        <el-menu-item index="/risk">
          <el-icon><Warning /></el-icon>
          <span>风险管理</span>
        </el-menu-item>
        <el-menu-item index="/escalator">
          <el-icon><SetUp /></el-icon>
          <span>扶梯列表</span>
        </el-menu-item>
        <el-menu-item index="/export">
          <el-icon><Download /></el-icon>
          <span>数据导出</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-title">
          <el-icon size="24"><Building /></el-icon>
          <span>地铁站自动扶梯停梯复盘工具</span>
        </div>
        <div class="header-actions">
          <el-tooltip content="风险检测">
            <el-button type="primary" @click="handleDetect">
              <el-icon><Search /></el-icon>
              风险检测
            </el-button>
          </el-tooltip>
        </div>
      </el-header>
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { riskApi } from '@/api'

const route = useRoute()
const detecting = ref(false)

const activeMenu = computed(() => route.path)

const handleDetect = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要执行风险检测吗？系统将分析所有扶梯数据并标记风险。',
      '风险检测确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    detecting.value = true
    const res = await riskApi.detect({})
    
    if (res.data.success) {
      ElMessage.success(`检测完成，发现 ${res.data.data.count} 个风险`)
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('风险检测失败: ' + (error.message || error))
    }
  } finally {
    detecting.value = false
  }
}
</script>

<style lang="scss" scoped>
.app-container {
  height: 100vh;
}

.sidebar {
  background-color: #304156;
  transition: width 0.3s;

  .logo {
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
    background-color: #2b3a4a;
    color: #fff;

    .logo-text {
      margin-left: 10px;
      font-size: 16px;
      font-weight: bold;
      white-space: nowrap;
    }
  }

  .el-menu {
    border-right: none;
  }
}

.header {
  background-color: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;

  .header-title {
    display: flex;
    align-items: center;
    font-size: 18px;
    font-weight: 500;
    color: #303133;

    el-icon {
      margin-right: 10px;
      color: #409EFF;
    }
  }
}

.main-content {
  background-color: #f0f2f5;
  padding: 20px;
  overflow-y: auto;
}
</style>
