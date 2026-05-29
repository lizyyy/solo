<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Upload,
  FileText,
  Settings,
  Play,
  CheckCircle,
  AlertCircle,
  X,
  Key,
  ArrowRight,
  Hash
} from 'lucide-vue-next'
import { useImportStore } from '../stores/importStore'
import { autoMapFields, formatFileSize, formatDate } from '../utils'
import type { FieldMapping } from '../types'

const store = useImportStore()

const isDragging = ref(false)
const uploadError = ref('')
const isRunning = ref(false)
const activeTab = ref<'upload' | 'mapping' | 'preview'>('upload')

const fileInput = ref<HTMLInputElement | null>(null)
const fieldMappings = ref<FieldMapping[]>([])
const primaryKeyField = ref('')

const targetFields = ['id', 'name', 'email', 'department', 'status', 'amount', 'date']

const uploadFile = async (file: File) => {
  uploadError.value = ''
  try {
    const csvFile = await store.uploadCsvFile(file)
    fieldMappings.value = autoMapFields(csvFile.headers, targetFields)
    const pkMapping = fieldMappings.value.find(f => f.isPrimaryKey)
    primaryKeyField.value = pkMapping?.sourceField || ''
    activeTab.value = 'mapping'
  } catch (error: any) {
    uploadError.value = error.message
  }
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = true
}

const handleDragLeave = () => {
  isDragging.value = false
}

const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
  
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    const file = files[0]
    if (file.name.endsWith('.csv')) {
      uploadFile(file)
    } else {
      uploadError.value = '请上传CSV格式文件'
    }
  }
}

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0) {
    uploadFile(files[0])
  }
}

const togglePrimaryKey = (fieldName: string) => {
  fieldMappings.value.forEach(f => f.isPrimaryKey = f.sourceField === fieldName)
  primaryKeyField.value = fieldName
}

const updateMapping = (index: number, targetField: string) => {
  fieldMappings.value[index].targetField = targetField
}

const runPreview = async () => {
  if (!store.currentFileId || !primaryKeyField.value) return
  
  isRunning.value = true
  try {
    const session = store.createImportSession(
      store.currentFileId,
      fieldMappings.value,
      primaryKeyField.value
    )
    await store.runImportPreview(session.sessionId)
    activeTab.value = 'preview'
  } finally {
    isRunning.value = false
  }
}

const sampleRecords = computed(() => {
  return store.currentFile?.records.slice(0, 5) || []
})

const canStartPreview = computed(() => {
  return store.currentFile && primaryKeyField.value && fieldMappings.value.length > 0
})
</script>

