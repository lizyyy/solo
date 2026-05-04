<template>
  <div class="right-panel-container">
    <div class="panel-header">
      <span class="panel-title">CUE 详情</span>
      <el-tooltip content="刷新" placement="top">
        <el-button text @click="$emit('refresh')">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </el-tooltip>
    </div>

    <div v-if="!cueId" class="empty-state">
      <el-icon :size="48" color="#c0c4cc"><Pointer /></el-icon>
      <p>请从中间选择一个CUE</p>
    </div>

    <div v-else-if="!cueDetail" class="empty-state">
      <el-icon :size="48" color="#c0c4cc"><WarningFilled /></el-icon>
      <p>CUE不存在或已被删除</p>
    </div>

    <div v-else class="detail-content">
      <div class="cue-header">
        <div class="cue-type-badge" :class="getTypeClass(cueDetail.type)">
          <el-icon :size="16"><component :is="getTypeIcon(cueDetail.type)" /></el-icon>
          <span>{{ getTypeLabel(cueDetail.type) }}</span>
        </div>
        <el-tag :type="getStatusTagType(cueDetail.status)" size="large">
          {{ getStatusLabel(cueDetail.status) }}
        </el-tag>
      </div>

      <h3 class="cue-name">{{ cueDetail.name }}</h3>

      <el-descriptions :column="2" border size="small" class="info-section">
        <el-descriptions-item label="序号">#{{ cueDetail.order }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ getTypeLabel(cueDetail.type) }}</el-descriptions-item>
        <el-descriptions-item label="开始时间">{{ formatTime(cueDetail.start_time) }}</el-descriptions-item>
        <el-descriptions-item label="持续时间">{{ formatDuration(cueDetail.duration) }}</el-descriptions-item>
      </el-descriptions>

      <div v-if="cueDetail.delay_seconds > 0" class="delay-warning">
        <el-alert
          title="延误记录"
          type="warning"
          :closable="false"
          show-icon
        >
          <template #default>
            <div class="delay-details">
              <p><strong>延误时间:</strong> {{ cueDetail.delay_seconds }} 秒</p>
              <p v-if="cueDetail.delay_reason"><strong>延误原因:</strong> {{ cueDetail.delay_reason }}</p>
            </div>
          </template>
        </el-alert>
      </div>

      <el-divider content-position="left">
        <span class="divider-title">执行状态</span>
      </el-divider>

      <div class="execution-actions">
        <el-button 
          v-if="cueDetail.status === 'pending'"
          type="primary" 
          @click="startCue"
          style="width: 100%"
        >
          <el-icon><VideoPlay /></el-icon>
          开始执行
        </el-button>
        <template v-else-if="cueDetail.status === 'executing'">
          <el-button type="success" @click="completeCue" style="width: 100%">
            <el-icon><CircleCheck /></el-icon>
            标记完成
          </el-button>
          <el-button type="warning" @click="showDelayDialog" style="width: 100%; margin-top: 8px">
            <el-icon><Timer /></el-icon>
            记录延误
          </el-button>
        </template>
        <el-button 
          v-else-if="cueDetail.status === 'completed'"
          @click="resetCue"
          style="width: 100%"
        >
          <el-icon><RefreshRight /></el-icon>
          重置状态
        </el-button>
      </div>

      <div v-if="cueDetail.actual_start_time || cueDetail.actual_end_time" class="execution-times">
        <div class="time-item">
          <span class="time-label">实际开始</span>
          <span class="time-value">
            {{ cueDetail.actual_start_time ? formatTimestamp(cueDetail.actual_start_time) : '-' }}
          </span>
        </div>
        <div class="time-item">
          <span class="time-label">实际结束</span>
          <span class="time-value">
            {{ cueDetail.actual_end_time ? formatTimestamp(cueDetail.actual_end_time) : '-' }}
          </span>
        </div>
      </div>

      <el-divider content-position="left">
        <span class="divider-title">关联资源</span>
      </el-divider>

      <div class="resource-sections">
        <div v-if="cueDetail.actors && cueDetail.actors.length > 0" class="resource-group">
          <div class="group-header">
            <el-icon color="#8b5cf6"><User /></el-icon>
            <span>演员 ({{ cueDetail.actors.length }})</span>
          </div>
          <div class="resource-list">
            <div v-for="actor in cueDetail.actors" :key="actor.id" class="resource-item">
              <el-avatar :size="28" class="actor-avatar">
                {{ actor.name.charAt(0) }}
              </el-avatar>
              <div class="resource-info">
                <div class="resource-name">{{ actor.name }}</div>
                <div class="resource-meta">
                  <el-tag size="small" :type="actor.action === 'enter' ? 'success' : 'info'">
                    {{ actor.action === 'enter' ? '上场' : '下场' }}
                  </el-tag>
                  <span v-if="actor.role" class="meta-text">{{ actor.role }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="cueDetail.props && cueDetail.props.length > 0" class="resource-group">
          <div class="group-header">
            <el-icon color="#10b981"><Box /></el-icon>
            <span>道具 ({{ cueDetail.props.length }})</span>
          </div>
          <div class="resource-list">
            <div v-for="prop in cueDetail.props" :key="prop.id" class="resource-item">
              <div class="resource-icon prop-icon">
                <el-icon color="#10b981"><Box /></el-icon>
              </div>
              <div class="resource-info">
                <div class="resource-name">{{ prop.name }}</div>
                <div class="resource-meta">
                  <el-tag size="small" :type="prop.action === 'enter' ? 'success' : 'warning'">
                    {{ prop.action === 'enter' ? '上场' : '撤场' }}
                  </el-tag>
                  <span v-if="prop.location" class="meta-text">{{ prop.location }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="cueDetail.microphones && cueDetail.microphones.length > 0" class="resource-group">
          <div class="group-header">
            <el-icon color="#3b82f6"><Microphone /></el-icon>
            <span>麦克风 ({{ cueDetail.microphones.length }})</span>
          </div>
          <div class="resource-list">
            <div v-for="mic in cueDetail.microphones" :key="mic.id" class="resource-item">
              <div class="resource-icon mic-icon">
                <el-icon color="#3b82f6"><Microphone /></el-icon>
              </div>
              <div class="resource-info">
                <div class="resource-name">{{ mic.name }}</div>
                <div class="resource-meta">
                  <el-tag size="small" type="primary">
                    通道 {{ mic.channel }}
                  </el-tag>
                  <el-progress 
                    :percentage="mic.battery_level" 
                    :status="mic.battery_level < 20 ? 'exception' : mic.battery_level < 50 ? 'warning' : ''"
                    :stroke-width="6"
                    :show-text="false"
                    style="width: 60px; margin-left: 8px"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div 
          v-if="(!cueDetail.actors || cueDetail.actors.length === 0) &&
                 (!cueDetail.props || cueDetail.props.length === 0) &&
                 (!cueDetail.microphones || cueDetail.microphones.length === 0)"
          class="empty-resources"
        >
          <el-text type="secondary">此CUE暂未关联任何资源</el-text>
        </div>
      </div>

      <el-divider content-position="left">
        <span class="divider-title">风险检查</span>
      </el-divider>

      <div class="risk-section">
        <div v-if="risks.length === 0" class="no-risks">
          <el-icon :size="32" color="#67c23a"><CircleCheck /></el-icon>
          <span>未检测到风险</span>
        </div>
        <div v-else class="risk-list">
          <div 
            v-for="(risk, index) in risks" 
            :key="index"
            class="risk-item"
            :class="risk.severity"
          >
            <el-icon v-if="risk.severity === 'critical'" color="#ef4444"><WarningFilled /></el-icon>
            <el-icon v-else-if="risk.severity === 'warning'" color="#f59e0b"><Warning /></el-icon>
            <span class="risk-text">{{ risk.description }}</span>
          </div>
        </div>
      </div>

      <el-divider content-position="left">
        <span class="divider-title">备注</span>
      </el-divider>

      <div class="notes-section">
        <el-input
          v-model="notesText"
          type="textarea"
          :rows="3"
          placeholder="输入备注信息..."
          @blur="saveNotes"
        />
        <div v-if="cueDetail.notes && !isEditingNotes" class="notes-display">
          {{ cueDetail.notes }}
        </div>
      </div>
    </div>

    <el-dialog
      v-model="showDelay"
      title="记录延误"
      width="400px"
    >
      <el-form label-width="80px">
        <el-form-item label="延误时间">
          <el-input-number v-model="delayForm.seconds" :min="0" :max="3600" style="width: 100%" />
          <span class="form-hint">秒</span>
        </el-form-item>
        <el-form-item label="延误原因">
          <el-input
            v-model="delayForm.reason"
            type="textarea"
            :rows="3"
            placeholder="请输入延误原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDelay = false">取消</el-button>
        <el-button type="primary" @click="recordDelay">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useShowStore } from '@/stores/showStore'

const props = defineProps({
  cueId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['refresh'])

const showStore = useShowStore()

const cueDetail = ref(null)
const notesText = ref('')
const isEditingNotes = ref(false)
const showDelay = ref(false)

const delayForm = ref({
  seconds: 0,
  reason: ''
})

const risks = computed(() => {
  const result = []
  
  if (!cueDetail.value) return result

  if (cueDetail.value.microphones) {
    for (const mic of cueDetail.value.microphones) {
      if (mic.battery_level < 20) {
        result.push({
          severity: 'critical',
          description: `麦克风 "${mic.name}" 电量极低 (${mic.battery_level}%)`
        })
      } else if (mic.battery_level < 50) {
        result.push({
          severity: 'warning',
          description: `麦克风 "${mic.name}" 电量较低 (${mic.battery_level}%)`
        })
      }
    }
  }

  if (cueDetail.value.delay_seconds > 0) {
    result.push({
      severity: 'warning',
      description: `此CUE曾延误 ${cueDetail.value.delay_seconds} 秒`
    })
  }

  if (cueDetail.value.props) {
    for (const prop of cueDetail.value.props) {
      if (prop.status === 'on_stage' && prop.action === 'enter') {
        result.push({
          severity: 'warning',
          description: `道具 "${prop.name}" 当前已在场上`
        })
      }
    }
  }

  return result
})

const loadCueDetail = async () => {
  if (!props.cueId) {
    cueDetail.value = null
    notesText.value = ''
    return
  }

  cueDetail.value = await showStore.getCueById(props.cueId)
  if (cueDetail.value) {
    notesText.value = cueDetail.value.notes || ''
  }
}

const getTypeClass = (type) => {
  const classes = {
    lighting: 'type-lighting',
    sound: 'type-sound',
    prop: 'type-prop',
    actor: 'type-actor'
  }
  return classes[type] || 'type-default'
}

const getTypeIcon = (type) => {
  const icons = {
    lighting: 'Sunny',
    sound: 'Headset',
    prop: 'Box',
    actor: 'User'
  }
  return icons[type] || 'QuestionFilled'
}

const getTypeLabel = (type) => {
  const labels = {
    lighting: '灯光',
    sound: '音响',
    prop: '道具',
    actor: '演员'
  }
  return labels[type] || type
}

const getStatusLabel = (status) => {
  const labels = {
    pending: '待执行',
    executing: '执行中',
    completed: '已完成',
    delayed: '延误'
  }
  return labels[status] || status
}

const getStatusTagType = (status) => {
  const types = {
    pending: 'info',
    executing: 'primary',
    completed: 'success',
    delayed: 'danger'
  }
  return types[status] || 'info'
}

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const formatDuration = (seconds) => {
  if (seconds < 60) return `${seconds}秒`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (secs === 0) return `${mins}分`
  return `${mins}分${secs}秒`
}

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp * 1000)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const startCue = async () => {
  if (!cueDetail.value) return
  await showStore.updateCueStatus(cueDetail.value.id, 'executing')
  ElMessage.success('开始执行')
  await loadCueDetail()
  emit('refresh')
}

const completeCue = async () => {
  if (!cueDetail.value) return
  await showStore.updateCueStatus(cueDetail.value.id, 'completed')
  ElMessage.success('已标记完成')
  await loadCueDetail()
  emit('refresh')
}

const resetCue = async () => {
  if (!cueDetail.value) return
  await showStore.updateCueStatus(cueDetail.value.id, 'pending')
  ElMessage.info('已重置状态')
  await loadCueDetail()
  emit('refresh')
}

const showDelayDialog = () => {
  delayForm.value = {
    seconds: 0,
    reason: ''
  }
  showDelay.value = true
}

const recordDelay = async () => {
  if (!cueDetail.value) return
  await showStore.updateCueStatus(
    cueDetail.value.id,
    'executing',
    delayForm.value.reason,
    delayForm.value.seconds
  )
  ElMessage.warning(`已记录延误: ${delayForm.value.seconds}秒`)
  showDelay.value = false
  await loadCueDetail()
  emit('refresh')
}

const saveNotes = async () => {
  if (!cueDetail.value) return
  await showStore.addCueNote(cueDetail.value.id, notesText.value)
  ElMessage.success('备注已保存')
  await loadCueDetail()
}

watch(() => props.cueId, () => {
  loadCueDetail()
}, { immediate: true })

onMounted(() => {
  if (props.cueId) {
    loadCueDetail()
  }
})
</script>

<style scoped>
.right-panel-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
  background: #fff;
}

