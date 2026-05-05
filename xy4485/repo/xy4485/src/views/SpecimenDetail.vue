<template>
  <div class="specimen-detail">
    <div class="page-header">
      <button @click="goBack" class="btn btn-secondary">
        ← 返回列表
      </button>
      <h2 class="page-title">标本详情：{{ specimen?.id }}</h2>
    </div>
    
    <div v-if="specimen" class="detail-content">
      <!-- 风险状态卡片 -->
      <div class="card risk-card" :class="`risk-${specimen.riskLevel}`">
        <div class="card-header">
          <h3>风险状态</h3>
          <span 
            class="risk-badge"
            :class="specimen.riskLevel"
          >
            {{ getRiskLevelText(specimen.riskLevel) }}
          </span>
        </div>
        
        <div class="risk-status">
          <div class="status-item" :class="{ active: specimen.cannotStore }">
            <span class="status-icon">🚫</span>
            <span class="status-text">不能入柜</span>
          </div>
          <div class="status-item" :class="{ active: specimen.suspendLoan }">
            <span class="status-icon">⏸️</span>
            <span class="status-text">暂停外借</span>
          </div>
          <div class="status-item" :class="{ active: specimen.hasManualOverride }">
            <span class="status-icon">✏️</span>
            <span class="status-text">已人工改判</span>
          </div>
        </div>
        
        <div class="risk-reasons-section" v-if="specimen.riskReasons.length > 0">
          <h4>风险原因：</h4>
          <ul class="risk-reasons">
            <li v-for="(reason, index) in specimen.riskReasons" :key="index">
              {{ reason }}
            </li>
          </ul>
        </div>
      </div>
      
      <!-- 人工改判卡片 -->
      <div class="card override-card">
        <div class="card-header">
          <h3>人工改判</h3>
          <button 
            v-if="specimen.hasManualOverride" 
            @click="handleClearOverride"
            class="btn btn-small btn-danger"
          >
            清除改判
          </button>
        </div>
        
        <div class="override-form">
          <div class="form-group">
            <label>风险等级：</label>
            <select v-model="overrideForm.riskLevel" @change="handleOverrideChange">
              <option value="">自动评估</option>
              <option value="high">高风险</option>
              <option value="medium">中等风险</option>
              <option value="low">低风险</option>
            </select>
          </div>
          
          <div class="form-group checkbox-group">
            <label>
              <input 
                type="checkbox" 
                v-model="overrideForm.cannotStore"
                @change="handleOverrideChange"
              />
              不能入柜
            </label>
            <label>
              <input 
                type="checkbox" 
                v-model="overrideForm.suspendLoan"
                @change="handleOverrideChange"
              />
              暂停外借
            </label>
          </div>
        </div>
      </div>
      
      <!-- 备注卡片 -->
      <div class="card notes-card">
        <div class="card-header">
          <h3>管理员备注</h3>
        </div>
        
        <div class="notes-form">
          <textarea 
            v-model="notes"
            placeholder="输入备注信息..."
            rows="4"
            @blur="handleNotesSave"
          ></textarea>
          <div class="notes-actions">
            <button @click="handleNotesSave" class="btn btn-small btn-primary">
              保存备注
            </button>
          </div>
        </div>
      </div>
      
      <!-- 详细数据卡片 -->
      <div class="card data-card">
        <div class="card-header">
          <h3>详细数据</h3>
        </div>
        
        <div class="data-sections">
          <!-- 冷冻温度记录 -->
          <div class="data-section" v-if="specimen.temperatureLog">
            <h4>❄️ 冷冻灭虫柜温度日志</h4>
            <div class="data-grid">
              <div class="data-item">
                <span class="data-label">日期：</span>
                <span class="data-value">{{ specimen.temperatureLog.date }}</span>
              </div>
              <div class="data-item">
                <span class="data-label">温度：</span>
                <span class="data-value" :class="getStatusClass(specimen.temperatureLog.status)">
                  {{ specimen.temperatureLog.temperature }}°C
                </span>
              </div>
              <div class="data-item">
                <span class="data-label">持续时间：</span>
                <span class="data-value">{{ specimen.temperatureLog.duration }} 小时</span>
              </div>
              <div class="data-item">
                <span class="data-label">状态：</span>
                <span class="data-value" :class="getStatusClass(specimen.temperatureLog.status)">
                  {{ specimen.temperatureLog.status }}
                </span>
              </div>
            </div>
          </div>
          
          <!-- 借展记录 -->
          <div class="data-section" v-if="specimen.loan">
            <h4>📋 标本借展清单</h4>
            <div class="data-grid">
              <div class="data-item">
                <span class="data-label">借展方：</span>
                <span class="data-value">{{ specimen.loan.borrower }}</span>
              </div>
              <div class="data-item">
                <span class="data-label">借展日期：</span>
                <span class="data-value">{{ specimen.loan.loanDate }}</span>
              </div>
              <div class="data-item">
                <span class="data-label">预计归还：</span>
                <span class="data-value">{{ specimen.loan.expectedReturn }}</span>
              </div>
              <div class="data-item">
                <span class="data-label">实际归还：</span>
                <span class="data-value">{{ specimen.loan.actualReturn || '未归还' }}</span>
              </div>
              <div class="data-item">
                <span class="data-label">归还状态：</span>
                <span class="data-value" :class="getConditionClass(specimen.loan.condition)">
                  {{ specimen.loan.condition || '未知' }}
                </span>
              </div>
            </div>
          </div>
          
          <!-- 归还复查 -->
          <div class="data-section" v-if="specimen.returnCheck">
            <h4>📷 归还照片复查表</h4>
            <div class="data-grid">
              <div class="data-item">
                <span class="data-label">复查日期：</span>
                <span class="data-value">{{ specimen.returnCheck.checkDate }}</span>
              </div>
              <div class="data-item">
                <span class="data-label">检查人：</span>
                <span class="data-value">{{ specimen.returnCheck.inspector }}</span>
              </div>
              <div class="data-item">
                <span class="data-label">照片：</span>
                <span class="data-value">{{ specimen.returnCheck.photos?.join('、') }}</span>
              </div>
              <div class="data-item">
                <span class="data-label">状态：</span>
                <span class="data-value" :class="getConditionClass(specimen.returnCheck.condition)">
                  {{ specimen.returnCheck.condition }}
                </span>
              </div>
            </div>
            <div v-if="specimen.returnCheck.issues?.length > 0" class="issues-section">
              <h5>发现的问题：</h5>
              <ul class="issues-list">
                <li v-for="(issue, index) in specimen.returnCheck.issues" :key="index">
                  {{ issue }}
                </li>
              </ul>
            </div>
          </div>
          
          <!-- 湿度记录 -->
          <div class="data-section" v-if="specimen.humidityRecord">
            <h4>💧 展柜湿度记录</h4>
            <div class="data-grid">
              <div class="data-item">
                <span class="data-label">展柜编号：</span>
                <span class="data-value">{{ specimen.humidityRecord.displayCase }}</span>
              </div>
              <div class="data-item">
                <span class="data-label">日期：</span>
                <span class="data-value">{{ specimen.humidityRecord.date }}</span>
              </div>
              <div class="data-item">
                <span class="data-label">湿度：</span>
                <span class="data-value" :class="getStatusClass(specimen.humidityRecord.status)">
                  {{ specimen.humidityRecord.humidity }}%
                </span>
              </div>
              <div class="data-item">
                <span class="data-label">状态：</span>
                <span class="data-value" :class="getStatusClass(specimen.humidityRecord.status)">
                  {{ specimen.humidityRecord.status }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="not-found">
      <p>未找到该标本信息</p>
      <router-link to="/specimens" class="btn btn-primary">返回标本列表</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useDataStore } from '../store/dataStore'
