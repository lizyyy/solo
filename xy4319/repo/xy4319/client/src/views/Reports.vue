<template>
  <div class="reports-page">
    <div class="section-card">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">📄</span>
          <h2>演练复盘报告</h2>
        </div>
        <p class="section-desc">生成包含演练全过程的详细复盘报告，用于演练总结和质量改进分析</p>
      </div>
      
      <div class="report-options">
        <div class="option-group">
          <label class="option-label">报告内容选项</label>
          <div class="checkbox-list">
            <label class="checkbox-item">
              <input type="checkbox" v-model="reportOptions.includePatients" />
              <span>患者数据与分诊记录</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="reportOptions.includeTransfers" />
              <span>转运队列与优先级</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="reportOptions.includeBeds" />
              <span>床位使用情况</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="reportOptions.includeRules" />
              <span>规则检查结果</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" v-model="reportOptions.includeLogs" />
              <span>关键操作日志</span>
            </label>
          </div>
        </div>
        
        <div class="option-group">
          <label class="option-label">报告格式</label>
          <div class="radio-list">
            <label class="radio-item">
              <input type="radio" v-model="reportFormat" value="markdown" />
              <span>Markdown 格式 (.md)</span>
            </label>
            <label class="radio-item">
              <input type="radio" v-model="reportFormat" value="html" />
              <span>HTML 格式 (.html)</span>
            </label>
          </div>
        </div>
      </div>
      
      <div class="action-bar">
        <button class="btn btn-primary" @click="generateReport" :disabled="exporting">
          <span v-if="exporting">
            <span class="spinner"></span>
            生成中...
          </span>
          <span v-else>📄 生成并下载报告</span>
        </button>
        <button class="btn btn-secondary" @click="previewReport" :disabled="exporting">
          👁️ 预览报告
        </button>
      </div>
    </div>

    <div class="section-card">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">📋</span>
          <h2>数据导出</h2>
        </div>
        <p class="section-desc">导出各类数据用于进一步分析或归档</p>
      </div>
      
      <div class="export-cards">
        <div class="export-card">
          <div class="export-icon">👥</div>
          <div class="export-info">
            <h3>患者数据</h3>
            <p>导出所有患者的详细信息，包括分诊级别、等待时间、转运状态等</p>
          </div>
          <button class="btn btn-outline" @click="exportPatients">
            📥 导出 CSV
          </button>
        </div>
        
        <div class="export-card warning">
          <div class="export-icon">🚨</div>
          <div class="export-info">
            <h3>异常事件清单</h3>
            <p>导出演练过程中记录的所有异常事件，包括等待超时、床位冲突、分诊错误等</p>
          </div>
          <button class="btn btn-outline btn-warning" @click="exportIncidents">
            📥 导出 CSV
          </button>
        </div>
        
        <div class="export-card">
          <div class="export-icon">🚑</div>
          <div class="export-info">
            <h3>转运记录</h3>
            <p>导出所有转运请求的处理记录，包括优先级计算、等待时间、完成情况</p>
          </div>
          <button class="btn btn-outline" @click="exportTransfers">
            📥 导出 CSV
          </button>
        </div>
        
        <div class="export-card">
          <div class="export-icon">📝</div>
          <div class="export-info">
            <h3>操作日志</h3>
            <p>导出完整的操作日志，用于追溯演练过程中的所有操作记录</p>
          </div>
          <button class="btn btn-outline" @click="exportLogs">
            📥 导出 CSV
          </button>
        </div>
      </div>
    </div>

    <div class="section-card">
      <div class="section-header">
        <div class="section-title">
          <span class="section-icon">📊</span>
          <h2>演练统计概览</h2>
        </div>
      </div>
      
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-box-header">
            <span class="stat-box-icon">👥</span>
            <span class="stat-box-label">患者统计</span>
          </div>
          <div class="stat-box-content">
            <div class="stat-box-value">{{ patientsStats.total || 0 }}</div>
            <div class="stat-box-breakdown">
              <span class="triage-red">红区: {{ patientsStats.red || 0 }}</span>
              <span class="triage-yellow">黄区: {{ patientsStats.yellow || 0 }}</span>
              <span class="triage-green">绿区: {{ patientsStats.green || 0 }}</span>
            </div>
          </div>
        </div>
        
        <div class="stat-box">
          <div class="stat-box-header">
            <span class="stat-box-icon">🚑</span>
            <span class="stat-box-label">转运统计</span>
          </div>
          <div class="stat-box-content">
            <div class="stat-box-value">{{ transfersStats.total || 0 }}</div>
            <div class="stat-box-breakdown">
              <span>等待: {{ transfersStats.pending || 0 }}</span>
              <span>进行中: {{ transfersStats.active || 0 }}</span>
              <span>已完成: {{ transfersStats.completed || 0 }}</span>
            </div>
          </div>
        </div>
        
        <div class="stat-box">
          <div class="stat-box-header">
            <span class="stat-box-icon">🛏️</span>
            <span class="stat-box-label">床位使用</span>
          </div>
          <div class="stat-box-content">
            <div class="stat-box-value">{{ bedsStats.total || 0 }}</div>
            <div class="stat-box-breakdown">
              <span class="status-available">可用: {{ bedsStats.available || 0 }}</span>
              <span class="status-occupied">占用: {{ bedsStats.occupied || 0 }}</span>
            </div>
          </div>
        </div>
        
        <div class="stat-box warning">
          <div class="stat-box-header">
            <span class="stat-box-icon">⚠️</span>
            <span class="stat-box-label">异常事件</span>
          </div>
          <div class="stat-box-content">
            <div class="stat-box-value">{{ incidentsStats.total || 0 }}</div>
            <div class="stat-box-breakdown">
              <span class="incident-critical">严重: {{ incidentsStats.critical || 0 }}</span>
              <span class="incident-warning">警告: {{ incidentsStats.warning || 0 }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showPreview" class="modal-overlay" @click.self="showPreview = false">
          <div class="modal modal-xl">
            <div class="modal-header">
              <h3 class="modal-title">📄 报告预览</h3>
              <button class="btn-text" @click="showPreview = false">✕</button>
            </div>
            <div class="modal-body">
              <div class="preview-container">
                <pre class="markdown-preview">{{ previewContent }}</pre>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" @click="copyPreview">📋 复制到剪贴板</button>
              <button class="btn btn-primary" @click="downloadPreview">💾 下载</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="toastMessage" class="toast-wrapper">
          <div class="toast" :class="toastType">
            <span class="toast-icon">{{ toastIcon }}</span>
            <span class="toast-text">{{ toastMessage }}</span>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePatientsStore } from '@/stores/patients'
