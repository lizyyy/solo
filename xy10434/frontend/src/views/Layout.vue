<template>
  <el-container class="layout-container">
    <el-aside width="220px" class="aside">
      <div class="logo">
        <el-icon><HomeFilled /></el-icon>
        <span>装修押金台</span>
      </div>
      <el-menu :default-active="activeMenu" router background-color="#304156" text-color="#bfcbd9" active-text-color="#409EFF">
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <span>工作台</span>
        </el-menu-item>
        <el-menu-item index="/decorations">
          <el-icon><EditPen /></el-icon>
          <span>装修管理</span>
        </el-menu-item>
        <el-menu-item index="/deposits">
          <el-icon><Wallet /></el-icon>
          <span>押金流水</span>
        </el-menu-item>
        <el-menu-item index="/inspections">
          <el-icon><Warning /></el-icon>
          <span>巡查记录</span>
        </el-menu-item>
        <el-menu-item index="/refunds">
          <el-icon><Money /></el-icon>
          <span>退押审核</span>
        </el-menu-item>
        <el-sub-menu index="settings">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>基础设置</span>
          </template>
          <el-menu-item index="/owners">
            <el-icon><User /></el-icon>
            <span>业主管理</span>
          </el-menu-item>
          <el-menu-item index="/rooms">
            <el-icon><OfficeBuilding /></el-icon>
            <span>房号管理</span>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-title">
          {{ pageTitle }}
        </div>
        <div class="header-user">
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-icon><UserFilled /></el-icon>
              {{ authStore.user?.username }}
              <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="initSample">初始化样例数据</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import api from '@/utils/api'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const activeMenu = computed(() => route.path)
const pageTitle = computed(() => route.meta.title || '装修押金台')

function handleCommand(command) {
  if (command === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      authStore.logout()
      router.push('/login')
    }).catch(() => {})
  } else if (command === 'initSample') {
    ElMessageBox.confirm('初始化样例数据将添加测试用的业主、房号、装修记录等，确定要执行吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(async () => {
      try {
        await api.post('/dashboard/init-sample-data')
        ElMessage.success('样例数据初始化成功')
        setTimeout(() => location.reload(), 1000)
      } catch (err) {
        console.error(err)
      }
    }).catch(() => {})
  }
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.aside {
  background-color: #304156;
  overflow-x: hidden;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  background-color: #2b3a4a;
}

.logo .el-icon {
  margin-right: 8px;
  font-size: 24px;
}

.header {
  background-color: #fff;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.header-title {
  font-size: 18px;
  font-weight: 500;
  color: #333;
}

.user-info {
  display: flex;
  align-items: center;
  cursor: pointer;
  color: #666;
}

.user-info .el-icon {
  margin: 0 4px;
}

.main {
  background-color: #f5f7fa;
  overflow-y: auto;
}
</style>