import { useRouter, useRoute } from 'vue-router'

const dataStore = useDataStore()
const router = useRouter()
const route = useRoute()

const specimen = ref(null)
const notes = ref('')
const overrideForm = ref({
  riskLevel: '',
  cannotStore: false,
  suspendLoan: false
})

const getRiskLevelText = (level) => {
  const map = {
    high: '高风险',
    medium: '中等风险',
    low: '低风险'
  }
  return map[level] || level
}

const getStatusClass = (status) => {
  if (status === '正常') return 'status-normal'
  if (status === '严重异常' || status === '严重偏高' || status === '严重偏低') return 'status-danger'
  if (status === '温度偏高' || status === '偏高' || status === '偏低') return 'status-warning'
  return ''
}

const getConditionClass = (condition) => {
  if (condition === '良好') return 'status-normal'
  if (condition === '严重损伤') return 'status-danger'
  if (condition === '轻微损伤') return 'status-warning'
  return ''
}

const goBack = () => {
  router.back()
}

const handleOverrideChange = () => {
  const override = {}
  
  if (overrideForm.value.riskLevel) {
    override.riskLevel = overrideForm.value.riskLevel
  }
  
  // 只有当用户明确勾选时才设置
  if (specimen.value.hasManualOverride || overrideForm.value.cannotStore !== specimen.value.cannotStore) {
    override.cannotStore = overrideForm.value.cannotStore
  }
  
  if (specimen.value.hasManualOverride || overrideForm.value.suspendLoan !== specimen.value.suspendLoan) {
    override.suspendLoan = overrideForm.value.suspendLoan
  }
  
  // 如果有任何改判内容，保存
  if (Object.keys(override).length > 0) {
    dataStore.setManualOverride(route.params.id, override)
  }
}

