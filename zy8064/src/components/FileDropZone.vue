<template>
  <div
    class="drop-zone"
    :class="{ 'drag-over': isDragOver, 'has-file': hasFile }"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
    @click="openFilePicker"
  >
    <input
      ref="fileInput"
      type="file"
      accept=".epub"
      @change="onFileSelect"
      style="display: none"
    />

    <div v-if="!hasFile" class="drop-content">
      <div class="drop-icon">📁</div>
      <div class="drop-text">
        拖放 EPUB 文件到此处
      </div>
      <div class="drop-subtext">或点击选择文件</div>
    </div>

    <div v-else class="file-info">
      <div class="file-icon">📖</div>
      <div class="file-name">{{ fileName }}</div>
      <div class="file-hint">点击更换文件</div>
    </div>

    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
      <div class="loading-text">正在解析...</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  loading: Boolean,
  hasFile: Boolean,
  fileName: String
})

const emit = defineEmits(['file-selected'])

const fileInput = ref(null)
const isDragOver = ref(false)

function onDragOver(e) {
  isDragOver.value = true
}

function onDragLeave(e) {
  isDragOver.value = false
}

function onDrop(e) {
  isDragOver.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    const file = files[0]
    if (file.name.endsWith('.epub')) {
      emit('file-selected', file)
    }
  }
}

function openFilePicker() {
  fileInput.value?.click()
}

function onFileSelect(e) {
  const files = e.target.files
  if (files && files.length > 0) {
    emit('file-selected', files[0])
  }
}
</script>

<style scoped>
.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: #fafafa;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.drop-zone:hover {
  border-color: #4a90d9;
  background: #f0f7ff;
}

.drop-zone.drag-over {
  border-color: #4a90d9;
  background: #e3f0ff;
  transform: scale(1.01);
}

.drop-zone.has-file {
  border-style: solid;
  border-color: #4CAF50;
  background: #f1f8f1;
}

.drop-content {
  pointer-events: none;
}

.drop-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.drop-text {
  font-size: 18px;
  color: #333;
  font-weight: 500;
}

.drop-subtext {
  font-size: 14px;
  color: #888;
  margin-top: 4px;
}

.file-info {
  pointer-events: none;
}

.file-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.file-name {
  font-size: 18px;
  color: #333;
  font-weight: 500;
  word-break: break-all;
}

.file-hint {
  font-size: 14px;
  color: #888;
  margin-top: 4px;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e0e0e0;
  border-top-color: #4a90d9;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 12px;
  font-size: 14px;
  color: #666;
}
</style>
