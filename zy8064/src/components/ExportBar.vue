<template>
  <div class="export-bar">
    <button class="export-btn" @click="$emit('export-csv')" :disabled="!hasIssues">
      📊 导出 issues.csv
    </button>
    <button class="export-btn" @click="$emit('export-md')" :disabled="!hasIssues">
      📝 导出 summary.md
    </button>
    <button class="export-btn secondary" @click="$emit('export-summary-csv')" :disabled="!hasIssues">
      📋 导出摘要 CSV
    </button>
  </div>
</template>

<script setup>
defineProps({
  hasIssues: Boolean
})

defineEmits(['export-csv', 'export-md', 'export-summary-csv'])
</script>

<style scoped>
.export-bar {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  justify-content: center;
}

.export-btn {
  padding: 10px 20px;
  background: #4a90d9;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.export-btn:hover:not(:disabled) {
  background: #3a7bc8;
}

.export-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.export-btn.secondary {
  background: #f5f5f5;
  color: #666;
  border: 1px solid #ddd;
}

.export-btn.secondary:hover:not(:disabled) {
  background: #eee;
}
</style>
