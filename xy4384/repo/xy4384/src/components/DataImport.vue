<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  isDragging: boolean
}>()

const emit = defineEmits<{
  (e: 'file-drop', files: FileList): void
  (e: 'file-select', event: Event): void
  (e: 'drag-over', event: DragEvent): void
  (e: 'drag-leave'): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

function handleDrop(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer?.files) {
    emit('file-drop', event.dataTransfer.files)
  }
}

function handleDragOver(event: DragEvent) {
  emit('drag-over', event)
}

function handleDragLeave() {
  emit('drag-leave')
}

function handleClick() {
  fileInputRef.value?.click()
}

function handleFileChange(event: Event) {
  emit('file-select', event)
}
</script>

<template>
  <div
    class="file-drop-zone"
    :class="{ dragover: isDragging }"
    @drop="handleDrop"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @click="handleClick"
  >
    <input
      ref="fileInputRef"
      type="file"
      multiple
      accept=".csv,.json"
      style="display: none"
      @change="handleFileChange"
    />
    <p>点击或拖拽文件到此处</p>
    <p>支持 CSV 和 JSON 格式</p>
    <p style="font-size: 0.875rem; color: var(--text-secondary);">
      CSV 格式应包含 timestamp, fx/fy/fz/mx/my/mz (六分力) 或 timestamp, speed (风速)
    </p>
  </div>
  
  <div class="card" style="margin-top: 1.5rem;">
    <h3>CSV 数据格式示例</h3>
    <div class="grid grid-2" style="margin-top: 1rem;">
      <div>
        <h4>六分力数据格式</h4>
        <pre style="background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; font-size: 0.875rem;">
timestamp,fx,fy,fz,mx,my,mz
0,10.5,2.3,156.2,0.5,1.2,0.8
10,10.6,2.4,157.1,0.5,1.3,0.9
20,10.7,2.2,156.8,0.6,1.2,0.8
        </pre>
      </div>
      <div>
        <h4>风速数据格式</h4>
        <pre style="background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; font-size: 0.875rem;">
timestamp,speed,pressure,temperature
0,10.0,101325,25.0
10,15.0,101320,25.1
20,20.0,101315,25.2
        </pre>
      </div>
    </div>
    
    <div style="margin-top: 1rem;">
      <h4>JSON 格式示例</h4>
      <pre style="background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; font-size: 0.875rem;">
{
  "testNumber": "T-001",
  "testName": "翼型气动特性测试",
  "modelName": "NACA0012",
  "testDate": "2024-01-15",
  "referenceArea": 0.5,
  "airDensity": 1.225,
  "windSpeedProfile": [
    {"timestamp": 0, "speed": 10.0},
    {"timestamp": 10, "speed": 15.0}
  ],
  "forceData": [
    {"timestamp": 0, "fx": 10.5, "fy": 2.3, "fz": 156.2, "mx": 0.5, "my": 1.2, "mz": 0.8}
  ],
  "sensorCalibrations": [
    {
      "sensorId": "S001",
      "sensorName": "六分力天平",
      "calibrationDate": "2023-12-01",
      "expirationDate": "2024-06-01",
      "calibrationFactor": 1.002,
      "offset": 0.0,
      "calibratedBy": "张工",
      "certificateNumber": "CAL-2023-1234"
    }
  ]
}
      </pre>
    </div>
  </div>
</template>
