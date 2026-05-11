<template>
  <el-container class="app-container">
    <el-header>
      <span class="logo">🍽️ 养老餐配送温度追踪台</span>
      <span class="subtitle">Temperature Tracking for Elderly Meal Delivery</span>
    </el-header>
    <el-container>
      <el-aside width="220px">
        <el-menu
          :default-active="activeMenu"
          background-color="#304156"
          text-color="#bfcbd9"
          active-text-color="#409eff"
          router
        >
          <el-menu-item index="/dashboard">
            <el-icon><DataAnalysis /></el-icon>
            <span>数据概览</span>
          </el-menu-item>
          <el-menu-item index="/batches">
            <el-icon><Document /></el-icon>
            <span>配送批次管理</span>
          </el-menu-item>
          <el-menu-item index="/receipts">
            <el-icon><Tickets /></el-icon>
            <span>签收回执</span>
          </el-menu-item>
          <el-menu-item index="/return-review">
            <el-icon><CircleClose /></el-icon>
            <span>退餐审核</span>
          </el-menu-item>
          <el-menu-item index="/compensation-review">
            <el-icon><Money /></el-icon>
            <span>补偿审核</span>
          </el-menu-item>
          <el-menu-item index="/compensation-rules">
            <el-icon><Setting /></el-icon>
            <span>补偿规则配置</span>
          </el-menu-item>
          <el-menu-item index="/safety-incidents">
            <el-icon><Warning /></el-icon>
            <span>食品安全事件</span>
          </el-menu-item>
          <el-menu-item index="/exports">
            <el-icon><Download /></el-icon>
            <span>数据导出</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
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
</script>

<style>
.app-container {
  height: 100vh;
}
</style>
