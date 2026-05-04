<template>
  <div class="app">
    <nav class="navbar">
      <router-link to="/" class="navbar-brand">
        ⚓ 潮汐装卸排程工具
      </router-link>
      <div class="navbar-nav">
        <router-link 
          to="/import" 
          class="navbar-link"
          :class="{ active: $route.name === 'DataImport' }"
        >
          数据导入
        </router-link>
        <router-link 
          to="/scheduling" 
          class="navbar-link"
          :class="{ active: $route.name === 'Scheduling' }"
        >
          排程调整
        </router-link>
        <router-link 
          to="/schedules" 
          class="navbar-link"
          :class="{ active: $route.name === 'ScheduleList' }"
        >
          历史排程
        </router-link>
      </div>
    </nav>
    <router-view />
  </div>
</template>

<script setup>
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
