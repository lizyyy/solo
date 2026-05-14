<template>
  <el-container style="height: 100vh">
    <el-header style="background: #001529; color: white; display: flex; align-items: center; padding: 0 20px">
      <h2 style="margin: 0; font-size: 18px">日志采样检索工具</h2>
    </el-header>
    <el-container>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
</style>
