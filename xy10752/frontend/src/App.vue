<template>
  <el-config-provider :locale="zhCn">
    <div id="app">
      <el-container style="height: 100vh">
        <el-header style="background: #409eff; color: white; display: flex; align-items: center; padding: 0 20px">
          <h2 style="margin: 0; color: white">工单SLA时钟系统</h2>
          <el-menu
            mode="horizontal"
            :default-active="activeMenu"
            router
            style="flex: 1; margin-left: 30px; background: #409eff; border: none"
            text-color="#fff"
            active-text-color="#ffd04b"
          >
            <el-menu-item index="/">工单列表</el-menu-item>
            <el-menu-item index="/config">系统配置</el-menu-item>
          </el-menu>
        </el-header>
        <el-main style="background: #f5f7fa; padding: 20px">
          <router-view />
        </el-main>
      </el-container>
    </div>
  </el-config-provider>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

const route = useRoute()
const activeMenu = computed(() => route.path)
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

#app {
  height: 100vh;
}
</style>