import { useTransfersStore } from '@/stores/transfers'
import { useSystemStore } from '@/stores/system'
import api from '@/api'

const patientsStore = usePatientsStore()
const transfersStore = useTransfersStore()
const systemStore = useSystemStore()

const exporting = ref(false)
const showPreview = ref(false)
const previewContent = ref('')
const reportFormat = ref('markdown')
const toastMessage = ref('')
const toastType = ref('success')

const reportOptions = ref({
  includePatients: true,
  includeTransfers: true,
  includeBeds: true,
  includeRules: true,
  includeLogs: true
})

const patientsStats = computed(() => ({
  total: patientsStore.patients.length,
  red: patientsStore.patients.filter(p => p.triageLevel === 'red').length,
  yellow: patientsStore.patients.filter(p => p.triageLevel === 'yellow').length,
  green: patientsStore.patients.filter(p => p.triageLevel === 'green').length
}))

const transfersStats = computed(() => ({
  total: transfersStore.transfers.length,
  pending: transfersStore.transfers.filter(t => t.status === 'pending').length,
  active: transfersStore.transfers.filter(t => t.status === 'active').length,
  completed: transfersStore.transfers.filter(t => t.status === 'completed').length
}))

const bedsStats = computed(() => ({
  total: systemStore.beds.length,
  available: systemStore.beds.filter(b => b.status === 'available').length,
  occupied: systemStore.beds.filter(b => b.status === 'occupied').length
}))

const incidentsStats = computed(() => {
  const results = systemStore.ruleResults
  if (!results) return { total: 0, critical: 0, warning: 0 }
  
  const timeouts = results.waitTimeouts?.length || 0
  const conflicts = results.bedConflicts?.length || 0
  const triageErrors = results.triageErrors?.length || 0
  const capacityIssues = results.departmentCapacity?.length || 0
  
  return {
    total: timeouts + conflicts + triageErrors + capacityIssues,
    critical: timeouts + conflicts,
    warning: triageErrors + capacityIssues
  }
})

const toastIcon = computed(() => {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' }
  return icons[toastType.value] || 'ℹ️'
})

function showToast(message, type = 'success') {
  toastMessage.value = message
  toastType.value = type
  setTimeout(() => {
    toastMessage.value = ''
  }, 3000)
}

function downloadFile(url, filename) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

