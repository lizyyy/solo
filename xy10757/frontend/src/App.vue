<template>
  <el-container style="height: 100vh">
    <el-header style="background: #409eff; color: white; display: flex; align-items: center; padding: 0 20px;">
      <h1 style="margin: 0; font-size: 20px;">会员积分账本系统</h1>
      <el-menu
        style="margin-left: 30px; background: transparent"
        mode="horizontal"
        :default-active="$route.path"
        router
      >
        <el-menu-item index="/">首页</el-menu-item>
        <el-menu-item index="/batches">积分批次</el-menu-item>
        <el-menu-item index="/transactions">交易记录</el-menu-item>
        <el-menu-item index="/snapshots">余额快照</el-menu-item>
        <el-menu-item index="/review">比对复核</el-menu-item>
      </el-menu>
    </el-header>
    <el-main style="background: #f5f7fa; padding: 20px;">
      <router-view />
    </el-main>
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
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
}
</style>
