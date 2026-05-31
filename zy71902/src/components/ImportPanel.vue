<script setup lang="ts">
import { ref } from 'vue'
import Papa from 'papaparse'
import { useStore } from '../store'
import type { SourceType, RecordStatus } from '../types'

const store = useStore()
const isDragging = ref(false)
const sourceType = ref<SourceType>('section_leader_note')
const sourceName = ref('')
const operator = ref('当前用户')
const showManualForm = ref(false)

const manualForm = ref({
  studentName: '',
  instrument: '',
  part: '',
  songTitle: '',
  status: 'pending' as RecordStatus,
  pendingReason: ''
})

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (files?.length) {
    processFile(files[0])
  }
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files?.length) {
    processFile(target.files[0])
  }
}

function processFile(file: File) {
  if (!sourceName.value.trim()) {
    alert('请填写来源名称（如：声部长备注-王老师）')
    return
  }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const records = results.data.map((row: any) => ({
        studentName: row['学生姓名'] || row['studentName'] || row['姓名'] || '',
        instrument: row['乐器'] || row['instrument'] || '',
        part: row['声部'] || row['part'] || '',
        songTitle: row['曲目'] || row['songTitle'] || row['歌曲'] || '',
        measures: row['小节'] || row['measures'] || '',
        status: (row['状态'] || 'pending') as RecordStatus,
        source: sourceType.value,
        sourceName: sourceName.value,
        pendingReason: row['备注'] || row['reason'] || ''
      })).filter((r: any) => r.studentName && r.songTitle)

      const result = store.importRecords(records, operator.value, sourceName.value)
      
      alert(`导入完成！\n总计: ${result.total}\n新增: ${result.newRecords}\n重复: ${result.duplicates}\n错误: ${result.errors}`)
    }
  })
}

function handleManualAdd() {
  if (!manualForm.value.studentName || !manualForm.value.songTitle) {
    alert('请填写学生姓名和曲目')
    return
  }

  if (!sourceName.value.trim()) {
    alert('请填写来源名称')
    return
  }

  store.addRecord({
    ...manualForm.value,
    source: sourceType.value,
    sourceName: sourceName.value
  }, operator.value)

  manualForm.value = {
    studentName: '',
    instrument: '',
    part: '',
    songTitle: '',
    status: 'pending',
    pendingReason: ''
  }
  showManualForm.value = false
  alert('添加成功！')
}

const sourceTypeOptions = [
  { value: 'selection_list', label: '选曲表' },
  { value: 'section_leader_note', label: '声部长备注' },
  { value: 'accompaniment_teacher', label: '伴奏老师' },
  { value: 'manual', label: '手工录入' }
]
</script>

<template>
  <div class="card">
    <div class="card-title">📥 导入数据</div>
    
    <div class="input-group" style="margin-bottom: 16px;">
      <div class="filter-item">
        <label>来源类型:</label>
        <select v-model="sourceType">
          <option v-for="opt in sourceTypeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <div class="filter-item">
        <label>来源名称:</label>
        <input 
          type="text" 
          v-model="sourceName" 
          placeholder="如：声部长备注-王老师"
          style="width: 200px;"
        />
      </div>
    </div>

    <div 
      class="upload-zone"
      :class="{ dragover: isDragging }"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @click="($refs.fileInput as HTMLInputElement).click()"
    >
      <input 
        ref="fileInput" 
        type="file" 
        accept=".csv,.txt" 
        style="display: none;"
        @change="handleFileSelect"
      />
      <div class="upload-zone-icon">📁</div>
      <div class="upload-zone-text">点击或拖拽 CSV 文件到此处</div>
      <div class="upload-zone-hint">支持格式: CSV（包含学生姓名、乐器、声部、曲目等列）</div>
    </div>

    <div style="margin-top: 16px;">
      <button class="btn btn-secondary btn-sm" @click="showManualForm = !showManualForm">
        ✏️ {{ showManualForm ? '取消手工录入' : '手工添加记录' }}
      </button>
    </div>

    <div v-if="showManualForm" style="margin-top: 16px; padding: 16px; background: #f8f9fa; border-radius: 8px;">
      <div class="input-group" style="margin-bottom: 12px;">
        <input type="text" v-model="manualForm.studentName" placeholder="学生姓名 *" />
        <input type="text" v-model="manualForm.instrument" placeholder="乐器" />
        <input type="text" v-model="manualForm.part" placeholder="声部" />
      </div>
      <div class="input-group" style="margin-bottom: 12px;">
        <input type="text" v-model="manualForm.songTitle" placeholder="曲目 *" />
        <select v-model="manualForm.status">
          <option value="pending">待处理</option>
          <option value="confirmed">已确认</option>
        </select>
      </div>
      <div class="input-group" style="margin-bottom: 12px;">
        <textarea 
          v-model="manualForm.pendingReason" 
          placeholder="待处理原因（可选）"
          style="width: 100%;"
        ></textarea>
      </div>
      <button class="btn btn-primary btn-sm" @click="handleManualAdd">添加</button>
    </div>
  </div>
</template>
