<template>
  <div class="case-list">
    <div class="page-header">
      <h2>病例列表</h2>
      <div class="header-actions">
        <button class="btn-secondary" @click="showCreateModal = true">
          ➕ 新建病例
        </button>
      </div>
    </div>

    <div class="filters">
      <input 
        type="text" 
        v-model="searchQuery" 
        placeholder="搜索病例编号、患者姓名、医生姓名..."
        class="search-input"
        @input="handleSearch"
      />
      <select v-model="statusFilter" class="filter-select" @change="loadCases">
        <option value="">全部状态</option>
        <option v-for="(label, key) in statusOptions" :key="key" :value="key">
          {{ label }}
        </option>
      </select>
    </div>

    <div v-if="store.loading" class="loading">
      <p>加载中...</p>
    </div>

    <div v-else-if="store.cases.length === 0" class="empty-state">
      <div class="empty-icon">📋</div>
      <h3>暂无病例</h3>
      <p>点击"新建病例"开始添加，或使用数据导入功能</p>
    </div>

    <div v-else class="case-grid">
      <router-link 
        v-for="caseItem in store.cases" 
        :key="caseItem.id"
        :to="`/cases/${caseItem.id}`"
        class="case-card"
      >
        <div class="case-header">
          <span class="case-number">{{ caseItem.case_number }}</span>
          <span :class="['status-badge', 'status-' + caseItem.status.toLowerCase()]">
            {{ caseItem.statusDescription }}
          </span>
        </div>
        <div class="case-body">
          <div class="case-info">
            <span class="info-label">患者</span>
            <span class="info-value">{{ caseItem.patient_name }}</span>
          </div>
          <div class="case-info" v-if="caseItem.doctor_name">
            <span class="info-label">医生</span>
            <span class="info-value">{{ caseItem.doctor_name }}</span>
          </div>
          <div class="case-info" v-if="caseItem.clinic_name">
            <span class="info-label">诊所</span>
            <span class="info-value">{{ caseItem.clinic_name }}</span>
          </div>
        </div>
        <div class="case-footer">
          <span class="create-time">{{ formatDate(caseItem.created_at) }}</span>
        </div>
      </router-link>
    </div>

    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>新建病例</h3>
          <button class="modal-close" @click="showCreateModal = false">&times;</button>
        </div>
        <form @submit.prevent="createCase">
          <div class="form-group">
            <label>病例编号 *</label>
            <input 
              type="text" 
              v-model="newCase.caseNumber" 
              required
              placeholder="例如: CASE-2024-001"
            />
          </div>
          <div class="form-group">
            <label>患者姓名 *</label>
            <input 
              type="text" 
              v-model="newCase.patientName" 
              required
              placeholder="例如: 张三"
            />
          </div>
          <div class="form-group">
            <label>医生姓名</label>
            <input 
              type="text" 
              v-model="newCase.doctorName" 
              placeholder="例如: 李医生"
            />
          </div>
          <div class="form-group">
            <label>诊所名称</label>
            <input 
              type="text" 
              v-model="newCase.clinicName" 
              placeholder="例如: 阳光口腔"
            />
          </div>
          <div class="form-group">
            <label>备注</label>
            <textarea 
              v-model="newCase.notes" 
              rows="3"
              placeholder="备注信息..."
            ></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-cancel" @click="showCreateModal = false">
              取消
            </button>
            <button type="submit" class="btn-submit" :disabled="createLoading">
              {{ createLoading ? '创建中...' : '创建' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useCaseStore } from '../stores/cases'

const store = useCaseStore()
const searchQuery = ref('')
const statusFilter = ref('')
const showCreateModal = ref(false)
const createLoading = ref(false)

const newCase = reactive({
  caseNumber: '',
  patientName: '',
  doctorName: '',
  clinicName: '',
  notes: ''
})

const statusOptions = {
  PRESCRIPTION_RECEIVED: '处方已接收',
  SCAN_RECEIVED: '口扫已接收',
  DESIGNING: '设计中',
  DESIGN_APPROVED: '设计已批准',
  MANUFACTURING: '加工中',
  QUALITY_CHECK: '质检中',
  TRY_IN: '试戴中',
  TRY_IN_FEEDBACK_RECEIVED: '试戴反馈已接收',
  FINAL_DELIVERY: '最终交付',
  COMPLETED: '已完成',
  REWORK_IN_PROGRESS: '返工进行中',
  CANCELLED: '已取消'
}

const loadCases = async () => {
  const params = {}
  if (statusFilter.value) {
    params.status = statusFilter.value
  }
  if (searchQuery.value) {
    params.search = searchQuery.value
  }
  await store.fetchCases(params)
}

const handleSearch = () => {
  loadCases()
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

const createCase = async () => {
  if (!newCase.caseNumber || !newCase.patientName) return
  
  createLoading.value = true
  try {
    await store.createCase({
      caseNumber: newCase.caseNumber,
      patientName: newCase.patientName,
      doctorName: newCase.doctorName || null,
      clinicName: newCase.clinicName || null,
      notes: newCase.notes || null
    })
    showCreateModal.value = false
    Object.assign(newCase, {
      caseNumber: '',
      patientName: '',
      doctorName: '',
      clinicName: '',
      notes: ''
    })
  } catch (e) {
    alert('创建失败: ' + (e.response?.data?.error || e.message))
  } finally {
    createLoading.value = false
  }
}

onMounted(() => {
  loadCases()
})
</script>

<style scoped>
.case-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #303133;
}

.btn-secondary {
  background: white;
  color: #409eff;
  border: 1px solid #409eff;
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: #ecf5ff;
}

.filters {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 250px;
  padding: 0.75rem 1rem;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  font-size: 0.95rem;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #409eff;
}

.filter-select {
  padding: 0.75rem 1rem;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  font-size: 0.95rem;
  background: white;
  cursor: pointer;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #909399;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  color: #303133;
  margin-bottom: 0.5rem;
}

.empty-state p {
  color: #909399;
}

.case-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}

