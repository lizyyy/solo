<template>
  <div class="event-detail">
    <div class="detail-header">
      <h3>🔍 事件详情</h3>
      <div class="event-status-badge" :class="event.status">
        {{ getStatusText(event.status) }}
      </div>
    </div>
    
    <!-- 基本信息 -->
    <div class="detail-section">
      <h4>📌 基本信息</h4>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">事件 ID</span>
          <span class="info-value">{{ event.id }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">开始时间</span>
          <span class="info-value">{{ formatTime(event.startTime) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">结束时间</span>
          <span class="info-value">{{ formatTime(event.endTime) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">持续时间</span>
          <span class="info-value">{{ getDuration(event) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">置信度</span>
          <span class="info-value confidence" :class="getConfidenceClass(event.confidence)">
            {{ event.confidence }}%
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">创建时间</span>
          <span class="info-value">{{ formatTime(event.createdAt) }}</span>
        </div>
      </div>
    </div>
    
    <!-- 系统分析 -->
    <div class="detail-section">
      <h4>🤖 系统分析</h4>
      
      <!-- 分析标记 -->
      <div class="analysis-flags">
        <div v-if="event.analysis.isDuplicate" class="flag-item duplicate">
          <span class="flag-icon">🔄</span>
          <span class="flag-text">可能是重复观测</span>
          <span v-if="event.analysis.duplicateOf" class="flag-detail">
            参考事件: {{ event.analysis.duplicateOf.substring(0, 8) }}...
          </span>
        </div>
        
        <div v-if="event.analysis.isCloudObscured" class="flag-item cloud">
          <span class="flag-icon">☁️</span>
          <span class="flag-text">云层遮挡</span>
          <span class="flag-detail">
            云量: {{ event.analysis.cloudCoverage.toFixed(1) }}%
          </span>
        </div>
        
        <div v-if="event.analysis.hasPowerLoss" class="flag-item power">
          <span class="flag-icon">⚡</span>
          <span class="flag-text">设备掉电</span>
          <span class="flag-detail">
            {{ event.analysis.powerLossEvents.length }} 个低电量事件
          </span>
        </div>
        
        <div v-if="event.analysis.needsManualReview" class="flag-item review">
          <span class="flag-icon">👁️</span>
          <span class="flag-text">建议人工复核</span>
        </div>
        
        <div v-if="!hasAnyAnalysis" class="no-analysis">
          无特殊分析标记
        </div>
      </div>
      
      <!-- 系统备注 -->
      <div v-if="event.notes" class="system-notes">
        <h5>📝 系统备注</h5>
        <pre>{{ event.notes }}</pre>
      </div>
    </div>
    
    <!-- 观测数据 -->
    <div class="detail-section">
      <h4>📊 观测数据 ({{ event.observations.length }})</h4>
      <div class="observations-list">
        <div 
          v-for="(obs, index) in event.observations" 
          :key="obs.id" 
          class="observation-item"
        >
          <div class="obs-header">
            <span class="obs-type" :class="obs.type">
              {{ getObservationTypeIcon(obs.type) }}
              {{ getObservationTypeText(obs.type) }}
            </span>
            <span class="obs-time">{{ formatTime(obs.timestamp) }}</span>
          </div>
          <div class="obs-source">
            来源: {{ obs.sourceFile }}
          </div>
          <details class="obs-details">
            <summary>查看原始数据</summary>
            <pre>{{ JSON.stringify(obs.rawData, null, 2) }}</pre>
          </details>
        </div>
      </div>
    </div>
    
    <!-- 管理员操作区 -->
    <div class="detail-section admin-section">
      <h4>⚙️ 管理员操作</h4>
      
      <!-- 状态改判 -->
      <div class="form-group">
        <label>改判状态</label>
        <select v-model="editStatus" class="form-select">
          <option value="pending">待处理</option>
          <option value="confirmed">已确认</option>
          <option value="rejected">已驳回</option>
          <option value="needs_review">需要复核</option>
          <option value="duplicate">重复观测</option>
          <option value="cloud_obscured">云层遮挡</option>
          <option value="power_loss">设备掉电</option>
        </select>
      </div>
      
      <!-- 管理员备注 -->
      <div class="form-group">
        <label>管理员备注</label>
        <textarea 
          v-model="editAdminComment" 
          class="form-textarea"
          placeholder="添加管理员备注..."
          rows="4"
        ></textarea>
      </div>
      
      <!-- 保存按钮 -->
      <div class="action-buttons">
        <button 
          class="save-btn" 
          :disabled="isSaving"
          @click="saveChanges"
        >
          {{ isSaving ? '保存中...' : '💾 保存更改' }}
        </button>
        <button 
          v-if="hasChanges"
          class="reset-btn" 
          @click="resetChanges"
        >
          重置
        </button>
      </div>
      
      <!-- 管理员历史备注 -->
      <div v-if="event.adminComment" class="admin-comment-history">
        <h5>📌 历史备注</h5>
        <div class="comment-box">
          {{ event.adminComment }}
        </div>
        <div class="comment-meta">
          最后更新: {{ formatTime(event.updatedAt || event.createdAt) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import dayjs from 'dayjs'

export default {
  name: 'EventDetail',
  props: {
    event: {
      type: Object,
      required: true
    }
  },
  emits: ['update-event'],
  setup(props, { emit }) {
    // 编辑状态
    const editStatus = ref(props.event.status)
    const editAdminComment = ref(props.event.adminComment || '')
    const isSaving = ref(false)

    // 监听事件变化，重置编辑状态
    watch(() => props.event, (newEvent) => {
      editStatus.value = newEvent.status
      editAdminComment.value = newEvent.adminComment || ''
    }, { deep: true })

    // 计算属性：是否有分析标记
    const hasAnyAnalysis = computed(() => {
      return props.event.analysis.isDuplicate ||
             props.event.analysis.isCloudObscured ||
             props.event.analysis.hasPowerLoss ||
             props.event.analysis.needsManualReview
    })

    // 计算属性：是否有更改
    const hasChanges = computed(() => {
      return editStatus.value !== props.event.status ||
             editAdminComment.value !== (props.event.adminComment || '')
    })

    // 方法：获取状态文本
    const getStatusText = (status) => {
      const statusMap = {
        pending: '待处理',
        confirmed: '已确认',
        rejected: '已驳回',
        needs_review: '需要复核',
        duplicate: '重复观测',
        cloud_obscured: '云层遮挡',
        power_loss: '设备掉电'
      }
      return statusMap[status] || status
    }

    // 方法：格式化时间
    const formatTime = (timestamp) => {
      if (!timestamp) return '未知'
      return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')
    }

    // 方法：获取持续时间
    const getDuration = (event) => {
      if (!event.startTime || !event.endTime) return '未知'
      
      const start = dayjs(event.startTime)
      const end = dayjs(event.endTime)
      const diffMs = end.diff(start)
      
      if (diffMs < 1000) {
        return `${diffMs} 毫秒`
      } else if (diffMs < 60000) {
        return `${Math.floor(diffMs / 1000)} 秒`
      } else {
        const minutes = Math.floor(diffMs / 60000)
        const seconds = Math.floor((diffMs % 60000) / 1000)
        return `${minutes} 分 ${seconds} 秒`
      }
    }

    // 方法：获取置信度颜色类
    const getConfidenceClass = (confidence) => {
      if (confidence >= 80) return 'high'
      if (confidence >= 60) return 'medium'
      return 'low'
    }

    // 方法：获取观测类型图标
    const getObservationTypeIcon = (type) => {
      const icons = {
        camera_trigger: '📷',
        visual_record: '👁️',
        weather_data: '🌤️',
        battery_data: '🔋'
      }
      return icons[type] || '📄'
    }

    // 方法：获取观测类型文本
    const getObservationTypeText = (type) => {
      const types = {
        camera_trigger: '相机触发',
        visual_record: '目视记录',
        weather_data: '天气数据',
        battery_data: '电池数据'
      }
      return types[type] || type
    }

    // 方法：保存更改
    const saveChanges = async () => {
      if (!hasChanges.value) return
      
      isSaving.value = true
      
      try {
        emit('update-event', {
          eventId: props.event.id,
          updates: {
            status: editStatus.value,
            adminComment: editAdminComment.value
          }
        })
      } finally {
        isSaving.value = false
      }
    }

    // 方法：重置更改
    const resetChanges = () => {
      editStatus.value = props.event.status
      editAdminComment.value = props.event.adminComment || ''
    }

    return {
      editStatus,
      editAdminComment,
      isSaving,
      hasAnyAnalysis,
      hasChanges,
      getStatusText,
      formatTime,
      getDuration,
      getConfidenceClass,
      getObservationTypeIcon,
      getObservationTypeText,
      saveChanges,
      resetChanges
    }
  }
}
</script>

<style scoped>
.event-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
  border-bottom: 1px solid #e2e8f0;
}

.detail-header h3 {
  font-size: 1rem;
  color: #1e293b;
  margin: 0;
}

.event-status-badge {
  padding: 0.375rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
}

.event-status-badge.pending { background: #fef3c7; color: #92400e; }
.event-status-badge.confirmed { background: #d1fae5; color: #065f46; }
.event-status-badge.rejected { background: #fee2e2; color: #991b1b; }
.event-status-badge.needs_review { background: #fed7aa; color: #9a3412; }
.event-status-badge.duplicate { background: #ede9fe; color: #5b21b6; }
.event-status-badge.cloud_obscured { background: #e5e7eb; color: #374151; }
.event-status-badge.power_loss { background: #fee2e2; color: #991b1b; }

.detail-section {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;
}

.detail-section:last-child {
  border-bottom: none;
}

.detail-section h4 {
  font-size: 0.9rem;
  color: #374151;
  margin: 0 0 0.75rem 0;
  font-weight: 600;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.75rem;
  color: #9ca3af;
}

.info-value {
  font-size: 0.85rem;
  color: #374151;
  font-weight: 500;
  word-break: break-all;
}

.info-value.confidence.high { color: #059669; }
.info-value.confidence.medium { color: #d97706; }
.info-value.confidence.low { color: #dc2626; }

/* 系统分析 */
.analysis-flags {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.flag-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
}

.flag-item.duplicate { background: #faf5ff; color: #6b21a8; }
.flag-item.cloud { background: #f3f4f6; color: #374151; }
.flag-item.power { background: #fef2f2; color: #991b1b; }
.flag-item.review { background: #fff7ed; color: #9a3412; }

.flag-icon {
  font-size: 1rem;
}

.flag-text {
  font-weight: 500;
}

.flag-detail {
  font-size: 0.75rem;
  opacity: 0.8;
  margin-left: auto;
}

.no-analysis {
  text-align: center;
  padding: 1rem;
  color: #9ca3af;
  font-size: 0.85rem;
}

.system-notes {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed #e5e7eb;
}

.system-notes h5 {
  font-size: 0.8rem;
  color: #6b7280;
  margin: 0 0 0.5rem 0;
}

.system-notes pre {
  margin: 0;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 0.75rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: #4b5563;
}

/* 观测数据 */
.observations-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.observation-item {
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.obs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.obs-type {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.obs-type.camera_trigger { background: #dbeafe; color: #1e40af; }
.obs-type.visual_record { background: #fce7f3; color: #9d174d; }
.obs-type.weather_data { background: #d1fae5; color: #065f46; }
.obs-type.battery_data { background: #fef3c7; color: #92400e; }

.obs-time {
  font-size: 0.75rem;
  color: #9ca3af;
}

.obs-source {
  font-size: 0.7rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.obs-details {
  font-size: 0.75rem;
}

.obs-details summary {
  cursor: pointer;
  color: #3b82f6;
  user-select: none;
}

.obs-details summary:hover {
  color: #2563eb;
}

.obs-details pre {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #1e293b;
  color: #e2e8f0;
  border-radius: 4px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}

/* 管理员操作区 */
.admin-section {
  background: #fafafa;
}

.form-group {
  margin-bottom: 0.75rem;
}

.form-group label {
  display: block;
  font-size: 0.8rem;
  color: #6b7280;
  margin-bottom: 0.375rem;
  font-weight: 500;
}

.form-select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.85rem;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.form-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.85rem;
  background: white;
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.2s ease;
}

.form-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea::placeholder {
  color: #9ca3af;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.save-btn {
  flex: 1;
  padding: 0.625rem 1rem;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.save-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  transform: translateY(-1px);
}

.save-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.reset-btn {
  padding: 0.625rem 1rem;
  background: white;
  color: #6b7280;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reset-btn:hover {
  background: #f3f4f6;
}

/* 历史备注 */
.admin-comment-history {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px dashed #e5e7eb;
}

.admin-comment-history h5 {
  font-size: 0.8rem;
  color: #6b7280;
  margin: 0 0 0.5rem 0;
}

.comment-box {
  padding: 0.75rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.85rem;
  line-height: 1.5;
  color: #374151;
  white-space: pre-wrap;
  word-break: break-word;
}

.comment-meta {
  font-size: 0.7rem;
  color: #9ca3af;
  margin-top: 0.375rem;
  text-align: right;
}

/* 滚动条样式 */
.event-detail::-webkit-scrollbar {
  width: 6px;
}

.event-detail::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.event-detail::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.event-detail::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}
</style>
