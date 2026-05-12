<template>
  <div id="app">
    <header class="header">
      <div class="container">
        <h1>美术馆观众动线热区台</h1>
        <nav class="nav">
          <router-link to="/" class="nav-item" exact-active-class="active">仪表盘</router-link>
          <router-link to="/import" class="nav-item" active-class="active">数据导入</router-link>
          <router-link to="/exhibitions" class="nav-item" active-class="active">展区管理</router-link>
          <router-link to="/heatmap" class="nav-item" active-class="active">热区分析</router-link>
          <router-link to="/security" class="nav-item" active-class="active">安保建议</router-link>
          <router-link to="/problems" class="nav-item" active-class="active">
            问题列表
            <span v-if="openProblems > 0" class="status-badge status-danger" style="margin-left: 4px;">{{ openProblems }}</span>
          </router-link>
        </nav>
      </div>
    </header>
    <main class="container">
      <router-view />
    </main>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';

export default {
  name: 'App',
  setup() {
    const openProblems = ref(0);
    
    async function loadProblemStats() {
      try {
        const response = await fetch('/api/problems/stats/summary');
        const data = await response.json();
        if (data.success) {
          openProblems.value = data.data.open;
        }
      } catch (e) {
        console.error('加载问题统计失败:', e);
      }
    }
    
    onMounted(() => {
      loadProblemStats();
      setInterval(loadProblemStats, 10000);
    });
    
    return {
      openProblems
    };
  }
};
</script>
