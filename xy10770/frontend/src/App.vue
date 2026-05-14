<template>
  <div id="app">
    <el-container>
      <el-header style="background: #409EFF; color: white; font-size: 20px; line-height: 60px; padding: 0 20px;">
        <i class="el-icon-data-line" style="margin-right: 10px;"></i>
        API性能压测面板
      </el-header>
      <el-main>
        <router-view></router-view>
      </el-main>
    </el-container>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  height: 100vh;
}
.el-header {
  background-color: #409EFF;
  color: white;
  text-align: left;
  line-height: 60px;
  font-size: 20px;
  font-weight: bold;
}
.el-main {
  background-color: #f5f7fa;
  padding: 20px;
}
</style>