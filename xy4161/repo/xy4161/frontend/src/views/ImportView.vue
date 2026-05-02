<template>
  <div class="import-view">
    <div class="page-header">
      <h2>数据导入</h2>
    </div>

    <div class="import-section">
      <div class="entity-selector">
        <button 
          v-for="entity in entities" 
          :key="entity.id"
          :class="['entity-btn', { active: selectedEntity === entity.id }]"
          @click="selectedEntity = entity.id"
        >
          <span class="entity-icon">{{ entity.icon }}</span>
          <span class="entity-label">{{ entity.label }}</span>
        </button>
      </div>

      <div class="import-area">
        <h4>导入 {{ getEntityLabel() }}</h4>
        
        <div class="upload-zone" @drop="handleDrop" @dragover.prevent @click="triggerFileInput">
          <input 
            type="file" 
            ref="fileInput"
            hidden
            :accept="acceptedTypes"
            @change="handleFileSelect"
          />
          <div class="upload-icon">📁</div>
          <p class="upload-text">
            拖拽文件到此处，或点击选择文件
          </p>
          <p class="upload-hint">
            支持 CSV 和 JSON 格式
          </p>
        </div>

        <div v-if="selectedFile" class="file-info">
          <span class="file-name">{{ selectedFile.name }}</span>
          <span class="file-size">{{ formatFileSize(selectedFile.size) }}</span>
          <button class="btn-clear" @click="clearFile">×</button>
        </div>

        <button 
          class="btn-import"
          :disabled="!selectedFile || importing"
          @click="importData"
        >
          {{ importing ? '导入中...' : '开始导入' }}
        </button>
      </div>

      <div v-if="importResult" class="result-section">
        <div :class="['result-header', importResult.success > 0 ? 'success' : 'error']">
          <h4>导入结果</h4>
        </div>
        <div class="result-stats">
          <div class="stat-item success">
            <span class="stat-value">{{ importResult.success }}</span>
            <span class="stat-label">成功</span>
          </div>
          <div class="stat-item error" v-if="importResult.failed > 0">
            <span class="stat-value">{{ importResult.failed }}</span>
            <span class="stat-label">失败</span>
          </div>
        </div>
        <div v-if="importResult.errors?.length > 0" class="errors-list">
          <h5>错误详情:</h5>
          <div v-for="(err, index) in importResult.errors" :key="index" class="error-item">
            <span class="error-msg">{{ err.error }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="example-section">
      <div class="section-header">
        <h3>示例数据</h3>
        <button class="btn-download" @click="downloadExampleData">下载示例数据</button>
      </div>
      <p>点击下方按钮可以下载示例数据文件，了解数据格式要求。</p>
      
      <div class="format-examples">
        <div class="format-example">
          <h4>病例数据格式 (cases)</h4>
          <pre><code>{
  "caseNumber": "CASE-2024-001",
  "patientName": "张三",
  "doctorName": "李医生",
  "clinicName": "阳光口腔",
  "status": "PRESCRIPTION_RECEIVED",
  "notes": "备注信息"
}</code></pre>
        </div>

        <div class="format-example">
          <h4>牙位数据格式 (teeth)</h4>
          <pre><code>{
  "caseId": "case-uuid",
  "toothNumber": 16,
  "toothType": "CROWN",
  "isRework": false,
  "reworkCount": 0,
  "version": 1,
  "status": "PENDING"
}</code></pre>
        </div>

        <div class="format-example">
          <h4>返工申请格式 (rework_requests)</h4>
          <pre><code>{
  "caseId": "case-uuid",
  "toothId": "tooth-uuid",
  "reasonCode": "FIT_ISSUE",
  "reasonDescription": "就位不良，边缘不密合",
  "reworkType": "MANUFACTURING",
  "requestedBy": "张技师",
  "sourceStep": "QUALITY_INSPECTION",
  "targetStep": "DIGITAL_DESIGN"
}</code></pre>
        </div>
      </div>
    </div>

    <div class="export-section">
      <div class="section-header">
        <h3>数据导出</h3>
      </div>
      <p>选择要导出的数据类型和格式</p>
      
      <div class="export-controls">
        <div class="control-group">
          <label>数据类型</label>
          <select v-model="exportEntity">
            <option v-for="entity in entities" :key="entity.id" :value="entity.id">
              {{ entity.label }}
            </option>
          </select>
        </div>
        <div class="control-group">
          <label>导出格式</label>
          <select v-model="exportFormat">
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
            <option value="markdown">Markdown</option>
          </select>
        </div>
        <button class="btn-export" @click="exportData">导出</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { importExportApi } from '../api'

const selectedEntity = ref('cases')
const selectedFile = ref(null)
const importing = ref(false)
const importResult = ref(null)
const exportEntity = ref('cases')
const exportFormat = ref('csv')
const fileInput = ref(null)

const entities = [
  { id: 'cases', label: '病例', icon: '📋' },
  { id: 'teeth', label: '牙位', icon: '🦷' },
  { id: 'prescriptions', label: '处方', icon: '📝' },
  { id: 'scan_files', label: '口扫文件', icon: '📁' },
  { id: 'process_steps', label: '工序', icon: '⚙️' },
  { id: 'rework_requests', label: '返工申请', icon: '🔄' },
  { id: 'try_in_feedbacks', label: '试戴反馈', icon: '💬' }
]

const acceptedTypes = '.csv,.json,text/csv,application/json'

const getEntityLabel = () => {
  const entity = entities.find(e => e.id === selectedEntity.value)
  return entity?.label || selectedEntity.value
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (e) => {
  const file = e.target.files?.[0]
  if (file) {
    selectedFile.value = file
    importResult.value = null
  }
}

const handleDrop = (e) => {
  e.preventDefault()
  const file = e.dataTransfer.files?.[0]
  if (file) {
    selectedFile.value = file
    importResult.value = null
  }
}

const clearFile = () => {
  selectedFile.value = null
  importResult.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const importData = async () => {
  if (!selectedFile.value) return
  
  importing.value = true
  importResult.value = null
  
  try {
    const response = await importExportApi.importData(selectedEntity.value, selectedFile.value)
    importResult.value = response.data
  } catch (e) {
    importResult.value = {
      success: 0,
      failed: 1,
      errors: [{ error: e.response?.data?.error || e.message }]
    }
  } finally {
    importing.value = false
  }
}

const exampleData = {
  cases: [
    {
      id: 'example-case-1',
      caseNumber: 'CASE-2024-001',
      patientName: '张三',
      doctorName: '李医生',
      clinicName: '阳光口腔',
      status: 'DESIGNING',
      notes: '烤瓷冠修复'
    },
    {
      id: 'example-case-2',
      caseNumber: 'CASE-2024-002',
      patientName: '李四',
      doctorName: '王医生',
      clinicName: '康泰口腔',
      status: 'MANUFACTURING',
      notes: '种植修复'
    }
  ],
  teeth: [
    {
      id: 'example-tooth-1',
      caseId: 'example-case-1',
      toothNumber: 16,
      toothType: 'CROWN',
      isRework: false,
      reworkCount: 0,
      version: 1,
      status: 'DESIGNING'
    },
    {
      id: 'example-tooth-2',
      caseId: 'example-case-1',
      toothNumber: 26,
      toothType: 'CROWN',
      isRework: true,
      reworkCount: 1,
      version: 2,
      status: 'REWORK_IN_PROGRESS'
    }
  ],
  rework_requests: [
    {
      id: 'example-rework-1',
      caseId: 'example-case-1',
      toothId: 'example-tooth-2',
      requestDate: '2024-05-01T10:00:00Z',
      reasonCode: 'FIT_ISSUE',
      reasonDescription: '就位不良，边缘不密合',
      reworkType: 'MANUFACTURING',
      requestedBy: '张技师',
      sourceStep: 'QUALITY_INSPECTION',
      targetStep: 'DIGITAL_DESIGN',
      status: 'APPROVED'
    }
  ]
}

const downloadExampleData = () => {
  const content = JSON.stringify(exampleData, null, 2)
  const blob = new Blob([content], { type: 'application/json' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'example-data.json'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

const exportData = async () => {
  try {
    const response = await importExportApi.exportData(exportEntity.value, exportFormat.value)
    
    const contentType = response.headers['content-type']
    const contentDisposition = response.headers['content-disposition']
    let filename = `${exportEntity.value}.${exportFormat.value}`
    
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/)
      if (match) filename = match[1]
    }
    
    const blob = new Blob([response.data], { type: contentType })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (e) {
    alert('导出失败: ' + (e.response?.data?.error || e.message))
  }
}
</script>

<style scoped>
.import-view {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.page-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #303133;
}

.import-section {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.entity-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.entity-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: #f5f7fa;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.entity-btn:hover {
  background: #ecf5ff;
}

.entity-btn.active {
  background: #ecf5ff;
  border-color: #409eff;
}

.entity-icon {
  font-size: 1.25rem;
}

.entity-label {
  font-weight: 500;
  color: #303133;
}

.import-area h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #303133;
  margin-bottom: 1rem;
}

.upload-zone {
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  padding: 3rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-zone:hover {
  border-color: #409eff;
  background: #fafafa;
}

.upload-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.upload-text {
  color: #303133;
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.upload-hint {
  color: #909399;
  font-size: 0.85rem;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background: #f5f7fa;
  border-radius: 6px;
}

.file-name {
  font-weight: 500;
  color: #303133;
}

.file-size {
  color: #909399;
  font-size: 0.9rem;
}

.btn-clear {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 1.25rem;
  color: #909399;
  cursor: pointer;
  line-height: 1;
}

.btn-clear:hover {
  color: #f56c6c;
}

.btn-import {
  margin-top: 1.5rem;
  width: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.875rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-import:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-import:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.result-section {
  margin-top: 2rem;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.result-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #ebeef5;
}

.result-header.success {
  background: #f0f9eb;
}

.result-header.error {
  background: #fef0f0;
}

.result-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #303133;
}

.result-stats {
  display: flex;
  gap: 2rem;
  padding: 1.5rem;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 2rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.stat-item.success .stat-value {
  color: #67c23a;
}

.stat-item.error .stat-value {
  color: #f56c6c;
}

.stat-label {
  color: #606266;
  font-size: 0.9rem;
}

.errors-list {
  padding: 1rem 1.5rem;
  border-top: 1px solid #ebeef5;
}

.errors-list h5 {
  font-size: 0.95rem;
  font-weight: 600;
  color: #f56c6c;
  margin-bottom: 0.75rem;
}

.error-item {
  padding: 0.5rem 0.75rem;
  background: #fef0f0;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.error-msg {
  color: #cf1322;
  font-size: 0.9rem;
}

.example-section,
.export-section {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.section-header h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #303133;
}

.btn-download {
  background: white;
  border: 1px solid #409eff;
  color: #409eff;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.btn-download:hover {
  background: #ecf5ff;
}

.example-section p,
.export-section p {
  color: #606266;
  margin-bottom: 1.5rem;
}

.format-examples {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.format-example {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 1rem;
}

.format-example h4 {
  font-size: 0.95rem;
  font-weight: 600;
  color: #303133;
  margin-bottom: 0.75rem;
}

.format-example pre {
  margin: 0;
  background: white;
  border-radius: 4px;
  padding: 0.75rem;
  overflow-x: auto;
}

.format-example code {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.8rem;
  color: #303133;
  line-height: 1.5;
}

.export-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.control-group label {
  font-weight: 500;
  color: #303133;
  font-size: 0.9rem;
}

.control-group select {
  padding: 0.6rem 1rem;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  font-size: 0.95rem;
  background: white;
  cursor: pointer;
  min-width: 150px;
}

.btn-export {
  background: #409eff;
  color: white;
  border: none;
  padding: 0.6rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: background 0.2s;
}

.btn-export:hover {
  background: #66b1ff;
}
</style>
