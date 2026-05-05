<template>
  <div class="dashboard">
    <h2 class="page-title">数据概览</h2>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon total">📊</div>
        <div class="stat-info">
          <h3>总标本数</h3>
          <p class="stat-value">{{ dataStore.statistics.totalSpecimens }}</p>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon high">🔴</div>
        <div class="stat-info">
          <h3>高风险标本</h3>
          <p class="stat-value">{{ dataStore.statistics.highRisk }}</p>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon medium">🟡</div>
        <div class="stat-info">
          <h3>中等风险标本</h3>
          <p class="stat-value">{{ dataStore.statistics.mediumRisk }}</p>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon low">🟢</div>
        <div class="stat-info">
          <h3>低风险标本</h3>
          <p class="stat-value">{{ dataStore.statistics.lowRisk }}</p>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon cannot-store">🚫</div>
        <div class="stat-info">
          <h3>不能入柜标本</h3>
          <p class="stat-value">{{ dataStore.statistics.cannotStore }}</p>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon suspend-loan">⏸️</div>
        <div class="stat-info">
          <h3>需暂停外借标本</h3>
          <p class="stat-value">{{ dataStore.statistics.suspendLoan }}</p>
        </div>
      </div>
    </div>
    
    <div class="action-buttons">
      <button @click="handleExportMarkdown" class="btn btn-primary">
        导出 Markdown 处置清单
      </button>
      <button @click="handleExportJSON" class="btn btn-secondary">
        导出 JSON 明细
      </button>
    </div>
    
    <div class="high-risk-section" v-if="dataStore.highRiskSpecimens.length > 0">
      <h3>高风险标本列表</h3>
      <div class="specimen-list">
        <div 
          v-for="specimen in dataStore.highRiskSpecimens" 
          :key="specimen.id"
          class="specimen-item high-risk"
          @click="goToSpecimenDetail(specimen.id)"
        >
          <div class="specimen-header">
            <span class="specimen-id">{{ specimen.id }}</span>
            <span class="risk-badge high">高风险</span>
          </div>
          <div class="specimen-risks">
            <div v-if="specimen.cannotStore" class="risk-tag cannot-store">不能入柜</div>
            <div v-if="specimen.suspendLoan" class="risk-tag suspend-loan">暂停外借</div>
          </div>
          <ul class="risk-reasons">
            <li v-for="(reason, index) in specimen.riskReasons" :key="index">
              {{ reason }}
            </li>
          </ul>
        </div>
      </div>
    </div>
    
    <div class="no-data" v-else-if="dataStore.allSpecimens.length === 0">
      <p>暂无数据，请先导入数据</p>
      <router-link to="/import" class="btn btn-primary">前往导入数据</router-link>
    </div>
  </div>
</template>

<script setup>
import { useDataStore } from '../store/dataStore'
import { useRouter } from 'vue-router'

const dataStore = useDataStore()
const router = useRouter()

const goToSpecimenDetail = (id) => {
  router.push(`/specimens/${id}`)
}

const handleExportMarkdown = async () => {
  const markdown = dataStore.exportMarkdown()
  const result = await window.electronAPI.exportFile('markdown', markdown)
  
  if (result.success) {
    alert(`Markdown 文件已导出到：${result.filePath}`)
  } else if (!result.canceled) {
    alert('导出失败：' + (result.error || '未知错误'))
  }
}

const handleExportJSON = async () => {
  const json = dataStore.exportJSON()
  const result = await window.electronAPI.exportFile('json', json)
  
  if (result.success) {
    alert(`JSON 文件已导出到：${result.filePath}`)
  } else if (!result.canceled) {
    alert('导出失败：' + (result.error || '未知错误'))
  }
}
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

.page-title {
  font-size: 2rem;
  margin-bottom: 2rem;
  color: #2c3e50;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.stat-icon {
  width: 50px;
  height: 50px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.stat-icon.total {
  background-color: #e3f2fd;
}

.stat-icon.high {
  background-color: #ffebee;
}

.stat-icon.medium {
  background-color: #fff3e0;
}

.stat-icon.low {
  background-color: #e8f5e9;
}

.stat-icon.cannot-store {
  background-color: #f3e5f5;
}

.stat-icon.suspend-loan {
  background-color: #fff8e1;
}

.stat-info h3 {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 1.8rem;
  font-weight: bold;
  color: #2c3e50;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
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

.high-risk-section {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.high-risk-section h3 {
  font-size: 1.2rem;
  margin-bottom: 1rem;
  color: #e74c3c;
}

.specimen-list {
  display: grid;
  gap: 1rem;
}

.specimen-item {
  background: #f8f9fa;
  border-radius: 6px;
  padding: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.specimen-item:hover {
  background: #e9ecef;
}

.specimen-item.high-risk {
  border-left: 4px solid #e74c3c;
}

.specimen-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.specimen-id {
  font-weight: bold;
  font-size: 1.1rem;
  color: #2c3e50;
}

.risk-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
}

.risk-badge.high {
  background-color: #ffebee;
  color: #c62828;
}

.specimen-risks {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.risk-tag {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.risk-tag.cannot-store {
  background-color: #f3e5f5;
  color: #7b1fa2;
}

.risk-tag.suspend-loan {
  background-color: #fff8e1;
  color: #f57f17;
}

.risk-reasons {
  margin: 0;
  padding-left: 1.25rem;
  color: #666;
  font-size: 0.9rem;
}

.no-data {
  text-align: center;
  padding: 3rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.no-data p {
  margin-bottom: 1rem;
  color: #666;
  font-size: 1.1rem;
}
</style>
