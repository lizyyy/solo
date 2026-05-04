<template>
  <div class="export-panel">
    <h3>📤 导出数据</h3>
    
    <div class="export-options">
      <!-- 导出范围选择 -->
      <div class="form-group">
        <label>导出范围</label>
        <div class="radio-group">
          <label class="radio-item">
            <input 
              type="radio" 
              v-model="exportScope" 
              value="all"
              @change="handleScopeChange"
            />
            <span>全部事件 ({{ allEvents.length }})</span>
          </label>
          <label class="radio-item">
            <input 
              type="radio" 
              v-model="exportScope" 
              value="selected"
              :disabled="selectedEventIds.length === 0"
              @change="handleScopeChange"
            />
            <span>已选中 ({{ selectedEventIds.length }})</span>
          </label>
        </div>
      </div>
      
      <!-- Markdown 报告选项 -->
      <div class="form-group">
        <label class="checkbox-item">
          <input 
            type="checkbox" 
            v-model="includeDetails"
          />
          <span>Markdown 报告包含详细信息</span>
        </label>
      </div>
    </div>
    
    <div class="export-buttons">
      <button 
        class="export-btn markdown" 
        :disabled="!canExport"
        @click="exportMarkdown"
      >
        📄 导出 Markdown 报告
      </button>
      
      <button 
        class="export-btn json" 
        :disabled="!canExport"
        @click="exportJSON"
      >
        📋 导出 JSON 审计包
      </button>
    </div>
    
    <div v-if="isExporting" class="export-status">
      <span class="spinner"></span>
      <span class="status-text">正在导出...</span>
    </div>
    
    <div v-else-if="exportSuccess" class="export-status success">
      <span class="success-icon">✓</span>
      <span class="status-text">导出成功！</span>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import axios from 'axios'

export default {
  name: 'ExportPanel',
  props: {
    selectedEventIds: {
      type: Array,
      default: () => []
    },
    allEvents: {
      type: Array,
      default: () => []
    }
  },
  setup(props) {
    const exportScope = ref('all')
    const includeDetails = ref(true)
    const isExporting = ref(false)
    const exportSuccess = ref(false)

    // 计算属性：是否可以导出
    const canExport = computed(() => {
      if (exportScope.value === 'all') {
        return props.allEvents.length > 0
      }
      return props.selectedEventIds.length > 0
    })

    // 监听选中事件变化，自动切换到全部模式如果没有选中
    watch(() => props.selectedEventIds.length, (newLength) => {
      if (newLength === 0 && exportScope.value === 'selected') {
        exportScope.value = 'all'
      }
    })

    // 方法：处理范围变化
    const handleScopeChange = () => {
      // 重置状态
      exportSuccess.value = false
    }

    // 方法：导出 Markdown 报告
    const exportMarkdown = async () => {
      if (!canExport.value) return
      
      isExporting.value = true
      exportSuccess.value = false
      
      try {
        const params = new URLSearchParams()
        if (exportScope.value === 'selected' && props.selectedEventIds.length > 0) {
          params.append('eventIds', JSON.stringify(props.selectedEventIds))
        }
        params.append('includeDetails', includeDetails.value.toString())
        
        const response = await axios.get(`/api/export/markdown?${params.toString()}`, {
          responseType: 'blob'
        })
        
        // 创建下载链接
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `observation-review-${Date.now()}.md`)
        document.body.appendChild(link)
        link.click()
        link.parentNode.removeChild(link)
        window.URL.revokeObjectURL(url)
        
        exportSuccess.value = true
        setTimeout(() => {
          exportSuccess.value = false
        }, 3000)
      } catch (error) {
        console.error('导出 Markdown 失败:', error)
        alert('导出失败，请稍后重试')
      } finally {
        isExporting.value = false
      }
    }

    // 方法：导出 JSON 审计包
    const exportJSON = async () => {
      if (!canExport.value) return
      
      isExporting.value = true
      exportSuccess.value = false
      
      try {
        const params = new URLSearchParams()
        if (exportScope.value === 'selected' && props.selectedEventIds.length > 0) {
          params.append('eventIds', JSON.stringify(props.selectedEventIds))
        }
        
        const response = await axios.get(`/api/export/json?${params.toString()}`, {
          responseType: 'blob'
        })
        
        // 创建下载链接
        const url = window.URL.createObjectURL(new Blob([response.data]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `observation-audit-${Date.now()}.json`)
        document.body.appendChild(link)
        link.click()
        link.parentNode.removeChild(link)
        window.URL.revokeObjectURL(url)
        
        exportSuccess.value = true
        setTimeout(() => {
          exportSuccess.value = false
        }, 3000)
      } catch (error) {
        console.error('导出 JSON 失败:', error)
        alert('导出失败，请稍后重试')
      } finally {
        isExporting.value = false
      }
    }

    return {
      exportScope,
      includeDetails,
      isExporting,
      exportSuccess,
      canExport,
      handleScopeChange,
      exportMarkdown,
      exportJSON
    }
  }
}
</script>

<style scoped>
.export-panel {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.export-panel h3 {
  font-size: 1rem;
  color: #333;
  margin: 0 0 1rem 0;
}

.export-options {
  margin-bottom: 1rem;
}

.form-group {
  margin-bottom: 0.75rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 0.85rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.85rem;
  color: #374151;
  cursor: pointer;
}

.radio-item input[type="radio"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.radio-item input[type="radio"]:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.radio-item:has(input:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.85rem;
  color: #374151;
  cursor: pointer;
}

.checkbox-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.export-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.export-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.export-btn:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.export-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-btn.markdown {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
}

.export-btn.markdown:hover:not(:disabled) {
  background: linear-gradient(135deg, #059669, #047857);
}

.export-btn.json {
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  color: white;
}

.export-btn.json:hover:not(:disabled) {
  background: linear-gradient(135deg, #4f46e5, #4338ca);
}

.export-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.5rem;
  border-radius: 6px;
  font-size: 0.85rem;
}

.export-status.success {
  background: #d1fae5;
  color: #065f46;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-text {
  color: #6b7280;
}

.success-icon {
  font-size: 1rem;
  font-weight: bold;
}

.export-status.success .status-text {
  color: #065f46;
  font-weight: 500;
}
</style>