.case-card {
  background: white;
  border-radius: 8px;
  padding: 1.2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  text-decoration: none;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.case-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  border-color: #409eff;
}

.case-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.case-number {
  font-size: 1.1rem;
  font-weight: 600;
  color: #303133;
}

.status-badge {
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
}

.status-prescription_received {
  background: #f4f4f5;
  color: #71717a;
}

.status-scan_received {
  background: #e0f2fe;
  color: #0284c7;
}

.status-designing,
.status-manufacturing {
  background: #fff7ed;
  color: #c2410c;
}

.status-design_approved {
  background: #dbeafe;
  color: #1d4ed8;
}

.status-quality_check {
  background: #fef3c7;
  color: #b45309;
}

.status-try_in,
.status-try_in_feedback_received {
  background: #fce7f3;
  color: #be185d;
}

.status-final_delivery {
  background: #d1fae5;
  color: #059669;
}

.status-completed {
  background: #dcfce7;
  color: #166534;
}

.status-rework_in_progress {
  background: #fee2e2;
  color: #dc2626;
}

.case-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.case-info {
  display: flex;
  gap: 0.5rem;
}

.info-label {
  color: #909399;
  min-width: 40px;
}

.info-value {
  color: #303133;
  font-weight: 500;
}

.case-footer {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #ebeef5;
}

.create-time {
  color: #909399;
  font-size: 0.85rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #ebeef5;
}

.modal-header h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #303133;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #909399;
}

form {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #303133;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  font-size: 0.95rem;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #409eff;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.btn-cancel {
  background: white;
  color: #606266;
  border: 1px solid #dcdfe6;
  padding: 0.6rem 1.5rem;
  border-radius: 6px;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: #f5f7fa;
}

.btn-submit {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.6rem 1.5rem;
  border-radius: 6px;
  font-size: 0.95rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-submit:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
