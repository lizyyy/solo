<template>
  <div class="specimens">
    <h2 class="page-title">标本列表</h2>
    
    <div class="filter-section">
      <div class="filter-group">
        <label>风险等级：</label>
        <select v-model="filters.riskLevel" @change="applyFilters">
          <option value="">全部</option>
          <option value="high">高风险</option>
          <option value="medium">中等风险</option>
          <option value="low">低风险</option>
        </select>
      </div>
      
      <div class="filter-group">
        <label>状态：</label>
        <select v-model="filters.status" @change="applyFilters">
          <option value="">全部</option>
          <option value="cannotStore">不能入柜</option>
          <option value="suspendLoan">暂停外借</option>
        </select>
      </div>
      
      <div class="filter-group">
        <label>搜索：</label>
        <input 
          type="text" 
          v-model="filters.search" 
          placeholder="输入标本ID..."
          @input="applyFilters"
        />
      </div>
    </div>
    
    <div class="specimen-grid" v-if="filteredSpecimens.length > 0">
      <div 
        v-for="specimen in filteredSpecimens" 
        :key="specimen.id"
        class="specimen-card"
        :class="`risk-${specimen.riskLevel}`"
        @click="goToSpecimenDetail(specimen.id)"
      >
        <div class="card-header">
          <span class="specimen-id">{{ specimen.id }}</span>
          <span 
            class="risk-badge"
            :class="specimen.riskLevel"
          >
            {{ getRiskLevelText(specimen.riskLevel) }}
          </span>
        </div>
        
        <div class="card-body">
          <div class="status-tags">
            <div v-if="specimen.cannotStore" class="status-tag cannot-store">
              🚫 不能入柜
            </div>
            <div v-if="specimen.suspendLoan" class="status-tag suspend-loan">
              ⏸️ 暂停外借
            </div>
            <div v-if="specimen.hasManualOverride" class="status-tag manual">
              ✏️ 已人工改判
            </div>
          </div>
          
          <div class="risk-reasons" v-if="specimen.riskReasons.length > 0">
            <h4>风险原因：</h4>
            <ul>
              <li v-for="(reason, index) in specimen.riskReasons.slice(0, 2)" :key="index">
                {{ reason }}
              </li>
              <li v-if="specimen.riskReasons.length > 2">...</li>
            </ul>
          </div>
          
          <div class="quick-info">
            <div class="info-item" v-if="specimen.loan">
              <span class="info-label">借展方：</span>
              <span class="info-value">{{ specimen.loan.borrower }}</span>
            </div>
            <div class="info-item" v-if="specimen.humidityRecord">
              <span class="info-label">展柜：</span>
              <span class="info-value">{{ specimen.humidityRecord.displayCase }}</span>
            </div>
          </div>
        </div>
        
        <div class="card-footer">
          <span class="view-detail">查看详情 →</span>
        </div>
      </div>
    </div>
    
    <div class="no-results" v-else-if="dataStore.allSpecimens.length > 0">
      <p>没有找到符合条件的标本</p>
      <button @click="clearFilters" class="btn btn-secondary">清除筛选条件</button>
    </div>
    
    <div class="no-data" v-else>
      <p>暂无数据，请先导入数据</p>
      <router-link to="/import" class="btn btn-primary">前往导入数据</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '../store/dataStore'
import { useRouter } from 'vue-router'

const dataStore = useDataStore()
const router = useRouter()

const filters = ref({
  riskLevel: '',
  status: '',
  search: ''
})

const filteredSpecimens = ref([])

const getRiskLevelText = (level) => {
  const map = {
    high: '高风险',
    medium: '中等风险',
    low: '低风险'
  }
  return map[level] || level
}

const applyFilters = () => {
  let result = [...dataStore.allSpecimens.value]
  
  // 按风险等级筛选
  if (filters.value.riskLevel) {
    result = result.filter(s => s.riskLevel === filters.value.riskLevel)
  }
  
  // 按状态筛选
  if (filters.value.status === 'cannotStore') {
    result = result.filter(s => s.cannotStore)
  } else if (filters.value.status === 'suspendLoan') {
    result = result.filter(s => s.suspendLoan)
  }
  
  // 按搜索词筛选
  if (filters.value.search) {
    const searchLower = filters.value.search.toLowerCase()
    result = result.filter(s => 
      s.id.toLowerCase().includes(searchLower)
    )
  }
  
  filteredSpecimens.value = result
}

const clearFilters = () => {
  filters.value = {
    riskLevel: '',
    status: '',
    search: ''
  }
  applyFilters()
}

const goToSpecimenDetail = (id) => {
  router.push(`/specimens/${id}`)
}

// 初始化时应用筛选
applyFilters()
</script>

<style scoped>
.specimens {
  max-width: 1200px;
  margin: 0 auto;
}

.page-title {
  font-size: 2rem;
  margin-bottom: 2rem;
  color: #2c3e50;
}

.filter-section {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-group label {
  font-weight: 500;
  color: #333;
}

.filter-group select,
.filter-group input {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  min-width: 150px;
}

.specimen-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.specimen-card {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  border-left: 4px solid #95a5a6;
}

.specimen-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.specimen-card.risk-high {
  border-left-color: #e74c3c;
}

.specimen-card.risk-medium {
  border-left-color: #f39c12;
}

.specimen-card.risk-low {
  border-left-color: #27ae60;
}

.card-header {
  background: #f8f9fa;
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.risk-badge.medium {
  background-color: #fff3e0;
  color: #ef6c00;
}

.risk-badge.low {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.card-body {
  padding: 1.5rem;
}

.status-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.status-tag {
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.status-tag.cannot-store {
  background-color: #f3e5f5;
  color: #7b1fa2;
}

.status-tag.suspend-loan {
  background-color: #fff8e1;
  color: #f57f17;
}

.status-tag.manual {
  background-color: #e3f2fd;
  color: #1565c0;
}

.risk-reasons {
  margin-bottom: 1rem;
}

.risk-reasons h4 {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.risk-reasons ul {
  margin: 0;
  padding-left: 1.25rem;
  color: #666;
  font-size: 0.85rem;
}

.quick-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-item {
  display: flex;
  font-size: 0.85rem;
}

.info-label {
  color: #999;
  margin-right: 0.5rem;
}

.info-value {
  color: #333;
  font-weight: 500;
}

.card-footer {
  background: #f8f9fa;
  padding: 0.75rem 1.5rem;
  text-align: right;
}

.view-detail {
  color: #3498db;
  font-size: 0.9rem;
  font-weight: 500;
}

.no-results,
.no-data {
  text-align: center;
  padding: 3rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.no-results p,
.no-data p {
  margin-bottom: 1rem;
  color: #666;
  font-size: 1.1rem;
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
</style>
