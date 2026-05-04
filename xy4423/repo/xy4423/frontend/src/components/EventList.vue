<template>
  <div class="event-list">
    <div class="list-header">
      <h3>📋 事件列表</h3>
      <div class="list-controls">
        <!-- 状态筛选 -->
        <select v-model="filterStatus" class="filter-select">
          <option value="">全部状态</option>
          <option value="pending">待处理</option>
          <option value="confirmed">已确认</option>
          <option value="rejected">已驳回</option>
          <option value="needs_review">需要复核</option>
          <option value="duplicate">重复观测</option>
          <option value="cloud_obscured">云层遮挡</option>
          <option value="power_loss">设备掉电</option>
        </select>
        
        <!-- 批量操作 -->
        <div v-if="selectedEventIds.length > 0" class="batch-actions">
          <span class="selected-count">{{ selectedEventIds.length }} 个已选</span>
          <select v-model="batchStatus" class="batch-select">
            <option value="">批量改判...</option>
            <option value="confirmed">确认</option>
            <option value="rejected">驳回</option>
            <option value="needs_review">标记需复核</option>
          </select>
          <button v-if="batchStatus" class="apply-btn" @click="applyBatchUpdate">
            应用
          </button>
        </div>
      </div>
    </div>
    
    <div v-if="filteredEvents.length === 0" class="empty-state">
      <p v-if="events.length === 0">暂无事件数据</p>
      <p v-else>没有符合筛选条件的事件</p>
    </div>
    
    <div v-else class="list-container">
      <div 
        v-for="event in filteredEvents" 
        :key="event.id" 
        class="event-card"
        :class="{ 
          'selected': event.id === selectedEventId,
          'selected-batch': selectedEventIds.includes(event.id)
        }"
        @click="selectEvent(event)"
      >
        <!-- 复选框 -->
        <div class="checkbox-wrapper" @click.stop="toggleSelection(event.id)">
          <input 
            type="checkbox" 
            :checked="selectedEventIds.includes(event.id)"
            @change="toggleSelection(event.id)"
          />
        </div>
        
        <!-- 状态指示 -->
        <div class="status-indicator" :class="event.status">
          <span class="status-icon">{{ getStatusIcon(event.status) }}</span>
        </div>
        
        <!-- 事件信息 -->
        <div class="event-info">
          <div class="event-id">事件 {{ event.id.substring(0, 8) }}...</div>
          <div class="event-time">
            <span class="time-label">开始:</span>
            <span class="time-value">{{ formatTime(event.startTime) }}</span>
            <span class="time-separator">|</span>
            <span class="time-label">持续:</span>
            <span class="time-value">{{ getDuration(event) }}</span>
          </div>
          <div class="event-meta">
            <span class="meta-item confidence" :class="getConfidenceClass(event.confidence)">
              置信度: {{ event.confidence }}%
            </span>
            <span class="meta-item sources">
              📷 {{ getCameraCount(event) }} 条 | 👁️ {{ getVisualCount(event) }} 条
            </span>
          </div>
        </div>
        
        <!-- 分析标记 -->
        <div class="analysis-flags">
          <span v-if="event.analysis.isDuplicate" class="flag duplicate" title="可能是重复观测">🔄</span>
          <span v-if="event.analysis.isCloudObscured" class="flag cloud" title="云层遮挡">☁️</span>
          <span v-if="event.analysis.hasPowerLoss" class="flag power" title="设备掉电">⚡</span>
          <span v-if="event.analysis.needsManualReview" class="flag review" title="需要人工复核">👁️</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'

dayjs.extend(duration)

