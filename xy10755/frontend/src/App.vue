<template>
  <el-container style="height: 100vh">
    <el-header style="background: #409EFF; color: white; display: flex; align-items: center; padding: 0 20px;">
      <h2 style="margin: 0">多仓履约拆单系统</h2>
      <el-menu
        :default-active="activeMenu"
        mode="horizontal"
        router
        style="background: #409EFF; border: none; margin-left: 30px"
        text-color="white"
        active-text-color="#ffd04b"
      >
        <el-menu-item index="/">订单列表</el-menu-item>
        <el-menu-item index="/order-create">创建订单</el-menu-item>
        <el-menu-item index="/warehouses">仓库管理</el-menu-item>
      </el-menu>
    </el-header>
    <el-main style="background: #f5f7fa; padding: 20px;">
      <router-view />
    </el-main>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const activeMenu = computed(() => route.path)
</script>
