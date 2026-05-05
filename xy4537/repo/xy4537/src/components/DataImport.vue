<template>
  <div class="space-y-6">
    <div class="bg-white rounded-xl shadow-sm border p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">数据导入</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div
            @dragenter.prevent
            @dragover.prevent
            @dragleave="handleDragLeave"
            @drop="handleDrop"
            @click="triggerFileInput"
            :class="[
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            ]"
          >
            <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <div class="mt-4">
              <p class="text-sm font-medium text-gray-900">
                拖拽文件到这里，或点击选择文件
              </p>
              <p class="mt-1 text-xs text-gray-500">
                支持 CSV 和 JSON 格式
              </p>
            </div>
          </div>
          <input
            ref="fileInput"
            type="file"
            multiple
            accept=".csv,.json"
            class="hidden"
            @change="handleFileSelect"
          />
        </div>

        <div class="space-y-4">
          <div class="bg-blue-50 rounded-lg p-4">
            <h3 class="text-sm font-medium text-blue-900 mb-2">示例数据</h3>
            <p class="text-sm text-blue-700 mb-3">
              点击下方按钮加载示例数据，体验完整功能
            </p>
            <button
              @click="$emit('loadSample')"
              class="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              加载示例数据
            </button>
          </div>

          <div class="bg-gray-50 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-900 mb-2">支持的数据类型</h3>
            <ul class="space-y-2 text-sm text-gray-600">
              <li class="flex items-center">
                <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                <span>运动员信息 (athletes.json)</span>
              </li>
              <li class="flex items-center">
                <span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                <span>裁判分数 (judge_scores.csv)</span>
              </li>
              <li class="flex items-center">
                <span class="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                <span>难度申报 (difficulty_declaration.json)</span>
              </li>
              <li class="flex items-center">
                <span class="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                <span>视频时间码 (video_timecodes.json)</span>
              </li>
              <li class="flex items-center">
                <span class="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                <span>申诉记录 (appeals.json)</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedFiles.length > 0" class="bg-white rounded-xl shadow-sm border p-6">
      <h3 class="text-sm font-medium text-gray-900 mb-4">已选择的文件</h3>
      <div class="space-y-3">
        <div
          v-for="(file, index) in selectedFiles"
          :key="index"
          class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
        >
          <div class="flex items-center">
            <div :class="[
              'w-8 h-8 rounded-lg flex items-center justify-center mr-3',
              getFileColor(file.detectedType)
            ]">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-900">{{ file.name }}</p>
              <p class="text-xs text-gray-500">
                {{ formatFileSize(file.size) }} · 
                {{ getFileTypeName(file.detectedType) }}
              </p>
            </div>
          </div>
          <button
            @click="removeFile(index)"
            class="text-gray-400 hover:text-red-500 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      <div class="mt-4 flex justify-end">
        <button
          @click="processFiles"
          :disabled="!hasRequiredFiles"
          :class="[
            'px-6 py-2 text-sm font-medium rounded-lg transition-colors',
            hasRequiredFiles
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          ]"
        >
          处理数据
        </button>
      </div>
      
      <div v-if="!hasRequiredFiles && selectedFiles.length > 0" class="mt-3 text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
        ⚠️ 至少需要加载 <strong>运动员信息</strong> 和 <strong>裁判分数</strong> 才能进行分析
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const emit = defineEmits(['dataLoaded', 'loadSample'])

const fileInput = ref(null)
const isDragOver = ref(false)
const selectedFiles = ref([])

const hasRequiredFiles = computed(() => {
  const types = selectedFiles.value.map(f => f.detectedType)
  return types.includes('athletes') && types.includes('judgeScores')
})

function triggerFileInput() {
  fileInput.value?.click()
}

function handleDragOver(e) {
  e.preventDefault()
  isDragOver.value = true
}

function handleDragLeave() {
  isDragOver.value = false
}

function handleDrop(e) {
  e.preventDefault()
  isDragOver.value = false
  
  const files = Array.from(e.dataTransfer.files)
  addFiles(files)
}

function handleFileSelect(e) {
  const files = Array.from(e.target.files)
  addFiles(files)
}

function addFiles(files) {
  for (const file of files) {
    const ext = file.name.split('.').pop().toLowerCase()
    if (ext === 'csv' || ext === 'json') {
      const detectedType = detectFileType(file.name)
      selectedFiles.value.push({
        name: file.name,
        size: file.size,
        type: ext,
        detectedType,
        file
      })
    }
  }
}

function removeFile(index) {
  selectedFiles.value.splice(index, 1)
}

function detectFileType(filename) {
  const lowerName = filename.toLowerCase()
  
  if (lowerName.includes('athlete') || lowerName.includes('运动员')) return 'athletes'
  if (lowerName.includes('score') || lowerName.includes('裁判') || lowerName.includes('分数')) return 'judgeScores'
  if (lowerName.includes('difficult') || lowerName.includes('难度')) return 'difficultyDeclarations'
  if (lowerName.includes('video') || lowerName.includes('time') || lowerName.includes('视频') || lowerName.includes('时间码')) return 'videoTimecodes'
  if (lowerName.includes('appeal') || lowerName.includes('申诉')) return 'appeals'
  
  return null
}

function getFileColor(type) {
  const colors = {
    athletes: 'bg-green-500',
    judgeScores: 'bg-blue-500',
    difficultyDeclarations: 'bg-yellow-500',
    videoTimecodes: 'bg-purple-500',
    appeals: 'bg-red-500'
  }
  return colors[type] || 'bg-gray-500'
}

function getFileTypeName(type) {
  const names = {
    athletes: '运动员信息',
    judgeScores: '裁判分数',
    difficultyDeclarations: '难度申报',
    videoTimecodes: '视频时间码',
    appeals: '申诉记录'
  }
  return names[type] || '未知类型'
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

async function processFiles() {
  const rawData = {
    athletes: null,
    judgeScores: null,
    difficultyDeclarations: null,
    videoTimecodes: null,
    appeals: null
  }

  for (const fileEntry of selectedFiles.value) {
    try {
      const data = await parseFile(fileEntry.file)
      if (fileEntry.detectedType && rawData[fileEntry.detectedType] === null) {
        rawData[fileEntry.detectedType] = data
      }
    } catch (error) {
      console.error(`解析文件 ${fileEntry.name} 失败:`, error)
    }
  }

  emit('dataLoaded', rawData)
}

async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  
  if (ext === 'csv') {
    return parseCSV(file)
  } else if (ext === 'json') {
    return parseJSON(file)
  }
}

function parseCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      const lines = text.split('\n')
      if (lines.length < 2) {
        resolve([])
        return
      }
      
      const headers = lines[0].split(',').map(h => h.trim())
      const result = []
      
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue
        
        const values = lines[i].split(',')
        const row = {}
        
        headers.forEach((header, idx) => {
          let value = values[idx]?.trim() || ''
          
          if (!isNaN(value) && value !== '') {
            value = parseFloat(value)
          }
          
          row[header] = value
        })
        
        result.push(row)
      }
      
      resolve(result)
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}

function parseJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        resolve(data)
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}
</script>
