<template>
  <div class="container mt-4">
    <div class="grid grid-cols-3 mb-4">
      <div class="card" :class="{ 'alert-info': dataStatus.tide.loaded }">
        <div class="flex items-center justify-between mb-2">
          <h3 class="card-title mb-0">潮位/流速数据</h3>
          <span class="badge" :class="dataStatus.tide.loaded ? 'badge-success' : 'badge-warning'">
            {{ dataStatus.tide.loaded ? `已导入 ${dataStatus.tide.count} 条` : '未导入' }}
          </span>
        </div>
        <p class="text-sm text-muted mb-3">导入未来两天的潮位和流速CSV文件</p>
        
        <div 
          class="upload-area"
          :class="{ dragover: tideDragover }"
          @dragenter.prevent="tideDragover = true"
          @dragleave.prevent="tideDragover = false"
          @dragover.prevent
          @drop.prevent="handleTideDrop"
          @click="triggerTideUpload"
        >
          <input 
            type="file" 
            ref="tideFileInput"
            accept=".csv"
            @change="handleTideFile"
            style="display: none"
          />
          <p>📤 点击或拖拽上传CSV文件</p>
          <p class="text-xs text-muted mt-2">支持格式: .csv</p>
        </div>

        <template v-if="tideUploading">
          <div class="mt-3">
            <div class="progress-bar">
              <div class="progress-bar-fill" style="width: 50%;"></div>
            </div>
            <p class="text-sm text-muted mt-2">正在上传并解析...</p>
          </div>
        </template>
      </div>

      <div class="card" :class="{ 'alert-info': dataStatus.berth.loaded }">
        <div class="flex items-center justify-between mb-2">
          <h3 class="card-title mb-0">泊位占用表</h3>
          <span class="badge" :class="dataStatus.berth.loaded ? 'badge-success' : 'badge-warning'">
            {{ dataStatus.berth.loaded ? `已导入 ${dataStatus.berth.count} 个` : '未导入' }}
          </span>
        </div>
        <p class="text-sm text-muted mb-3">导入泊位配置和占用表JSON</p>
        
        <div class="form-group">
          <label class="form-label">粘贴JSON数据</label>
          <textarea 
            v-model="berthJsonText"
            class="form-input form-textarea"
            placeholder='{
  "config": {
    "workStartHour": 8,
    "workEndHour": 18,
    "underKeelClearance": 0.5,
    "maxCurrentSpeed": 2.0
  },
  "berths": [
    { "id": "b1", "name": "1号泊位", "maxDraft": 5.0, "maxLength": 100 }
  ]
}'
            rows="8"
          ></textarea>
        </div>
        
        <button 
          class="btn btn-primary w-full"
          :disabled="!berthJsonText.trim() || berthUploading"
          @click="uploadBerthData"
        >
          {{ berthUploading ? '导入中...' : '导入泊位数据' }}
        </button>
      </div>

      <div class="card" :class="{ 'alert-info': dataStatus.barge.loaded }">
        <div class="flex items-center justify-between mb-2">
          <h3 class="card-title mb-0">驳船吃水数据</h3>
          <span class="badge" :class="dataStatus.barge.loaded ? 'badge-success' : 'badge-warning'">
            {{ dataStatus.barge.loaded ? `已导入 ${dataStatus.barge.count} 艘` : '未导入' }}
          </span>
        </div>
        <p class="text-sm text-muted mb-3">导入驳船吃水和作业需求JSON</p>
        
        <div class="form-group">
          <label class="form-label">粘贴JSON数据</label>
          <textarea 
            v-model="bargeJsonText"
            class="form-input form-textarea"
            placeholder='{
  "barges": [
    {
      "id": "ship1",
      "name": "东方号",
      "draft": 3.5,
      "length": 80,
      "cargoType": "煤炭",
      "loadingTime": 180
    }
  ]
}'
            rows="8"
          ></textarea>
        </div>
        
        <button 
          class="btn btn-primary w-full"
          :disabled="!bargeJsonText.trim() || bargeUploading"
          @click="uploadBargeData"
        >
          {{ bargeUploading ? '导入中...' : '导入驳船数据' }}
        </button>
      </div>
    </div>

    <div v-if="message" class="alert" :class="messageType">
      {{ message }}
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">数据导入状态</h3>
      </div>
      
      <div class="grid grid-cols-3">
        <div class="flex items-center gap-2">
          <span class="status-dot" :class="dataStatus.tide.loaded ? 'success' : 'error'"></span>
          <span>潮位/流速数据: {{ dataStatus.tide.loaded ? '已就绪' : '未导入' }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="status-dot" :class="dataStatus.berth.loaded ? 'success' : 'error'"></span>
          <span>泊位数据: {{ dataStatus.berth.loaded ? '已就绪' : '未导入' }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="status-dot" :class="dataStatus.barge.loaded ? 'success' : 'error'"></span>
          <span>驳船数据: {{ dataStatus.barge.loaded ? '已就绪' : '未导入' }}</span>
        </div>
      </div>

      <div class="mt-4 flex justify-end gap-3">
        <button 
          class="btn btn-secondary"
          @click="loadDataStatus"
        >
          刷新状态
        </button>
        <router-link 
          v-if="canCalculate"
          to="/scheduling"
          class="btn btn-primary"
        >
          前往排程计算 →
        </router-link>
        <button 
          v-else
          class="btn btn-primary"
          disabled
        >
          请先导入所有数据
        </button>
      </div>
    </div>

    <div class="card mt-4">
      <div class="card-header">
        <h3 class="card-title">📋 数据格式示例</h3>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div>
          <h4 class="font-semibold mb-2">潮位/流速CSV格式:</h4>
          <pre class="text-sm text-muted" style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto;">
时间,潮位(m),流速(节)
2024-05-04 00:00,2.5,0.8
2024-05-04 01:00,2.8,1.0
2024-05-04 02:00,3.0,1.2
...
          </pre>
        </div>
        
        <div>
          <h4 class="font-semibold mb-2">泊位JSON格式:</h4>
          <pre class="text-sm text-muted" style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto;">
{
  "config": {
    "workStartHour": 8,
    "workEndHour": 18,
    "underKeelClearance": 0.5,
    "maxCurrentSpeed": 2.0
  },
  "berths": [
    {"id":"b1","name":"1号泊位","maxDraft":5.0},
    {"id":"b2","name":"2号泊位","maxDraft":4.0}
  ]
}
          </pre>
        </div>
      </div>
      
      <div class="mt-4">
        <h4 class="font-semibold mb-2">驳船JSON格式:</h4>
        <pre class="text-sm text-muted" style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto;">
{
  "barges": [
    {
      "id": "ship1",
      "name": "东方号",
      "draft": 3.5,
      "length": 80,
      "cargoType": "煤炭",
      "loadingTime": 180
    },
    {
      "id": "ship2",
      "name": "远航号",
      "draft": 4.2,
      "length": 95,
      "cargoType": "粮食",
      "loadingTime": 240
    }
  ]
}
        </pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useScheduleStore } from '@/stores/scheduleStore'
import { storeToRefs } from 'pinia'

const store = useScheduleStore()
const { dataStatus, canCalculate } = storeToRefs(store)

const tideDragover = ref(false)
const tideUploading = ref(false)
const berthUploading = ref(false)
const bargeUploading = ref(false)

const berthJsonText = ref('')
const bargeJsonText = ref('')

const message = ref('')
const messageType = ref('')

const tideFileInput = ref(null)

onMounted(() => {
  store.loadDataStatus()
})

function triggerTideUpload() {
  tideFileInput.value?.click()
}

async function handleTideFile(event) {
  const file = event.target.files?.[0]
  if (file) {
    await uploadTideFile(file)
  }
}

async function handleTideDrop(event) {
  tideDragover.value = false
  const file = event.dataTransfer.files?.[0]
  if (file && file.name.endsWith('.csv')) {
    await uploadTideFile(file)
  } else {
    showMessage('请上传CSV文件', 'alert-error')
  }
}

async function uploadTideFile(file) {
  tideUploading.value = true
  try {
    const result = await store.uploadTideFile(file)
    if (result.success) {
      showMessage(result.message, 'alert-success')
    } else {
      showMessage(result.error || '上传失败', 'alert-error')
    }
  } catch (error) {
    showMessage('上传失败: ' + error.message, 'alert-error')
  } finally {
    tideUploading.value = false
  }
}

async function uploadBerthData() {
  if (!berthJsonText.value.trim()) return
  
  berthUploading.value = true
  try {
    const data = JSON.parse(berthJsonText.value)
    const result = await store.uploadBerthData(data)
    if (result.success) {
      showMessage(result.message, 'alert-success')
      berthJsonText.value = ''
    } else {
      showMessage(result.error || '导入失败', 'alert-error')
    }
  } catch (error) {
    showMessage('JSON格式错误: ' + error.message, 'alert-error')
  } finally {
    berthUploading.value = false
  }
}

async function uploadBargeData() {
  if (!bargeJsonText.value.trim()) return
  
  bargeUploading.value = true
  try {
    const data = JSON.parse(bargeJsonText.value)
    const result = await store.uploadBargeData(data)
    if (result.success) {
      showMessage(result.message, 'alert-success')
      bargeJsonText.value = ''
    } else {
      showMessage(result.error || '导入失败', 'alert-error')
    }
  } catch (error) {
    showMessage('JSON格式错误: ' + error.message, 'alert-error')
  } finally {
    bargeUploading.value = false
  }
}

function showMessage(msg, type) {
  message.value = msg
  messageType.value = type
  setTimeout(() => {
    message.value = ''
  }, 5000)
}
</script>
