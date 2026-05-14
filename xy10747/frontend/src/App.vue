<template>
  <div id="app">
    <el-container style="height: 100vh;">
      <el-header style="background: #fff; border-bottom: 1px solid #e4e7ed; padding: 0 20px;">
        <div style="display: flex; align-items: center; height: 100%;">
          <h1 style="margin: 0; font-size: 20px; color: #303133;">
            📦 低代码组件注册中心
          </h1>
        </div>
      </el-header>
      <el-main style="background: #f5f7fa; padding: 20px;">
        <router-view />
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
</script>
