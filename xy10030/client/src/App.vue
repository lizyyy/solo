<template>
  <div class="app">
    <header class="header">
      <div class="container">
        <h1 class="logo">活动报名系统</h1>
        <nav class="nav">
          <router-link to="/" class="nav-link">活动列表</router-link>
          <router-link to="/registrations" class="nav-link">报名管理</router-link>
          <router-link to="/tasks" class="nav-link">失败任务</router-link>
          <router-link to="/logs" class="nav-link">操作日志</router-link>
          <router-link to="/reports" class="nav-link">数据报告</router-link>
        </nav>
      </div>
    </header>
    <main class="main">
      <div class="container">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup>
</script>

<style>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.header {
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 60px;
}

.logo {
  font-size: 20px;
  font-weight: 600;
  color: #1890ff;
  margin: 0;
}

.nav {
  display: flex;
  gap: 24px;
}

.nav-link {
  color: #666;
  text-decoration: none;
  font-size: 14px;
  transition: color 0.3s;
}

.nav-link:hover,
.nav-link.router-link-active {
  color: #1890ff;
}

.main {
  padding: 24px 0;
  min-height: calc(100vh - 60px);
}
</style>