async function generateReport() {
  exporting.value = true
  try {
    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `演练复盘报告_${timestamp}.md`
    
    const response = await fetch(api.export.report(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
    
    if (!response.ok) throw new Error('生成报告失败')
    
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    downloadFile(url, filename)
    URL.revokeObjectURL(url)
    
    showToast('报告已生成并下载', 'success')
  } catch (error) {
    showToast('生成报告失败: ' + error.message, 'error')
  } finally {
    exporting.value = false
  }
}

async function previewReport() {
  exporting.value = true
  try {
    const response = await fetch(api.export.report(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
    
    if (!response.ok) throw new Error('获取报告失败')
    
    previewContent.value = await response.text()
    showPreview.value = true
  } catch (error) {
    showToast('预览失败: ' + error.message, 'error')
  } finally {
    exporting.value = false
  }
}

function copyPreview() {
  navigator.clipboard.writeText(previewContent.value)
    .then(() => showToast('已复制到剪贴板', 'success'))
    .catch(() => showToast('复制失败', 'error'))
}

function downloadPreview() {
  const timestamp = new Date().toISOString().slice(0, 10)
  const filename = `演练复盘报告_${timestamp}.md`
  
  const blob = new Blob([previewContent.value], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  downloadFile(url, filename)
  URL.revokeObjectURL(url)
  
  showToast('报告已下载', 'success')
}

async function exportPatients() {
  try {
    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `患者数据_${timestamp}.csv`
    downloadFile(api.export.patients(), filename)
    showToast('患者数据导出中...', 'info')
  } catch (error) {
    showToast('导出失败: ' + error.message, 'error')
  }
}

async function exportIncidents() {
  try {
    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `异常事件清单_${timestamp}.csv`
    downloadFile(api.export.incidents(), filename)
    showToast('异常事件清单导出中...', 'info')
  } catch (error) {
    showToast('导出失败: ' + error.message, 'error')
  }
}

async function exportTransfers() {
  try {
    showToast('转运记录导出功能开发中', 'warning')
  } catch (error) {
    showToast('导出失败: ' + error.message, 'error')
  }
}

async function exportLogs() {
  try {
    showToast('操作日志导出功能开发中', 'warning')
  } catch (error) {
    showToast('导出失败: ' + error.message, 'error')
  }
}

onMounted(() => {
  patientsStore.fetchPatients()
  transfersStore.fetchTransfers()
  systemStore.fetchBeds()
  systemStore.fetchDepartments()
  systemStore.runRulesCheck()
})
</script>

<style scoped>
.reports-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-card {
  background: white;
  border-radius: var(--radius);
  border: 1px solid var(--color-gray-200);
  padding: 24px;
}

.section-header {
  margin-bottom: 20px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.section-icon {
  font-size: 24px;
}

.section-title h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-gray-900);
}

.section-desc {
  margin: 0;
  font-size: 14px;
  color: var(--color-gray-600);
}

.report-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  margin-bottom: 24px;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-gray-700);
}

.checkbox-list,
.radio-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkbox-item,
.radio-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--color-gray-800);
  cursor: pointer;
}

.checkbox-item input,
.radio-item input {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.action-bar {
  display: flex;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--color-gray-100);
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 6px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.export-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.export-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: var(--color-gray-50);
  border-radius: var(--radius);
  border: 1px solid var(--color-gray-200);
  transition: all var(--transition-fast);
}

.export-card:hover {
  border-color: var(--color-blue);
  box-shadow: var(--shadow-md);
}

.export-card.warning {
  background: #fffbeb;
  border-color: #fcd34d;
}

.export-card.warning:hover {
  border-color: var(--color-yellow);
}

.export-icon {
  font-size: 32px;
}

.export-info h3 {
  margin: 0 0 6px 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-gray-900);
}

.export-info p {
  margin: 0;
  font-size: 13px;
  color: var(--color-gray-600);
  line-height: 1.5;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.stat-box {
  padding: 20px;
  background: var(--color-gray-50);
  border-radius: var(--radius);
  border: 1px solid var(--color-gray-200);
}

.stat-box.warning {
  background: #fffbeb;
  border-color: #fcd34d;
}

.stat-box-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.stat-box-icon {
  font-size: 18px;
}

.stat-box-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-gray-600);
}

.stat-box-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-box-value {
  font-size: 36px;
  font-weight: 700;
  color: var(--color-gray-900);
}

.stat-box-breakdown {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: var(--color-gray-600);
}

.triage-red { color: var(--color-red); font-weight: 600; }
.triage-yellow { color: var(--color-yellow); font-weight: 600; }
.triage-green { color: var(--color-green); font-weight: 600; }
.status-available { color: var(--color-green); font-weight: 600; }
.status-occupied { color: var(--color-red); font-weight: 600; }
.incident-critical { color: var(--color-red); font-weight: 600; }
.incident-warning { color: var(--color-yellow); font-weight: 600; }

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

.modal {
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  max-width: 90vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.modal-xl {
  width: 1000px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-gray-200);
}

.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--color-gray-200);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.preview-container {
  background: var(--color-gray-900);
  border-radius: var(--radius);
  padding: 16px;
  max-height: 500px;
  overflow: auto;
}

.markdown-preview {
  margin: 0;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #e5e7eb;
  white-space: pre-wrap;
  word-break: break-word;
}

.toast-wrapper {
  position: fixed;
  top: 80px;
  right: 24px;
  z-index: 9999;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: white;
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  border-left: 4px solid;
  min-width: 280px;
}

.toast.success { border-left-color: var(--color-green); }
.toast.error { border-left-color: var(--color-red); }
.toast.warning { border-left-color: var(--color-yellow); }
.toast.info { border-left-color: var(--color-blue); }

.toast-icon { font-size: 18px; }
.toast-text { font-size: 14px; color: var(--color-gray-800); }

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