export default {
  name: 'EventList',
  props: {
    events: {
      type: Array,
      default: () => []
    },
    selectedEventId: {
      type: String,
      default: null
    },
    selectedEventIds: {
      type: Array,
      default: () => []
    }
  },
  emits: ['select-event', 'toggle-selection'],
  setup(props, { emit }) {
    // 状态筛选
    const filterStatus = ref('')
    // 批量操作
    const batchStatus = ref('')

    // 计算属性：筛选后的事件
    const filteredEvents = computed(() => {
      let result = [...props.events]
      
      // 按时间倒序排列
      result.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
      
      // 状态筛选
      if (filterStatus.value) {
        result = result.filter(e => e.status === filterStatus.value)
      }
      
      return result
    })

    // 方法：获取状态图标
    const getStatusIcon = (status) => {
      const icons = {
        pending: '🟡',
        confirmed: '🟢',
        rejected: '🔴',
        needs_review: '🟠',
        duplicate: '🟣',
        cloud_obscured: '☁️',
        power_loss: '⚡'
      }
      return icons[status] || '⚪'
    }

    // 方法：格式化时间
    const formatTime = (timestamp) => {
      if (!timestamp) return ''
      return dayjs(timestamp).format('MM-DD HH:mm:ss')
    }

    // 方法：获取持续时间
    const getDuration = (event) => {
      if (!event.startTime || !event.endTime) return '未知'
      
      const start = dayjs(event.startTime)
      const end = dayjs(event.endTime)
      const diffMs = end.diff(start)
      
      if (diffMs < 1000) {
        return `${diffMs}ms`
      } else if (diffMs < 60000) {
        return `${Math.floor(diffMs / 1000)}s`
      } else {
        return `${Math.floor(diffMs / 60000)}m ${Math.floor((diffMs % 60000) / 1000)}s`
      }
    }

    // 方法：获取置信度颜色类
    const getConfidenceClass = (confidence) => {
      if (confidence >= 80) return 'high'
      if (confidence >= 60) return 'medium'
      return 'low'
    }

    // 方法：获取相机触发数量
    const getCameraCount = (event) => {
      return event.observations.filter(o => o.type === 'camera_trigger').length
    }

    // 方法：获取目视记录数量
    const getVisualCount = (event) => {
      return event.observations.filter(o => o.type === 'visual_record').length
    }

    // 方法：选择事件
    const selectEvent = (event) => {
      emit('select-event', event)
    }

    // 方法：切换选中状态
    const toggleSelection = (eventId) => {
      emit('toggle-selection', eventId)
    }

    // 方法：应用批量更新
    const applyBatchUpdate = async () => {
      if (!batchStatus.value || props.selectedEventIds.length === 0) return
      
      try {
        const response = await axios.post('/api/events/batch-update', {
          eventIds: props.selectedEventIds,
          status: batchStatus.value
        })
        
        if (response.data.success) {
          // 重置批量状态
          batchStatus.value = ''
          // 触发重新加载（通过父组件）
          emit('batch-updated')
        }
      } catch (error) {
        console.error('批量更新失败:', error)
      }
    }

    return {
      filterStatus,
      batchStatus,
      filteredEvents,
      getStatusIcon,
      formatTime,
      getDuration,
      getConfidenceClass,
      getCameraCount,
      getVisualCount,
      selectEvent,
      toggleSelection,
      applyBatchUpdate
    }
  }
}
</script>

<style scoped>
.event-list {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.list-header h3 {
  font-size: 1rem;
  color: #333;
  margin: 0;
}

.list-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.filter-select,
.batch-select {
  padding: 0.375rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.85rem;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.filter-select:focus,
.batch-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  background: #eff6ff;
  border-radius: 6px;
}

.selected-count {
  font-size: 0.8rem;
  color: #2563eb;
  font-weight: 500;
}

.apply-btn {
  padding: 0.375rem 0.75rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.apply-btn:hover {
  background: #2563eb;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #9ca3af;
  font-size: 0.9rem;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.list-container {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding-right: 0.25rem;
}

.event-card {
  display: flex;
  align-items: center;
  padding: 0.875rem;
  background: #fafafa;
  border: 2px solid transparent;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  gap: 0.75rem;
}

.event-card:hover {
  background: #f5f5f5;
  border-color: #e5e7eb;
}

.event-card.selected {
  border-color: #3b82f6;
  background: #eff6ff;
}

.event-card.selected-batch {
  background: #dbeafe;
}

.checkbox-wrapper {
  flex-shrink: 0;
  cursor: pointer;
}

.checkbox-wrapper input {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.status-indicator {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
}

.status-indicator.pending { background: #fef3c7; }
.status-indicator.confirmed { background: #d1fae5; }
.status-indicator.rejected { background: #fee2e2; }
.status-indicator.needs_review { background: #fed7aa; }
.status-indicator.duplicate { background: #ede9fe; }
.status-indicator.cloud_obscured { background: #e5e7eb; }
.status-indicator.power_loss { background: #fee2e2; }

.event-info {
  flex: 1;
  min-width: 0;
}

.event-id {
  font-size: 0.9rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.25rem;
}

.event-time {
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.time-label {
  color: #9ca3af;
}

.time-value {
  font-weight: 500;
}

.time-separator {
  color: #d1d5db;
}

.event-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.75rem;
}

.meta-item {
  display: inline-flex;
  align-items: center;
}

.confidence.high { color: #059669; font-weight: 600; }
.confidence.medium { color: #d97706; font-weight: 500; }
.confidence.low { color: #dc2626; font-weight: 500; }

.sources { color: #6b7280; }

.analysis-flags {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.flag {
  font-size: 0.85rem;
  cursor: help;
  opacity: 0.8;
  transition: opacity 0.2s ease;
}

.flag:hover {
  opacity: 1;
}

/* 滚动条样式 */
.list-container::-webkit-scrollbar {
  width: 6px;
}

.list-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.list-container::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.list-container::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}
</style>