.panel-title {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  padding: 40px 20px;
}

.empty-state p {
  margin-top: 12px;
  font-size: 14px;
}

.detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.cue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.cue-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

.cue-type-badge.type-lighting { background: #fef3c7; color: #d97706; }
.cue-type-badge.type-sound { background: #dbeafe; color: #2563eb; }
.cue-type-badge.type-prop { background: #d1fae5; color: #059669; }
.cue-type-badge.type-actor { background: #ede9fe; color: #7c3aed; }

.cue-name {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 16px 0;
}

.info-section {
  margin-bottom: 16px;
}

.delay-warning {
  margin-bottom: 16px;
}

.delay-details {
  margin-top: 8px;
}

.delay-details p {
  margin: 4px 0;
  font-size: 13px;
}

.divider-title {
  font-weight: 600;
  font-size: 13px;
  color: #606266;
}

.execution-actions {
  margin-bottom: 16px;
}

.execution-times {
  background: #fafafa;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

.time-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
}

.time-label {
  color: #909399;
  font-size: 13px;
}

.time-value {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 13px;
  font-weight: 500;
  color: #303133;
}

.resource-sections {
  margin-bottom: 8px;
}

.resource-group {
  margin-bottom: 16px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
}

.resource-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.resource-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
}

.actor-avatar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  flex-shrink: 0;
}

.resource-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.prop-icon {
  background: #d1fae5;
}

.mic-icon {
  background: #dbeafe;
}

.resource-info {
  flex: 1;
  min-width: 0;
}

.resource-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
}

.resource-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-text {
  font-size: 12px;
  color: #909399;
}

.empty-resources {
  text-align: center;
  padding: 16px;
}

.risk-section {
  margin-bottom: 16px;
}

.no-risks {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  color: #67c23a;
}

.risk-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.risk-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
}

.risk-item.critical {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.risk-item.warning {
  background: #fffbeb;
  border: 1px solid #fed7aa;
}

.risk-text {
  font-size: 13px;
  color: #303133;
}

.notes-section {
  margin-bottom: 16px;
}

.notes-display {
  margin-top: 8px;
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
  font-size: 13px;
  color: #606266;
  white-space: pre-wrap;
}

.form-hint {
  color: #909399;
  font-size: 12px;
  margin-left: 8px;
}
</style>
