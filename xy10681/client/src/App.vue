<template>
  <el-config-provider :locale="zhCn">
    <div id="app">
      <el-container>
        <el-header style="background: #409EFF; color: white; font-size: 20px; font-weight: bold;">
          志愿者岗位补贴管理系统
        </el-header>
        <el-main>
          <router-view />
        </el-main>
      </el-container>
    </div>
  </el-config-provider>
</template>

<script>
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'

export default {
  name: 'App',
  data() {
    return {
      zhCn
    }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  min-height: 100vh;
}
.el-header {
  display: flex;
  align-items: center;
  padding: 0 20px;
}
.el-main {
  padding: 20px;
}
</style>