<template>
  <div class="space-y-6 animate-fade-in">
    <div class="flex items-center gap-4 mb-6">
      <div
        v-for="(tab, index) in ['upload', 'mapping', 'preview']"
        :key="tab"
        :class="[
          'flex items-center gap-2 px-4 py-2 rounded-lg transition-all',
          activeTab === tab ? 'bg-primary-100 text-primary-700 font-medium' : 'text-slate-500'
        ]"
      >
        <div
          :class="[
            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
            activeTab === tab ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-600'
          ]"
        >
          {{ index + 1 }}
        </div>
        <span>{{ tab === 'upload' ? '上传文件' : tab === 'mapping' ? '字段映射' : '预演结果' }}</span>
        <ArrowRight v-if="index < 2" class="w-4 h-4 ml-2 text-slate-300" />
      </div>
    </div>
    
    <div v-show="activeTab === 'upload'" class="card">
      <div class="card-header">
        <h3 class="font-semibold text-slate-900 flex items-center gap-2">
          <Upload class="w-5 h-5 text-primary-600" />
          上传CSV文件
        </h3>
      </div>
      <div class="card-body">
        <div
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
          @click="fileInput?.click()"
          :class="[
            'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all',
            isDragging ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-primary-400'
          ]"
        >
          <input
            ref="fileInput"
            type="file"
            accept=".csv"
            class="hidden"
            @change="handleFileSelect"
          />
          <div class="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText class="w-8 h-8 text-primary-600" />
          </div>
          <h4 class="text-lg font-semibold text-slate-900 mb-2">
            拖拽CSV文件到此处，或点击选择文件
          </h4>
          <p class="text-slate-500 mb-4">
            支持UTF-8编码的CSV文件，最大100MB
          </p>
          <button class="btn-primary">
            <Upload class="w-4 h-4 mr-2" />
            选择文件
          </button>
        </div>
        
        <div v-if="uploadError" class="mt-4 p-4 bg-danger-50 border border-danger-200 rounded-lg flex items-start gap-3">
          <AlertCircle class="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
          <div>
            <p class="font-medium text-danger-800">上传失败</p>
            <p class="text-sm text-danger-600">{{ uploadError }}</p>
          </div>
        </div>
        
        <div v-if="store.currentFile" class="mt-6 p-4 bg-success-50 border border-success-200 rounded-lg">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-success-100 rounded-lg flex items-center justify-center">
                <CheckCircle class="w-5 h-5 text-success-600" />
              </div>
              <div>
                <h4 class="font-medium text-slate-900">{{ store.currentFile.fileName }}</h4>
                <p class="text-sm text-slate-500">
                  {{ store.currentFile.totalRows }} 行数据 · {{ store.currentFile.versionNo }} · {{ formatDate(store.currentFile.uploadedAt) }}
                </p>
              </div>
            </div>
            <button
              @click="activeTab = 'mapping'"
              class="btn-primary"
            >
              继续配置
              <ArrowRight class="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <div v-show="activeTab === 'mapping'" class="space-y-6">
      <div class="card">
        <div class="card-header flex items-center justify-between">
          <h3 class="font-semibold text-slate-900 flex items-center gap-2">
            <Settings class="w-5 h-5 text-primary-600" />
            字段映射配置
          </h3>
          <span class="text-sm text-slate-500">
            共 {{ fieldMappings.length }} 个字段
          </span>
        </div>
        <div class="card-body">
          <div class="mb-4 p-3 bg-primary-50 border border-primary-200 rounded-lg flex items-center gap-2">
            <Key class="w-4 h-4 text-primary-600" />
            <span class="text-sm text-primary-700">
              请选择一个字段作为主键，用于检测重复数据
            </span>
          </div>
          
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th class="w-20">主键</th>
                  <th>源字段 (CSV)</th>
                  <th>目标字段 (系统)</th>
                  <th class="w-32">数据类型</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(mapping, index) in fieldMappings" :key="mapping.sourceField">
                  <td>
                    <button
                      @click="togglePrimaryKey(mapping.sourceField)"
                      :class="[
                        'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                        mapping.isPrimaryKey
                          ? 'bg-primary-100 text-primary-600'
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      ]"
                    >
                      <Hash class="w-4 h-4" />
                    </button>
                  </td>
                  <td>
                    <code class="px-2 py-1 bg-slate-100 rounded text-sm font-mono">
                      {{ mapping.sourceField }}
                    </code>
                  </td>
                  <td>
                    <select
                      :value="mapping.targetField"
                      @change="updateMapping(index, ($event.target as HTMLSelectElement).value)"
                      class="input max-w-xs"
                    >
                      <option v-for="field in targetFields" :key="field" :value="field">
                        {{ field }}
                      </option>
                    </select>
                  </td>
                  <td>
                    <select
                      :value="mapping.dataType"
                      @change="mapping.dataType = ($event.target as HTMLSelectElement).value as any"
                      class="input"
                    >
                      <option value="string">字符串</option>
                      <option value="number">数字</option>
                      <option value="date">日期</option>
                      <option value="boolean">布尔</option>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <div class="flex justify-end gap-3">
        <button @click="activeTab = 'upload'" class="btn-secondary">
          返回上传
        </button>
        <button
          @click="runPreview"
          :disabled="!canStartPreview || isRunning"
          class="btn-primary"
        >
          <Play v-if="!isRunning" class="w-4 h-4 mr-2" />
          <span v-if="isRunning" class="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
          {{ isRunning ? '执行中...' : '开始预演导入' }}
        </button>
      </div>
    </div>
    
    <div v-show="activeTab === 'preview'" class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="card">
          <div class="card-body text-center">
            <div class="text-3xl font-bold text-slate-900">{{ store.currentSession?.successCount || 0 }}</div>
            <div class="text-sm text-slate-500 mt-1">预演成功</div>
          </div>
        </div>
        <div class="card">
          <div class="card-body text-center">
            <div class="text-3xl font-bold text-danger-600">{{ store.currentSession?.conflictCount || 0 }}</div>
            <div class="text-sm text-slate-500 mt-1">发现冲突</div>
          </div>
        </div>
        <div class="card">
          <div class="card-body text-center">
            <div class="text-3xl font-bold text-primary-600">{{ store.successRate }}%</div>
            <div class="text-sm text-slate-500 mt-1">成功率</div>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <h3 class="font-semibold text-slate-900">数据预览</h3>
        </div>
        <div class="card-body">
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th class="w-20">行号</th>
                  <th v-for="header in store.currentFile?.headers" :key="header">
                    {{ header }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="record in sampleRecords" :key="record.recordId">
                  <td class="font-mono text-slate-500">{{ record.originalLineNo }}</td>
                  <td v-for="header in store.currentFile?.headers" :key="header">
                    {{ record.rawData[header] }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <div class="flex justify-end gap-3">
        <button @click="activeTab = 'mapping'" class="btn-secondary">
          重新配置
        </button>
        <button
          @click="store.createRollbackPoint(store.currentSessionId!, '预演完成创建回滚点')"
          class="btn-success"
        >
          创建回滚点
        </button>
      </div>
    </div>
  </div>
</template>
