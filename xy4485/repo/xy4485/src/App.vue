<template>
  <div id="app">
    <nav class="navbar">
      <div class="navbar-brand">
        <h1>昆虫标本馆管理工具</h1>
      </div>
      <div class="navbar-menu">
        <router-link to="/" class="nav-link">数据概览</router-link>
        <router-link to="/specimens" class="nav-link">标本列表</router-link>
        <router-link to="/import" class="nav-link">数据导入</router-link>
      </div>
    </nav>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useDataStore } from './store/dataStore'

const dataStore = useDataStore()

onMounted(async () => {
  await dataStore.loadData()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background-color: #f5f5f5;
  color: #333;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.navbar {
  background-color: #2c3e50;
  color: white;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.navbar-brand h1 {
  font-size: 1.5rem;
  font-weight: 600;
}

.navbar-menu {
  display: flex;
  gap: 1.5rem;
}

.nav-link {
  color: white;
  text-decoration: none;
  font-weight: 500;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.nav-link:hover {
  background-color: #34495e;
}

.nav-link.router-link-active {
  background-color: #3498db;
}

.main-content {
  flex: 1;
  padding: 2rem;
}
</style>
