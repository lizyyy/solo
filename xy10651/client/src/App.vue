<template>
  <el-container style="height: 100vh">
    <el-aside width="200px" style="background-color: #2f4050">
      <div style="color: white; padding: 20px; text-align: center; font-size: 18px; font-weight: bold">
        影院场务系统
      </div>
      <el-menu
        :default-active="$route.path"
        class="el-menu-vertical-demo"
        background-color="#2f4050"
        text-color="#fff"
        active-text-color="#ffd04b"
        router
      >
        <el-menu-item index="/screenings">
          <el-icon><Film /></el-icon>
          <span>影厅排片</span>
        </el-menu-item>
        <el-menu-item index="/cleaning">
          <el-icon><Brush /></el-icon>
          <span>散场清洁</span>
        </el-menu-item>
        <el-menu-item index="/inspections">
          <el-icon><Search /></el-icon>
          <span>设备巡检</span>
        </el-menu-item>
        <el-menu-item index="/shifts">
          <el-icon><Switch /></el-icon>
          <span>换班记录</span>
        </el-menu-item>
        <el-menu-item index="/positions">
          <el-icon><User /></el-icon>
          <span>岗位技能</span>
        </el-menu-item>
        <el-menu-item index="/uncovered">
          <el-icon><Warning /></el-icon>
          <span>未覆盖岗位</span>
        </el-menu-item>
        <el-menu-item index="/staff">
          <el-icon><Team /></el-icon>
          <span>员工管理</span>
        </el-menu-item>
        <el-menu-item index="/reports">
          <el-icon><Document /></el-icon>
          <span>报告导出</span>
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
import { Film, Brush, Search, Switch, User, Warning, Team, Document } from '@element-plus/icons-vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
</style>
