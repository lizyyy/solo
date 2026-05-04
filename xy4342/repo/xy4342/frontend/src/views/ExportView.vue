<template>
  <div class="export-view">
    <div class="page-header">
      <h2>📤 导出报告</h2>
      <p>导出连续性检查结果，支持 Markdown 报告、CSV 问题清单和 JSON 审计包</p>
    </div>

    <div class="filter-section">
      <h3>📋 导出筛选</h3>
      <div class="filter-options">
        <div class="filter-group">
          <label>包含状态</label>
          <div class="checkbox-group">
            <label class="checkbox-item">
              <input 
                type="checkbox" 
                v-model="filterStatuses" 
                value="open"
              />
              <span>待处理</span>
            </label>
            <label class="checkbox-item">
              <input 
                type="checkbox" 
                v-model="filterStatuses" 
                value="confirmed"
              />
              <span>已确认</span>
            </label>
            <label class="checkbox-item">
              <input 
                type="checkbox" 
                v-model="filterStatuses" 
                value="dismissed"
              />
              <span>已忽略</span>
            </label>
            <label class="checkbox-item">
              <input 
                type="checkbox" 
                v-model="filterStatuses" 
                value="fixed"
              />
              <span>已修复</span>
            </label>
          </div>
        </div>

        <div class="filter-group">
          <label>包含类别</label>
          <div class="checkbox-group">
            <label class="checkbox-item">
              <input 
                type="checkbox" 
                v-model="filterCategories" 
                value="costume"
              />
              <span>服装不一致</span>
            </label>
            <label class="checkbox-item">
              <input 
                type="checkbox" 
                v-model="filterCategories" 
                value="prop"
              />
              <span>道具不一致</span>
            </label>
            <label class="checkbox-item">
              <input 
                type="checkbox" 
                v-model="filterCategories" 
                value="timeline"
              />
              <span>时间线问题</span>
            </label>
            <label class="checkbox-item">
              <input 
                type="checkbox" 
                v-model="filterCategories" 
                value="address"
              />
              <span>称呼不一致</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="export-options">
      <div class="export-card">
        <div class="card-icon">📄</div>
        <h3>Markdown 连续性报告</h3>
        <p>导出完整的连续性检查报告，包含概览、统计和问题详情，可直接用于文档存档或分享</p>
        <div class="card-features">
          <span class="feature">✓ 完整报告格式</span>
          <span class="feature">✓ 问题统计分析</span>
          <span class="feature">✓ 复核记录包含</span>
        </div>
        <button 
          @click="exportMarkdown"
          :disabled="exporting"
          class="btn btn-primary btn-large"
        >
          {{ exporting === 'markdown' ? '导出中...' : '导出 Markdown' }}
        </button>
      </div>

      <div class="export-card">
        <div class="card-icon">📊</div>
        <h3>CSV 问题清单</h3>
        <p>导出结构化的问题清单，便于在 Excel 或其他表格工具中进一步分析和处理</p>
        <div class="card-features">
          <span class="feature">✓ 表格格式</span>
          <span class="feature">✓ 完整字段</span>
          <span class="feature">✓ 易于筛选分析</span>
        </div>
        <button 
          @click="exportCsv"
          :disabled="exporting"
          class="btn btn-primary btn-large"
        >
          {{ exporting === 'csv' ? '导出中...' : '导出 CSV' }}
        </button>
      </div>

      <div class="export-card">
        <div class="card-icon">🔍</div>
        <h3>JSON 审计包</h3>
        <p>导出完整的审计数据包，包含所有章节、角色、问题和复核记录，用于程序处理或备份</p>
        <div class="card-features">
          <span class="feature">✓ 完整数据快照</span>
          <span class="feature">✓ 程序可读格式</span>
          <span class="feature">✓ 可用于备份</span>
        </div>
        <button 
          @click="exportJson"
          :disabled="exporting"
          class="btn btn-primary btn-large"
        >
          {{ exporting === 'json' ? '导出中...' : '导出 JSON' }}
        </button>
      </div>
    </div>

    <div v-if="messages.length" class="messages">
      <div 
        v-for="(msg, idx) in messages" 
        :key="idx"
        class="message"
        :class="msg.type"
      >
        {{ msg.text }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import api from '@/api'

const filterStatuses = ref([])
const filterCategories = ref([])
const exporting = ref(null)
const messages = ref([])

const addMessage = (text, type = 'info') => {
  messages.value.push({ text, type })
  setTimeout(() => {
    const idx = messages.value.findIndex(m => m.text === text)
    if (idx > -1) messages.value.splice(idx, 1)
  }, 5000)
}

const getExportParams = () => {
  const params = {}
  if (filterStatuses.value.length > 0) {
    params.include_statuses = filterStatuses.value.join(',')
  }
  if (filterCategories.value.length > 0) {
    params.include_categories = filterCategories.value.join(',')
  }
  return params
}

const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

const exportMarkdown = async () => {
  exporting.value = 'markdown'
  try {
    const response = await api.exportMarkdown(getExportParams())
    const filename = `continuity_report_${new Date().toISOString().slice(0, 10)}.md`
    downloadFile(response.data, filename)
    addMessage('Markdown 报告导出成功！', 'success')
  } catch (e) {
    addMessage(`导出失败: ${e.message}`, 'error')
  } finally {
    exporting.value = null
  }
}

const exportCsv = async () => {
  exporting.value = 'csv'
  try {
    const response = await api.exportCsv(getExportParams())
    const filename = `issues_list_${new Date().toISOString().slice(0, 10)}.csv`
    downloadFile(response.data, filename)
    addMessage('CSV 问题清单导出成功！', 'success')
  } catch (e) {
    addMessage(`导出失败: ${e.message}`, 'error')
  } finally {
    exporting.value = null
  }
}

const exportJson = async () => {
  exporting.value = 'json'
  try {
    const response = await api.exportJson(getExportParams())
    const filename = `audit_package_${new Date().toISOString().slice(0, 10)}.json`
    downloadFile(response.data, filename)
    addMessage('JSON 审计包导出成功！', 'success')
  } catch (e) {
    addMessage(`导出失败: ${e.message}`, 'error')
  } finally {
    exporting.value = null
  }
}
</script>

<style scoped>
.export-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-header h2 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.page-header p {
  margin: 0;
  color: #666;
}

.filter-section {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.filter-section h3 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: #555;
}

.filter-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.filter-group label {
  display: block;
  font-weight: 600;
  color: #555;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.checkbox-item input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.checkbox-item span {
  color: #333;
  font-size: 0.9rem;
}

.export-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
}

.export-card {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  border-top: 4px solid #667eea;
  transition: all 0.2s ease;
}

.export-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
}

.card-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.export-card h3 {
  margin: 0 0 0.75rem 0;
  color: #333;
  font-size: 1.1rem;
}

.export-card p {
  margin: 0 0 1rem 0;
  color: #666;
  line-height: 1.6;
  font-size: 0.9rem;
}

.card-features {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
}

.feature {
  font-size: 0.85rem;
  color: #28a745;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  font-size: 0.95rem;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-large {
  padding: 0.85rem 2rem;
  font-size: 1rem;
}

.messages {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.message {
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.95rem;
}

.message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.message.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

@media (max-width: 768px) {
  .export-options {
    grid-template-columns: 1fr;
  }
  
  .filter-options {
    grid-template-columns: 1fr;
  }
  
  .checkbox-group {
    flex-direction: column;
    gap: 0.5rem;
  }
}
</style>
