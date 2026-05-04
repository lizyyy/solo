<template>
  <div class="app-container">
    <header class="header">
      <div class="header-content">
        <div class="logo">
          <span class="logo-icon">🚁</span>
          <span>无人机任务预检工具</span>
        </div>
        <nav class="nav-links">
          <router-link to="/" class="nav-link" :class="{ active: $route.path === '/' }">
            任务列表
          </router-link>
          <router-link to="/new" class="nav-link" :class="{ active: $route.path === '/new' }">
            新建任务
          </router-link>
        </nav>
      </div>
    </header>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
</script>
