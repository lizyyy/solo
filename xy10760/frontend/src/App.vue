<template>
  <div class="app-container">
    <el-container>
      <el-header class="header">
        <h1>审批规则模拟器</h1>
      </el-header>
      <el-main class="main-content">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="模拟列表" name="list">
            <SimulationList />
          </el-tab-pane>
          <el-tab-pane label="数据管理" name="manage">
            <DataManagement />
          </el-tab-pane>
        </el-tabs>
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import SimulationList from './components/SimulationList.vue'
import DataManagement from './components/DataManagement.vue'

const activeTab = ref('list')
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  background: #f5f7fa;
}

.header {
  background: #fff;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  align-items: center;
  padding: 0 20px;
}

.header h1 {
  margin: 0;
  font-size: 24px;
  color: #333;
}

.main-content {
  padding: 20px;
}
</style>
