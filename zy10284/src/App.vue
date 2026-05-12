<template>
  <div id="app">
    <el-container>
      <el-header class="header">
        <h1 class="title">🏠 校园宿舍维修闭环台</h1>
        <div class="stats">
          <el-tag type="info" class="stat-tag">
            <el-icon><Timer /></el-icon>
            待审核: {{ stats.pending }}
          </el-tag>
          <el-tag type="warning" class="stat-tag">
            <el-icon><User /></el-icon>
            待派工: {{ stats.assigned }}
          </el-tag>
          <el-tag type="primary" class="stat-tag">
            <el-icon><Tools /></el-icon>
            维修中: {{ stats.processing }}
          </el-tag>
          <el-tag type="success" class="stat-tag">
            <el-icon><CircleCheck /></el-icon>
            已完成: {{ stats.completed }}
          </el-tag>
          <el-tag type="danger" class="stat-tag">
            <el-icon><Warning /></el-icon>
            待返工: {{ stats.rework }}
          </el-tag>
          <el-tag type="info" class="stat-tag">
            <el-icon><Stopwatch /></el-icon>
            待回访: {{ stats.reviewing }}
          </el-tag>
          <el-tag type="danger" class="stat-tag">
            <el-icon><Close /></el-icon>
            已拦截: {{ stats.blocked }}
          </el-tag>
          <el-tag type="info" class="stat-tag" v-if="stats.merged > 0">
            <el-icon><Link /></el-icon>
            已合并: {{ stats.merged }}
          </el-tag>
        </div>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { Link } from '@element-plus/icons-vue'

const stats = ref({
  pending: 0,
  assigned: 0,
  processing: 0,
  reviewing: 0,
  completed: 0,
  rework: 0,
  blocked: 0,
  merged: 0
})

const fetchStats = async () => {
  try {
    const res = await axios.get('/api/stats')
    stats.value = res.data
  } catch (err) {
    console.error(err)
  }
}

onMounted(() => {
  fetchStats()
  window.addEventListener('refreshStats', fetchStats)
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 40px;
}

.title {
  font-size: 24px;
  font-weight: 600;
}

.stats {
  display: flex;
  gap: 10px;
}

.stat-tag {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 15px;
  border-radius: 20px;
}

.el-main {
  padding: 30px;
  background-color: #f5f7fa;
  min-height: calc(100vh - 80px);
}
</style>
