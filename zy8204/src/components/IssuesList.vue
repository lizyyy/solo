<template>
  <div class="issues-panel">
    <div class="stats-summary">
      <div class="stat-item">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">问题总数</div>
      </div>
      <div class="stat-item">
        <div class="stat-value error">{{ stats.errors }}</div>
        <div class="stat-label">错误</div>
      </div>
      <div class="stat-item">
        <div class="stat-value warning">{{ stats.warnings }}</div>
        <div class="stat-label">警告</div>
      </div>
      <div class="stat-item">
        <div class="stat-value info">{{ stats.infos }}</div>
        <div class="stat-label">提示</div>
      </div>
    </div>
    
    <div class="filter-buttons">
      <button 
        class="filter-btn" 
        :class="{ active: filterType === 'all' }"
        @click="filterType = 'all'"
      >
        全部
      </button>
      <button 
        class="filter-btn" 
        :class="{ active: filterType === 'error' }"
        @click="filterType = 'error'"
      >
        错误 ({{ stats.errors }})
      </button>
      <button 
        class="filter-btn" 
        :class="{ active: filterType === 'warning' }"
        @click="filterType = 'warning'"
      >
        警告 ({{ stats.warnings }})
      </button>
      <button 
        class="filter-btn" 
        :class="{ active: filterType === 'info' }"
        @click="filterType = 'info'"
      >
        提示 ({{ stats.infos }})
      </button>
    </div>
    
    <div class="issues-list" v-if="filteredIssues.length > 0">
      <div
        v-for="issue in filteredIssues"
        :key="issue.id"
        class="issue-item"
        :class="[issue.type, { selected: selectedIssueId === issue.id }]"
        @click="onIssueClick(issue)"
      >
        <div class="issue-title">
          <span class="status-badge" :class="issue.type">{{ getIssueTypeLabel(issue.type) }}</span>
          {{ issue.title }}
        </div>
        <div class="issue-details">{{ issue.message }}</div>
        <div class="issue-location" v-if="issue.location">
          📍 {{ issue.location }}
        </div>
      </div>
    </div>
    
    <div class="empty-state" v-else>
      <div class="empty-state-icon">✅</div>
      <div>
        {{ filterType === 'all' ? '暂无问题' : '该类型无问题' }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  issues: {
    type: Array,
    default: () => []
  },
  stats: {
    type: Object,
    default: () => ({ total: 0, errors: 0, warnings: 0, infos: 0 })
  },
  selectedIssueId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['issue-click'])

const filterType = ref('all')

const filteredIssues = computed(() => {
  if (filterType.value === 'all') {
    return props.issues
  }
  return props.issues.filter(issue => issue.type === filterType.value)
})

function getIssueTypeLabel(type) {
  const labels = {
    error: '错误',
    warning: '警告',
    info: '提示'
  }
  return labels[type] || type
}

function onIssueClick(issue) {
  emit('issue-click', issue)
}
</script>

<style scoped>
.issues-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.filter-buttons {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 0.4rem 0.8rem;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-btn:hover {
  background: #f5f5f5;
  border-color: #bbb;
}

.filter-btn.active {
  background: #3498db;
  color: white;
  border-color: #3498db;
}

.stat-value.error {
  color: #e74c3c;
}

.stat-value.warning {
  color: #f39c12;
}

.stat-value.info {
  color: #3498db;
}
</style>
