<template>
  <div>
    <div 
      class="file-upload"
      :class="{ dragover: isDragover }"
      @click="handleClick"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
    >
      <input 
        type="file" 
        ref="fileInput"
        :accept="accept"
        style="display: none;"
        @change="handleFileChange"
      />
      <div class="file-upload-icon">📁</div>
      <div class="file-upload-text">{{ label }}</div>
      <div class="file-upload-hint">{{ hint }}</div>
    </div>

    <div v-if="fileInfo" class="file-info">
      <div class="file-info-name">
        <span class="file-icon" :class="getFileIconClass(fileInfo.status)">
          {{ getFileIcon(fileInfo.status) }}
        </span>
        <span class="file-name">{{ fileInfo.name }}</span>
      </div>
      <span v-if="fileInfo.status === 'success'" class="file-status">✓ 已上传</span>
      <span v-else-if="fileInfo.status === 'uploading'" class="file-status" style="color: var(--primary-color);">⏳ 上传中</span>
      <span v-else-if="fileInfo.status === 'error'" class="file-status" style="color: var(--danger-color);">✗ 上传失败</span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  accept: {
    type: String,
    default: '*'
  },
  label: {
    type: String,
    default: '点击或拖拽文件到此处上传'
  },
  hint: {
    type: String,
    default: '支持常见文件格式'
  },
  fileInfo: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['upload']);

const fileInput = ref(null);
const isDragover = ref(false);

const handleClick = () => {
  fileInput.value?.click();
};

const handleDragOver = () => {
  isDragover.value = true;
};

const handleDragLeave = () => {
  isDragover.value = false;
};

const handleDrop = (event) => {
  isDragover.value = false;
  const files = event.dataTransfer.files;
  if (files.length > 0) {
    processFile(files[0]);
  }
};

const handleFileChange = (event) => {
  const files = event.target.files;
  if (files.length > 0) {
    processFile(files[0]);
  }
};

const processFile = (file) => {
  emit('upload', file);
};

const getFileIcon = (status) => {
  switch (status) {
    case 'success': return '✅';
    case 'uploading': return '⏳';
    case 'error': return '❌';
    default: return '📄';
  }
};

const getFileIconClass = (status) => {
  switch (status) {
    case 'success': return { color: 'var(--success-color)' };
    case 'error': return { color: 'var(--danger-color)' };
    default: return {};
  }
};
</script>
