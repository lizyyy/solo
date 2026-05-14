<template>
  <el-config-provider :locale="zhCn">
    <div class="app-container">
      <el-container style="height: 100vh">
        <el-aside width="240px" style="background-color: #2f4050">
          <div class="logo">
            <h3 style="color: #fff; margin: 0; padding: 20px; text-align: center">
              邮件灰度发布
            </h3>
          </div>
          <el-menu
            :default-active="$route.path"
            class="el-menu-vertical"
            background-color="#2f4050"
            text-color="#fff"
            active-text-color="#1890ff"
            router
          >
            <el-menu-item index="/dashboard">
              <el-icon><DataBoard /></el-icon>
              <span>数据概览</span>
            </el-menu-item>
            <el-menu-item index="/templates">
              <el-icon><Document /></el-icon>
              <span>模板管理</span>
            </el-menu-item>
            <el-menu-item index="/batches">
              <el-icon><Collection /></el-icon>
              <span>批次管理</span>
            </el-menu-item>
            <el-menu-item index="/approvals">
              <el-icon><Check /></el-icon>
              <span>审批中心</span>
            </el-menu-item>
          </el-menu>
        </el-aside>
        <el-container>
          <el-header style="background-color: #fff; border-bottom: 1px solid #e6e6e6">
            <div style="display: flex; justify-content: space-between; align-items: center">
              <h2 style="margin: 0">{{ $route.meta.title || '邮件模板灰度发布系统' }}</h2>
              <el-avatar icon="UserFilled" />
            </div>
          </el-header>
          <el-main style="background-color: #f5f5f5; overflow-y: auto">
            <router-view />
          </el-main>
        </el-container>
      </el-container>
    </div>
  </el-config-provider>
</template>

<script setup>
import zhCn from 'element-plus/es/locale/lang/zh-cn'
</script>

<style scoped>
.app-container {
  height: 100vh;
}
.el-menu-vertical {
  border-right: none;
}
</style>
