<template>
  <div class="center-panel-container">
    <div class="panel-header">
      <div class="header-left">
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="timeline">
            <el-icon><Clock /></el-icon>
            时间线
          </el-radio-button>
          <el-radio-button value="list">
            <el-icon><List /></el-icon>
            列表
          </el-radio-button>
        </el-radio-group>
      </div>
      <div class="header-center">
        <span v-if="selectedSceneName" class="scene-info">
          <el-icon><Location /></el-icon>
          {{ selectedSceneName }}
        </span>
        <span v-else class="empty-hint">请从左侧选择场景</span>
      </div>
      <div class="header-right">
        <el-button text @click="$emit('refresh')">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button type="primary" size="small" @click="showAddCue = true" :disabled="!selectedSceneId">
          <el-icon><Plus /></el-icon>
          添加CUE
        </el-button>
      </div>
    </div>

    <div v-if="!selectedSceneId" class="empty-state">
      <el-icon :size="64" color="#dcdfe6"><VideoCamera /></el-icon>
      <h3>选择场景查看CUE</h3>
      <p>从左侧节目树选择一个场景，即可查看和编辑该场景的CUE</p>
    </div>

    <div v-else-if="cues.length === 0" class="empty-state">
      <el-icon :size="64" color="#dcdfe6"><DocumentAdd /></el-icon>
      <h3>暂无CUE</h3>
      <p>点击右上角"添加CUE"按钮创建第一个CUE</p>
    </div>

    <div v-else class="content-area">
      <div v-if="viewMode === 'timeline'" class="timeline-view">
        <div class="timeline-header">
          <div class="time-ruler">
            <div 
              v-for="tick in timelineTicks" 
              :key="tick.time"
              class="time-tick"
              :style="{ left: tick.position + '%' }"
            >
              <span class="tick-label">{{ tick.label }}</span>
            </div>
          </div>
        </div>
        
        <div class="timeline-body">
          <div 
            v-for="cue in sortedCues" 
            :key="cue.id"
            class="timeline-cue"
            :class="{ 
              'is-selected': selectedCueId === cue.id,
              'is-pending': cue.status === 'pending',
              'is-executing': cue.status === 'executing',
              'is-completed': cue.status === 'completed',
              'is-delayed': cue.delay_seconds > 0
            }"
            :style="{
              left: getCuePosition(cue) + '%',
              width: getCueWidth(cue) + '%'
            }"
            @click="selectCue(cue)"
          >
            <div class="cue-type-indicator" :class="getCueTypeClass(cue.type)"></div>
            <div class="cue-content">
              <div class="cue-name">{{ cue.name }}</div>
              <div class="cue-meta">
                <span class="cue-time">{{ formatTime(cue.start_time) }}</span>
                <span v-if="cue.delay_seconds > 0" class="cue-delay">延误{{ cue.delay_seconds }}s</span>
              </div>
            </div>
            <div class="cue-status-badge">
              <el-icon v-if="cue.status === 'completed'" color="#67c23a"><CircleCheck /></el-icon>
              <el-icon v-else-if="cue.status === 'executing'" color="#409EFF"><VideoPlay /></el-icon>
              <el-icon v-else-if="cue.status === 'pending'" color="#c0c4cc"><Circle /></el-icon>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="list-view">
        <el-table 
          :data="sortedCues" 
          style="width: 100%"
          @row-click="selectCue"
          :row-class-name="getTableRowClassName"
          stripe
          highlight-current-row
        >
          <el-table-column width="50" align="center">
            <template #default="{ row }">
              <el-tag 
                :type="getCueTagType(row.status)"
                size="small"
                :effect="row.status === 'executing' ? 'dark' : 'light'"
              >
                {{ row.order }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column prop="type" label="类型" width="100">
            <template #default="{ row }">
              <div class="type-cell">
                <el-icon :color="getCueTypeColor(row.type)">
                  <component :is="getCueTypeIcon(row.type)" />
                </el-icon>
                <span>{{ getCueTypeLabel(row.type) }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="name" label="CUE名称" min-width="180">
            <template #default="{ row }">
              <div class="name-cell">
                <span class="cue-name-text">{{ row.name }}</span>
                <el-tag v-if="row.delay_seconds > 0" type="danger" size="small" effect="dark">
                  延误{{ row.delay_seconds }}s
                </el-tag>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="时间" width="160">
            <template #default="{ row }">
              <div class="time-cell">
                <span class="start-time">{{ formatTime(row.start_time) }}</span>
                <span class="duration"> ({{ formatDuration(row.duration) }})</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="status" label="状态" width="120">
            <template #default="{ row }">
              <el-tag :type="getCueTagType(row.status)" size="small">
                {{ getCueStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button 
                v-if="row.status === 'pending'"
                type="primary" 
                size="small"
                @click.stop="startCue(row)"
              >
                开始执行
              </el-button>
              <el-button 
                v-else-if="row.status === 'executing'"
                type="success" 
                size="small"
                @click.stop="completeCue(row)"
              >
                完成
              </el-button>
              <el-button 
                v-else-if="row.status === 'executing'"
                type="warning" 
                size="small"
                @click.stop="showDelayDialog(row)"
              >
                记录延误
              </el-button>
              <el-button 
                v-if="row.status === 'completed'"
                text 
                size="small"
                @click.stop="resetCue(row)"
              >
                重置
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <el-dialog
      v-model="showAddCue"
      title="添加CUE"
      width="600px"
      @closed="resetCueForm"
    >
      <el-form :model="cueForm" label-width="100px">
        <el-form-item label="CUE类型" required>
          <el-select v-model="cueForm.type" style="width: 100%">
            <el-option label="灯光" value="lighting" />
            <el-option label="音响" value="sound" />
            <el-option label="道具" value="prop" />
            <el-option label="演员" value="actor" />
          </el-select>
        </el-form-item>
        <el-form-item label="CUE名称" required>
          <el-input v-model="cueForm.name" placeholder="请输入CUE名称" />
        </el-form-item>
        <el-form-item label="开始时间">
          <el-time-select
            v-model="cueForm.startTime"
            start="00:00"
            step="00:05"
            end="01:00"
            placeholder="选择开始时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="持续时间">
          <el-input-number v-model="cueForm.duration" :min="1" :max="3600" style="width: 100%" />
          <span class="form-hint">秒</span>
        </el-form-item>
        <el-form-item label="序号">
          <el-input-number v-model="cueForm.order" :min="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="cueForm.notes"
            type="textarea"
            :rows="2"
            placeholder="请输入备注"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddCue = false">取消</el-button>
        <el-button type="primary" @click="addCue">添加</el-button>
      </template>
    </el-dialog>

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
import { v4 as uuidv4 } from 'uuid'

const props = defineProps({
  currentShowId: {
    type: String,
    default: null
  },
  selectedSceneId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['select-cue', 'refresh'])

const showStore = useShowStore()

const viewMode = ref('list')
const cues = ref([])
const selectedCueId = ref(null)
const selectedSceneName = ref('')
const showAddCue = ref(false)
const showDelay = ref(false)
const currentDelayedCue = ref(null)

const cueForm = ref({
  type: 'lighting',
  name: '',
  startTime: '00:00',
  duration: 10,
  order: 1,
  notes: ''
})

const delayForm = ref({
  seconds: 0,
  reason: ''
})

const sortedCues = computed(() => {
  return [...cues.value].sort((a, b) => {
    if (a.start_time !== b.start_time) {
      return a.start_time - b.start_time
    }
    return a.order - b.order
  })
})

const totalDuration = computed(() => {
  if (sortedCues.value.length === 0) return 0
  const maxEnd = Math.max(...sortedCues.value.map(c => c.start_time + c.duration))
  return Math.max(maxEnd, 300)
})

const timelineTicks = computed(() => {
  const ticks = []
  const interval = Math.max(30, Math.ceil(totalDuration.value / 10))
  for (let t = 0; t <= totalDuration.value; t += interval) {
    ticks.push({
      time: t,
      label: formatTime(t),
      position: (t / totalDuration.value) * 100
    })
  }
  return ticks
})

const loadCues = async () => {
  if (!props.selectedSceneId) {
    cues.value = []
    selectedSceneName.value = ''
    return
  }

  cues.value = await showStore.getCuesByScene(props.selectedSceneId)
  
  const programs = await showStore.getProgramsByShow(props.currentShowId)
  for (const prog of programs) {
    const scenes = await showStore.getScenesByProgram(prog.id)
    const scene = scenes.find(s => s.id === props.selectedSceneId)
    if (scene) {
      selectedSceneName.value = `${prog.name} > ${scene.name}`
      break
    }
  }
}

const selectCue = (cue) => {
  selectedCueId.value = cue.id
  emit('select-cue', cue.id)
}

const getCuePosition = (cue) => {
  return (cue.start_time / totalDuration.value) * 100
}

const getCueWidth = (cue) => {
  return Math.max((cue.duration / totalDuration.value) * 100, 5)
}

const getCueTypeClass = (type) => {
  const classes = {
    lighting: 'type-lighting',
    sound: 'type-sound',
    prop: 'type-prop',
    actor: 'type-actor'
  }
  return classes[type] || 'type-default'
}

const getCueTypeColor = (type) => {
  const colors = {
    lighting: '#f59e0b',
    sound: '#3b82f6',
    prop: '#10b981',
    actor: '#8b5cf6'
  }
  return colors[type] || '#606266'
}

const getCueTypeIcon = (type) => {
  const icons = {
    lighting: 'Sunny',
    sound: 'Headset',
    prop: 'Box',
    actor: 'User'
  }
  return icons[type] || 'QuestionFilled'
}

const getCueTypeLabel = (type) => {
  const labels = {
    lighting: '灯光',
    sound: '音响',
    prop: '道具',
    actor: '演员'
  }
  return labels[type] || type
}

const getCueStatusLabel = (status) => {
  const labels = {
    pending: '待执行',
    executing: '执行中',
    completed: '已完成',
    delayed: '延误'
  }
  return labels[status] || status
}

const getCueTagType = (status) => {
  const types = {
    pending: 'info',
    executing: 'primary',
    completed: 'success',
    delayed: 'danger'
  }
  return types[status] || 'info'
}

const getTableRowClassName = ({ row }) => {
  if (row.id === selectedCueId.value) return 'selected-row'
  if (row.status === 'executing') return 'executing-row'
  if (row.status === 'completed') return 'completed-row'
  return ''
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

const startCue = async (cue) => {
  await showStore.updateCueStatus(cue.id, 'executing')
  ElMessage.success(`开始执行: ${cue.name}`)
  await loadCues()
}

const completeCue = async (cue) => {
  await showStore.updateCueStatus(cue.id, 'completed')
  ElMessage.success(`已完成: ${cue.name}`)
  await loadCues()
}

const resetCue = async (cue) => {
  await showStore.updateCueStatus(cue.id, 'pending')
  ElMessage.info(`已重置: ${cue.name}`)
  await loadCues()
}

const showDelayDialog = (cue) => {
  currentDelayedCue.value = cue
  delayForm.value = {
    seconds: 0,
    reason: ''
  }
  showDelay.value = true
}

const recordDelay = async () => {
  if (currentDelayedCue.value) {
    await showStore.updateCueStatus(
      currentDelayedCue.value.id,
      'executing',
      delayForm.value.reason,
      delayForm.value.seconds
    )
    ElMessage.warning(`已记录延误: ${delayForm.value.seconds}秒`)
    showDelay.value = false
    await loadCues()
  }
}

const resetCueForm = () => {
  cueForm.value = {
    type: 'lighting',
    name: '',
    startTime: '00:00',
    duration: 10,
    order: cues.value.length + 1,
    notes: ''
  }
}

const addCue = async () => {
  if (!cueForm.value.name) {
    ElMessage.warning('请输入CUE名称')
    return
  }

  const timeParts = cueForm.value.startTime.split(':')
  const startTime = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1])

  const cueId = uuidv4()
  const newCue = {
    id: cueId,
    scene_id: props.selectedSceneId,
    type: cueForm.value.type,
    name: cueForm.value.name,
    start_time: startTime,
    duration: cueForm.value.duration,
    order: cueForm.value.order,
    status: 'pending',
    notes: cueForm.value.notes
  }

  if (!window.electronAPI) {
    cues.value.push(newCue)
    ElMessage.success('CUE添加成功')
    showAddCue.value = false
    return
  }

  await window.electronAPI.dbRun(
    'INSERT INTO cues (id, scene_id, type, name, start_time, duration, "order", status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [newCue.id, newCue.scene_id, newCue.type, newCue.name, newCue.start_time, newCue.duration, newCue.order, newCue.status, newCue.notes]
  )

  ElMessage.success('CUE添加成功')
  showAddCue.value = false
  await loadCues()
}

watch(() => props.selectedSceneId, () => {
  loadCues()
}, { immediate: true })

onMounted(() => {
  if (props.selectedSceneId) {
    loadCues()
  }
})
</script>

<style scoped>
.center-panel-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid #e4e7ed;
  background: #fff;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-center {
  flex: 1;
  text-align: center;
}

.scene-info {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  color: #409eff;
}

.empty-hint {
  color: #909399;
  font-size: 13px;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  padding: 60px 20px;
}

.empty-state h3 {
  margin: 20px 0 8px;
  color: #606266;
}

.empty-state p {
  font-size: 14px;
}

.content-area {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.timeline-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.timeline-header {
  height: 40px;
  border-bottom: 1px solid #e4e7ed;
  background: #fafafa;
  position: relative;
}

.time-ruler {
  height: 100%;
  position: relative;
  padding: 0 16px;
}

.time-tick {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  align-items: flex-end;
  padding-bottom: 4px;
}

.tick-label {
  font-size: 11px;
  color: #909399;
}

.timeline-body {
  flex: 1;
  position: relative;
  padding: 16px;
  overflow-y: auto;
  background: linear-gradient(90deg, #fafafa 1px, transparent 1px);
  background-size: 50px 100%;
}

.timeline-cue {
  position: absolute;
  height: 50px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 2px solid transparent;
}

.timeline-cue:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.timeline-cue.is-selected {
  border-color: #409eff;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.2);
}

.timeline-cue.is-pending {
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
}

.timeline-cue.is-executing {
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  animation: pulse 2s infinite;
}

.timeline-cue.is-completed {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  opacity: 0.8;
}

.timeline-cue.is-delayed {
  border-left: 4px solid #ef4444;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

.cue-type-indicator {
  width: 4px;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  border-radius: 8px 0 0 8px;
}

.cue-type-indicator.type-lighting { background: #f59e0b; }
.cue-type-indicator.type-sound { background: #3b82f6; }
.cue-type-indicator.type-prop { background: #10b981; }
.cue-type-indicator.type-actor { background: #8b5cf6; }

.cue-content {
  flex: 1;
  margin-left: 8px;
  min-width: 0;
}

.cue-name {
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cue-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #909399;
  margin-top: 2px;
}

.cue-delay {
  color: #ef4444;
}

.cue-status-badge {
  margin-left: 8px;
}

.list-view {
  flex: 1;
  overflow: auto;
}

.type-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cue-name-text {
  font-weight: 500;
}

.time-cell {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 13px;
}

.start-time {
  color: #303133;
  font-weight: 500;
}

.duration {
  color: #909399;
  font-size: 12px;
}

.form-hint {
  color: #909399;
  font-size: 12px;
  margin-left: 8px;
}

:deep(.selected-row) {
  background: rgba(64, 158, 255, 0.1) !important;
}

:deep(.executing-row) {
  background: rgba(59, 130, 246, 0.05) !important;
}

:deep(.completed-row) {
  background: rgba(16, 185, 129, 0.05) !important;
}
</style>
