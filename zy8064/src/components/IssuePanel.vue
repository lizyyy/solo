<template>
  <div class="issue-panel">
    <div class="issue-header">
      <h3>问题列表</h3>
      <span class="issue-count">{{ issues.length }} 个问题</span>
    </div>

    <div v-if="issues.length === 0" class="no-issues">
      <div class="no-issues-icon">✅</div>
      <div class="no-issues-text">未发现问题</div>
    </div>

    <div v-else class="issue-list">
      <div
        v-for="issue in issues"
        :key="issue.id"
        class="issue-item"
        :class="{ active: selectedId === issue.id, [issue.rule?.severity]: true }"
        @click="$emit('select', issue.id)"
      >
        <div class="issue-top">
          <RiskBadge :severity="issue.rule?.severity" />
          <span class="issue-rule">{{ issue.rule?.name }}</span>
        </div>
        <div class="issue-message">{{ issue.message }}</div>
        <div class="issue-location">
          {{ issue.chapterTitle ? `📖 ${issue.chapterTitle}` : '' }}
          {{ issue.location ? `→ ${issue.location}` : '' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import RiskBadge from './RiskBadge.vue'

defineProps({
  issues: {
    type: Array,
    default: () => []
  },
  selectedId: {
    type: String,
    default: null
  }
})

defineEmits(['select'])
</script>

<style scoped>
.issue-panel {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  overflow: hidden;
}

.issue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}

.issue-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.issue-count {
  font-size: 12px;
  color: #888;
}

.no-issues {
  padding: 40px 20px;
  text-align: center;
}

.no-issues-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.no-issues-text {
  font-size: 16px;
  color: #4CAF50;
}

.issue-list {
  max-height: 500px;
  overflow-y: auto;
}

.issue-item {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.15s;
  border-left: 3px solid transparent;
}

.issue-item:hover {
  background: #f9f9f9;
}

.issue-item.active {
  background: #f0f7ff;
}

.issue-item.critical {
  border-left-color: #c62828;
}

.issue-item.warning {
  border-left-color: #ef6c00;
}

.issue-item.info {
  border-left-color: #1565c0;
}

.issue-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.issue-rule {
  font-size: 13px;
  font-weight: 500;
  color: #333;
}

.issue-message {
  font-size: 13px;
  color: #555;
  line-height: 1.4;
  margin-bottom: 4px;
}

.issue-location {
  font-size: 11px;
  color: #888;
}
</style>
