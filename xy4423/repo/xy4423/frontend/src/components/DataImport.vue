<template>
  <div class="data-import">
    <h3>📁 数据导入</h3>
    <p class="import-hint">
      支持导入 CSV 和 JSON 格式的观测数据文件。<br>
      包括：相机触发日志、目视记录表、天气云量数据、设备电池记录。
    </p>
    
    <!-- 拖放区域 -->
    <div 
      class="drop-zone" 
      :class="{ 'drag-over': isDragOver }"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
      @dragover="handleDragOver"
      @drop="handleDrop"
      @click="triggerFileInput"
    >
      <div class="drop-content">
        <span class="drop-icon">📤</span>
        <p class="drop-text">
          {{ isDragOver ? '释放文件以开始导入' : '点击或拖放文件到此处' }}
        </p>
        <p class="drop-hint">支持 .csv 和 .json 文件</p>
      </div>
    </div>
    
    <!-- 隐藏的文件输入 -->
    <input 
      ref="fileInput"
      type="file" 
      multiple 
      accept=".csv,.json"
      @change="handleFileSelect"
      style="display: none;"
    />
    
    <!-- 选中的文件列表 -->
    <div v-if="selectedFiles.length > 0" class="selected-files">
      <h4>已选择的文件 ({{ selectedFiles.length }})</h4>
      <ul class="file-list">
        <li v-for="(file, index) in selectedFiles" :key="index" class="file-item">
          <span class="file-name">{{ file.name }}</span>
          <span class="file-size">{{ formatFileSize(file.size) }}</span>
          <button class="remove-btn" @click="removeFile(index)">✕</button>
        </li>
      </ul>
    </div>
    
    <!-- 导入按钮 -->
    <div class="import-actions">
      <button 
        class="import-btn" 
        :disabled="selectedFiles.length === 0 || isImporting"
        @click="startImport"
      >
        {{ isImporting ? '⏳ 导入中...' : '🚀 开始导入' }}
      </button>
      <button 
        v-if="selectedFiles.length > 0"
        class="clear-btn" 
        @click="clearFiles"
      >
        清空
      </button>
    </div>
    
    <!-- 导入进度 -->
    <div v-if="importProgress > 0" class="progress-container">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: importProgress + '%' }"></div>
      </div>
      <p class="progress-text">{{ importProgress }}%</p>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import axios from 'axios'

export default {
  name: 'DataImport',
  emits: ['import-success', 'import-error'],
  setup(props, { emit }) {
    const isDragOver = ref(false)
    const selectedFiles = ref([])
    const isImporting = ref(false)
    const importProgress = ref(0)
    const fileInput = ref(null)

    // 格式化文件大小
    const formatFileSize = (bytes) => {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    // 触发文件选择对话框
    const triggerFileInput = () => {
      if (fileInput.value) {
        fileInput.value.click()
      }
    }

    // 处理文件选择
    const handleFileSelect = (event) => {
      const files = Array.from(event.target.files)
      addFiles(files)
      // 重置 input，允许重复选择同一文件
      event.target.value = ''
    }

    // 添加文件到选中列表
    const addFiles = (files) => {
      for (const file of files) {
        // 检查文件类型
        if (file.name.endsWith('.csv') || file.name.endsWith('.json')) {
          // 检查是否已添加
          const exists = selectedFiles.value.some(f => 
            f.name === file.name && f.size === file.size
          )
          if (!exists) {
            selectedFiles.value.push(file)
          }
        }
      }
    }

    // 移除文件
    const removeFile = (index) => {
      selectedFiles.value.splice(index, 1)
    }

    // 清空所有文件
    const clearFiles = () => {
      selectedFiles.value = []
    }

    // 拖放事件处理
    const handleDragEnter = (e) => {
      e.preventDefault()
      e.stopPropagation()
      isDragOver.value = true
    }

    const handleDragLeave = (e) => {
      e.preventDefault()
      e.stopPropagation()
      isDragOver.value = false
    }

    const handleDragOver = (e) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const handleDrop = (e) => {
      e.preventDefault()
      e.stopPropagation()
      isDragOver.value = false

      const files = Array.from(e.dataTransfer.files)
      addFiles(files)
    }

    // 开始导入
    const startImport = async () => {
      if (selectedFiles.value.length === 0) return

      isImporting.value = true
      importProgress.value = 0

      try {
        const formData = new FormData()
        for (const file of selectedFiles.value) {
          formData.append('files', file)
        }

        importProgress.value = 30

        const response = await axios.post('/api/import', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            )
            importProgress.value = 30 + Math.floor(percentCompleted * 0.4)
          }
        })

        importProgress.value = 100

        if (response.data.success) {
          emit('import-success', response.data.data)
          // 清空选中的文件
          selectedFiles.value = []
        } else {
          throw new Error(response.data.message || '导入失败')
        }
      } catch (error) {
        console.error('导入失败:', error)
        emit('import-error', error)
      } finally {
        isImporting.value = false
        setTimeout(() => {
          importProgress.value = 0
        }, 1000)
      }
    }

    return {
      isDragOver,
      selectedFiles,
      isImporting,
      importProgress,
      fileInput,
      formatFileSize,
      triggerFileInput,
      handleFileSelect,
      removeFile,
      clearFiles,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      startImport
    }
  }
}
</script>

<style scoped>
.data-import {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.data-import h3 {
  margin-bottom: 0.75rem;
  font-size: 1rem;
  color: #333;
}

.import-hint {
  font-size: 0.8rem;
  color: #666;
  line-height: 1.5;
  margin-bottom: 1rem;
}

.drop-zone {
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  padding: 2rem 1rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #fafafa;
}

.drop-zone:hover {
  border-color: #3b82f6;
  background: #eff6ff;
}

.drop-zone.drag-over {
  border-color: #3b82f6;
  background: #dbeafe;
}

.drop-content {
  pointer-events: none;
}

.drop-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 0.75rem;
}

.drop-text {
  font-size: 0.95rem;
  color: #374151;
  margin-bottom: 0.25rem;
}

.drop-hint {
  font-size: 0.75rem;
  color: #9ca3af;
}

.selected-files {
  margin-top: 1rem;
}

.selected-files h4 {
  font-size: 0.85rem;
  color: #374151;
  margin-bottom: 0.5rem;
}

.file-list {
  list-style: none;
  max-height: 120px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 6px;
  margin-bottom: 0.25rem;
  font-size: 0.8rem;
}

.file-name {
  flex: 1;
  color: #374151;
  word-break: break-all;
  margin-right: 0.5rem;
}

.file-size {
  color: #9ca3af;
  margin-right: 0.5rem;
  flex-shrink: 0;
}

.remove-btn {
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 1rem;
  padding: 0 0.25rem;
  flex-shrink: 0;
}

.remove-btn:hover {
  color: #dc2626;
}

.import-actions {
  margin-top: 1rem;
  display: flex;
  gap: 0.75rem;
}

.import-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.import-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  transform: translateY(-1px);
}

.import-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.clear-btn {
  padding: 0.75rem 1rem;
  background: #f3f4f6;
  color: #4b5563;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.clear-btn:hover {
  background: #e5e7eb;
}

.progress-container {
  margin-top: 1rem;
}

.progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #10b981);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
}
</style>