const handleClearOverride = () => {
  if (confirm('确定要清除人工改判吗？将恢复自动评估结果。')) {
    dataStore.clearManualOverride(route.params.id)
    // 重置表单
    overrideForm.value = {
      riskLevel: '',
      cannotStore: false,
      suspendLoan: false
    }
  }
}

const handleNotesSave = () => {
  dataStore.setNotes(route.params.id, notes.value)
}

// 加载标本数据
const loadSpecimen = () => {
  const id = route.params.id
  const found = dataStore.getSpecimenById(id)
  
  if (found) {
    specimen.value = found
    notes.value = found.notes || ''
    
    // 初始化改判表单
    if (found.hasManualOverride) {
      const manualOverride = dataStore.state.manualOverrides[id]
      overrideForm.value = {
        riskLevel: manualOverride?.riskLevel || '',
        cannotStore: manualOverride?.cannotStore !== undefined ? manualOverride.cannotStore : found.cannotStore,
        suspendLoan: manualOverride?.suspendLoan !== undefined ? manualOverride.suspendLoan : found.suspendLoan
      }
    } else {
      overrideForm.value = {
        riskLevel: '',
        cannotStore: found.cannotStore,
        suspendLoan: found.suspendLoan
      }
    }
  }
}

onMounted(() => {
  loadSpecimen()
})

// 监听路由参数变化
watch(() => route.params.id, () => {
  loadSpecimen()
})
</script>

<style scoped>
.specimen-detail {
  max-width: 1000px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.page-title {
  font-size: 2rem;
  color: #2c3e50;
  margin: 0;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #eee;
}

.card-header h3 {
  font-size: 1.1rem;
  color: #2c3e50;
  margin: 0;
}

.risk-card {
  border-left: 4px solid #95a5a6;
}

.risk-card.risk-high {
  border-left-color: #e74c3c;
}

.risk-card.risk-medium {
  border-left-color: #f39c12;
}

.risk-card.risk-low {
  border-left-color: #27ae60;
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

.risk-status {
  display: flex;
  gap: 2rem;
  margin-bottom: 1rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  opacity: 0.5;
}

.status-item.active {
  opacity: 1;
}

.status-icon {
  font-size: 1.2rem;
}

.status-text {
  font-weight: 500;
  color: #333;
}

.risk-reasons-section h4 {
  font-size: 0.95rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.risk-reasons {
  margin: 0;
  padding-left: 1.25rem;
  color: #666;
}

.risk-reasons li {
  margin-bottom: 0.25rem;
}

.override-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.form-group label {
  font-weight: 500;
  color: #333;
  min-width: 80px;
}

.form-group select {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  min-width: 150px;
}

.checkbox-group {
  gap: 2rem;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: auto;
  font-weight: normal;
  cursor: pointer;
}

.checkbox-group input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.notes-form textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
  resize: vertical;
  margin-bottom: 0.75rem;
}

.notes-actions {
  display: flex;
  justify-content: flex-end;
}

.data-sections {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.data-section {
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.data-section h4 {
  font-size: 1rem;
  color: #2c3e50;
  margin-bottom: 1rem;
}

.data-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.data-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.data-label {
  font-size: 0.85rem;
  color: #999;
}

.data-value {
  font-weight: 500;
  color: #333;
}

.data-value.status-normal {
  color: #27ae60;
}

.data-value.status-warning {
  color: #f39c12;
}

.data-value.status-danger {
  color: #e74c3c;
}

.issues-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #dee2e6;
}

.issues-section h5 {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.issues-list {
  margin: 0;
  padding-left: 1.25rem;
  color: #e74c3c;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.2s;
  text-decoration: none;
  display: inline-block;
}

.btn-small {
  padding: 0.375rem 0.75rem;
  font-size: 0.85rem;
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

.not-found {
  text-align: center;
  padding: 3rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.not-found p {
  margin-bottom: 1rem;
  color: #666;
  font-size: 1.1rem;
}
</style>
