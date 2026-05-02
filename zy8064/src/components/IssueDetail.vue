<template>
  <div v-if="issue" class="issue-detail">
    <div class="detail-header">
      <h3>问题详情</h3>
      <RiskBadge :severity="issue.rule?.severity" />
    </div>

    <div class="detail-content">
      <div class="detail-row">
        <span class="detail-label">规则ID</span>
        <span class="detail-value">{{ issue.rule?.id }}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">规则名称</span>
        <span class="detail-value">{{ issue.rule?.name }}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">严重级别</span>
        <span class="detail-value">{{ severityLabel }}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">类型</span>
        <span class="detail-value">{{ typeLabel }}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">章节</span>
        <span class="detail-value">{{ issue.chapterTitle || '全局' }}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">位置</span>
        <span class="detail-value">{{ issue.location || 'N/A' }}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">元素</span>
        <span class="detail-value">{{ issue.element || 'N/A' }}</span>
      </div>

      <div class="detail-row full-width">
        <span class="detail-label">问题描述</span>
        <span class="detail-value message">{{ issue.message }}</span>
      </div>

      <div v-if="issue.details && Object.keys(issue.details).length > 0" class="detail-row full-width">
        <span class="detail-label">详细信息</span>
        <pre class="detail-value details">{{ JSON.stringify(issue.details, null, 2) }}</pre>
      </div>
    </div>
  </div>

  <div v-else class="no-detail">
    <div class="no-detail-icon">📋</div>
    <div class="no-detail-text">选择一个问题查看详情</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import RiskBadge from './RiskBadge.vue'

const props = defineProps({
  issue: {
    type: Object,
    default: null
  }
})

const severityLabel = computed(() => {
  const map = { critical: '严重', warning: '警告', info: '信息' }
  return map[props.issue?.rule?.severity] || '未知'
})

const typeLabel = computed(() => {
  const map = {
    alt: 'Alt 文本',
    heading: '标题层级',
    toc: '目录',
    manifest: 'Manifest',
    spine: 'Spine',
    image: '图片'
  }
  return map[props.issue?.rule?.type] || '未知'
})
</script>

<style scoped>
.issue-detail {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  overflow: hidden;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}

.detail-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.detail-content {
  padding: 16px;
}

.detail-row {
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
}

.detail-row.full-width {
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 12px;
  color: #888;
  min-width: 80px;
  font-weight: 500;
}

.detail-value {
  font-size: 13px;
  color: #333;
}

.detail-value.message {
  line-height: 1.5;
}

.detail-value.details {
  background: #f5f5f5;
  padding: 10px;
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
  margin: 0;
}

.no-detail {
  padding: 60px 20px;
  text-align: center;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.no-detail-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.no-detail-text {
  font-size: 14px;
  color: #888;
}
</style>
