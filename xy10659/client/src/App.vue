<template>
  <el-container style="height: 100vh; border: 1px solid #eee">
    <el-aside width="200px" style="background-color: rgb(238, 241, 246)">
      <el-menu
        :default-active="activeMenu"
        class="el-menu-vertical-demo"
        router
        @select="handleSelect"
      >
        <el-menu-item index="/">
          <el-icon><DataAnalysis /></el-icon>
          <span>数据概览</span>
        </el-menu-item>
        <el-menu-item index="/vehicles">
          <el-icon><Van /></el-icon>
          <span>车辆里程</span>
        </el-menu-item>
        <el-menu-item index="/orders">
          <el-icon><Tickets /></el-icon>
          <span>套餐订单</span>
        </el-menu-item>
        <el-menu-item index="/items">
          <el-icon><Tools /></el-icon>
          <span>保养项目</span>
        </el-menu-item>
        <el-menu-item index="/verifications">
          <el-icon><DocumentChecked /></el-icon>
          <span>核销记录</span>
        </el-menu-item>
        <el-menu-item index="/exceptions">
          <el-icon><Warning /></el-icon>
          <span>异常看板</span>
        </el-menu-item>
        <el-menu-item index="/reminders">
          <el-icon><Bell /></el-icon>
          <span>下次提醒</span>
        </el-menu-item>
        <el-menu-item index="/reports">
          <el-icon><Document /></el-icon>
          <span>报表导出</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header style="text-align: right; font-size: 12px">
        <div style="line-height: 60px">
          <span style="margin-right: 20px; font-size: 18px; font-weight: bold; float: left">
            汽修保养套餐核销系统
          </span>
          <el-dropdown>
            <span class="el-dropdown-link">
              <el-icon><User /></el-icon>
              <span>管理员</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const activeMenu = computed(() => route.path);

const handleSelect = (key, keyPath) => {
  console.log(key, keyPath);
};
</script>

<style scoped>
.el-dropdown-link {
  cursor: pointer;
  color: #409EFF;
  display: flex;
  align-items: center;
  gap: 5px;
}
.el-header {
  background-color: #fff;
  color: #333;
  border-bottom: 1px solid #eee;
}
.el-main {
  background-color: #f5f7fa;
}
</style>
