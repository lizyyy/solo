<template>
  <div class="import">
    <h2 class="page-title">数据导入</h2>
    
    <div class="import-section">
      <h3>快速导入示例数据</h3>
      <p class="description">点击下方按钮导入示例数据，体验系统功能。示例数据包含：</p>
      <ul class="feature-list">
        <li>5 条冷冻灭虫柜温度日志</li>
        <li>5 条标本借展清单</li>
        <li>4 条归还照片复查表</li>
        <li>5 条展柜湿度记录</li>
      </ul>
      <button @click="handleImportSample" class="btn btn-primary btn-large">
        导入示例数据
      </button>
    </div>
    
    <div class="import-section" v-if="dataStore.allSpecimens.value.length > 0">
      <h3>数据概览</h3>
      <div class="data-stats">
        <div class="stat-item">
          <span class="stat-label">总标本数</span>
          <span class="stat-value">{{ dataStore.statistics.totalSpecimens }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">高风险</span>
          <span class="stat-value high">{{ dataStore.statistics.highRisk }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">中等风险</span>
          <span class="stat-value medium">{{ dataStore.statistics.mediumRisk }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">低风险</span>
          <span class="stat-value low">{{ dataStore.statistics.lowRisk }}</span>
        </div>
      </div>
      
      <div class="action-buttons">
        <button @click="handleClearData" class="btn btn-danger">
          清空所有数据
        </button>
        <router-link to="/" class="btn btn-secondary">
          查看数据概览
        </router-link>
      </div>
    </div>
    
    <div class="import-section">
      <h3>导入数据说明</h3>
      <div class="info-card">
        <h4>系统支持以下数据类型：</h4>
        <ul>
          <li><strong>冷冻灭虫柜温度日志</strong>：记录标本冷冻处理的温度和时间</li>
          <li><strong>标本借展清单</strong>：记录标本外借的借展方、时间和归还状态</li>
          <li><strong>归还照片复查表</strong>：记录标本归还后的照片检查结果和问题</li>
          <li><strong>展柜湿度记录</strong>：记录标本所在展柜的湿度情况</li>
        </ul>
      </div>
      
      <div class="info-card">
        <h4>风险评估规则：</h4>
        <ul>
          <li><strong>高风险</strong>：冷冻温度严重异常、标本严重损伤、展柜湿度严重异常</li>
          <li><strong>中等风险</strong>：冷冻温度偏高、标本轻微损伤、展柜湿度异常</li>
          <li><strong>不能入柜</strong>：高风险标本需要特殊处理，暂不能入柜保存</li>
          <li><strong>暂停外借</strong>：有损伤或风险的标本需要暂停外借</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useDataStore } from '../store/dataStore'
import { useRouter } from 'vue-router'

const dataStore = useDataStore()
const router = useRouter()

const handleImportSample = () => {
  if (confirm('导入示例数据将覆盖现有数据，是否继续？')) {
    dataStore.importSampleData()
    alert('示例数据导入成功！')
    router.push('/')
  }
}

const handleClearData = () => {
  if (confirm('确定要清空所有数据吗？此操作不可恢复。')) {
    dataStore.clearAllData()
    alert('数据已清空！')
  }
}
</script>

<style scoped>
.import {
  max-width: 800px;
  margin: 0 auto;
}

.page-title {
  font-size: 2rem;
  margin-bottom: 2rem;
  color: #2c3e50;
}

.import-section {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.import-section h3 {
  font-size: 1.2rem;
  margin-bottom: 1rem;
  color: #2c3e50;
}

.description {
  color: #666;
  margin-bottom: 1rem;
}

.feature-list {
  margin: 0 0 1.5rem 1.5rem;
  color: #666;
}

.feature-list li {
  margin-bottom: 0.5rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
  text-decoration: none;
  display: inline-block;
}

.btn-large {
  padding: 1rem 2rem;
  font-size: 1.1rem;
}

.btn-primary {
  background-color: #3498db;
  color: white;
}

.btn-primary:hover {
  background-color: #2980b9;
}

.btn-secondary {
  background-color: #95a5a6;
  color: white;
}

.btn-secondary:hover {
  background-color: #7f8c8d;
}

.btn-danger {
  background-color: #e74c3c;
  color: white;
}

.btn-danger:hover {
  background-color: #c0392b;
}

.data-stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-item {
  background: #f8f9fa;
  border-radius: 6px;
  padding: 1rem;
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #2c3e50;
}

.stat-value.high {
  color: #e74c3c;
}

.stat-value.medium {
  color: #f39c12;
}

.stat-value.low {
  color: #27ae60;
}

.action-buttons {
  display: flex;
  gap: 1rem;
}

.info-card {
  background: #f8f9fa;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.info-card:last-child {
  margin-bottom: 0;
}

.info-card h4 {
  font-size: 1rem;
  margin-bottom: 0.75rem;
  color: #2c3e50;
}

.info-card ul {
  margin: 0 0 0 1.5rem;
  color: #666;
}

.info-card li {
  margin-bottom: 0.5rem;
}

.info-card li:last-child {
  margin-bottom: 0;
}
</style>
