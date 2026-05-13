<template>
  <el-container style="height: 100vh">
    <el-aside width="200px" style="background-color: #2c3e50">
      <div style="color: white; padding: 20px; text-align: center; font-size: 18px; font-weight: bold">
        社区药箱管理
      </div>
      <el-menu
        :default-active="$route.path"
        router
        background-color="#2c3e50"
        text-color="#fff"
        active-text-color="#409EFF"
      >
        <el-menu-item index="/">
          <el-icon><DataLine /></el-icon>
          <span>数据概览</span>
        </el-menu-item>
        <el-menu-item index="/boxes">
          <el-icon><Location /></el-icon>
          <span>药箱位置</span>
        </el-menu-item>
        <el-menu-item index="/batches">
          <el-icon><Box /></el-icon>
          <span>药品批次</span>
        </el-menu-item>
        <el-menu-item index="/borrows">
          <el-icon><Document /></el-icon>
          <span>借用记录</span>
        </el-menu-item>
        <el-menu-item index="/returns">
          <el-icon><Checked /></el-icon>
          <span>归还验收</span>
        </el-menu-item>
        <el-menu-item index="/supplies">
          <el-icon><Truck /></el-icon>
          <span>补给计划</span>
        </el-menu-item>
        <el-menu-item index="/expiry-risks">
          <el-icon><Warning /></el-icon>
          <span>效期风险</span>
        </el-menu-item>
        <el-menu-item index="/logs">
          <el-icon><List /></el-icon>
          <span>操作日志</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
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
</style>
