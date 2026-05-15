<template>
  <div id="app">
    <header class="header">
      <h1>事件订阅偏好中心</h1>
      <p>Event Subscription Preference Center</p>
    </header>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
</script>

<style scoped>
.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 24px 32px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.header h1 {
  font-size: 24px;
  margin-bottom: 4px;
}

.header p {
  font-size: 14px;
  opacity: 0.9;
}

.main {
  padding: 24px 32px;
  max-width: 1400px;
  margin: 0 auto;
}
</style>
