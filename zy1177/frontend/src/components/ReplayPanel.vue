<template>
  <div class="panel-container">
    <div class="section">
      <h3>🎬 选择回放批次</h3>
      
      <el-select 
        v-model="selectedBatchId" 
        placeholder="选择调度批次"
        style="width: 100%;"
        @change="handleBatchChange"
        clearable
      >
        <el-option
          v-for="batch in availableBatches"
          :key="batch.id"
          :label="`${batch.name} (${batch.algorithm})`"
          :value="batch.id"
        />
      </el-select>
      
      <el-button 
        type="primary" 
        @click="loadFrames"
        :loading="isLoading"
        style="width: 100%; margin-top: 10px;"
      >
        加载回放帧
      </el-button>
    </div>
    
    <el-divider v-if="framesLoaded" />
    
    <div v-if="framesLoaded" class="section">
      <h3>⏯️ 播放控制</h3>
      
      <div class="player-controls">
        <div class="play-buttons">
          <el-button-group>
            <el-button @click="handleSeekToStart">
              <el-icon><Back /></el-icon>
            </el-button>
            <el-button @click="handleBackward">
              <el-icon><ArrowLeft /></el-icon>
            </el-button>
            <el-button 
              :type="isPlaying ? 'warning' : 'success'"
              @click="togglePlay"
            >
              <el-icon v-if="!isPlaying"><VideoPlay /></el-icon>
              <el-icon v-else><VideoPause /></el-icon>
            </el-button>
            <el-button @click="handleForward">
              <el-icon><ArrowRight /></el-icon>
            </el-button>
            <el-button @click="handleSeekToEnd">
              <el-icon><Right /></el-icon>
            </el-button>
          </el-button-group>
        </div>
        
        <div class="speed-control" style="margin-top: 10px;">
          <span style="margin-right: 10px;">播放速度:</span>
          <el-radio-group v-model="playSpeed" size="small">
            <el-radio-button :value="0.5">0.5x</el-radio-button>
            <el-radio-button :value="1">1x</el-radio-button>
            <el-radio-button :value="2">2x</el-radio-button>
            <el-radio-button :value="4">4x</el-radio-button>
          </el-radio-group>
        </div>
      </div>
      
      <div class="progress-control" style="margin-top: 15px;">
        <el-slider
          v-model="currentFrameIndex"
          :min="0"
          :max="totalFrames - 1"
          :show-tooltip="false"
          @change="handleSliderChange"
        >
          <template #default="{ value }">
            <div class="custom-slider">
              <span>{{ value + 1 }} / {{ totalFrames }}</span>
            </div>
          </template>
        </el-slider>
      </div>
    </div>
    
    <el-divider v-if="framesLoaded" />
    
    <div v-if="framesLoaded" class="section">
      <h3>📈 当前状态</h3>
      
      <el-descriptions :column="1" border size="small">
        <el-descriptions-item label="总帧数">
          {{ totalFrames }}
        </el-descriptions-item>
        <el-descriptions-item label="当前帧">
          {{ currentFrameIndex + 1 }}
        </el-descriptions-item>
        <el-descriptions-item label="机器人数量">
          {{ currentRobotCount }}
        </el-descriptions-item>
      </el-descriptions>
      
      <el-table 
        v-if="currentRobots.length > 0"
        :data="currentRobots" 
        size="small"
        style="width: 100%; margin-top: 10px;"
        max-height="150"
      >
        <el-table-column prop="robot_id" label="ID" width="80" />
        <el-table-column prop="state" label="状态" width="80">
          <template #default="{ row }">
            <el-tag 
              :type="getStateType(row.state)" 
              size="small"
            >
              {{ row.state }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="battery_level" label="电量" width="80">
          <template #default="{ row }">
            <el-progress 
              :percentage="Math.round(row.battery_level)"
              :color="getBatteryColor(row.battery_level)"
              :stroke-width="10"
            />
          </template>
        </el-table-column>
      </el-table>
    </div>
    
    <el-divider />
    
    <div class="section">
      <h3>📋 风险警告</h3>
      
      <el-alert
        v-if="!hasRisks"
        title="当前无风险"
        type="success"
        :closable="false"
        show-icon
      />
      
      <div v-else>
        <el-alert
          v-for="(risk, index) in currentRisks.slice(0, 3)"
          :key="index"
          :title="risk.type"
          :type="getRiskType(risk.level)"
          show-icon
          :closable="false"
          style="margin-bottom: 10px;"
        >
          <template #default>
            {{ risk.description }}
          </template>
        </el-alert>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  Back, Right, ArrowLeft, ArrowRight, 
  VideoPlay, VideoPause 
} from '@element-plus/icons-vue'
import api from '../services/api'

const emit = defineEmits(['frames-loaded', 'play', 'pause', 'seek'])

const selectedBatchId = ref(null)
const availableBatches = ref([])
const frames = ref([])
const isLoading = ref(false)
const framesLoaded = ref(false)

const isPlaying = ref(false)
const playSpeed = ref(1)
const currentFrameIndex = ref(0)
const playInterval = ref(null)

const totalFrames = computed(() => frames.value.length)

const currentRobots = computed(() => {
  if (frames.value.length === 0 || currentFrameIndex.value >= frames.value.length) {
    return []
  }
  return frames.value[currentFrameIndex.value].robots || []
})

const currentRobotCount = computed(() => currentRobots.value.length)

const hasRisks = computed(() => false)
const currentRisks = computed(() => [])

const getStateType = (state) => {
  const typeMap = {
    'idle': 'info',
    'moving': 'primary',
    'charging': 'success',
    'loading': 'warning',
    'unloading': 'warning',
    'waiting': '',
    'fault': 'danger'
  }
  return typeMap[state] || 'info'
}

const getBatteryColor = (level) => {
  if (level > 60) return '#67c23a'
  if (level > 30) return '#e6a23c'
  return '#f56c6c'
}

const getRiskType = (level) => {
  const typeMap = {
    'critical': 'error',
    'high': 'error',
    'medium': 'warning',
    'low': 'info'
  }
  return typeMap[level] || 'info'
}

const loadBatches = async () => {
  try {
    const result = await api.getBatches()
    availableBatches.value = result.batches || []
  } catch (e) {
    console.error('Failed to load batches:', e)
  }
}

const handleBatchChange = () => {
  frames.value = []
  framesLoaded.value = false
  currentFrameIndex.value = 0
  stopPlayback()
}

const loadFrames = async () => {
  if (!selectedBatchId.value) {
    ElMessage.warning('请先选择批次')
    return
  }
  
  isLoading.value = true
  
  try {
    const result = await api.getFrames(selectedBatchId.value)
    frames.value = result.frames || []
    
    if (frames.value.length > 0) {
      framesLoaded.value = true
      currentFrameIndex.value = 0
      emit('frames-loaded', frames.value)
      ElMessage.success(`已加载 ${frames.value.length} 帧`)
    } else {
      ElMessage.warning('该批次没有回放帧，请先生成')
    }
  } catch (e) {
    ElMessage.error('加载失败: ' + e.message)
  } finally {
    isLoading.value = false
  }
}

const togglePlay = () => {
  if (isPlaying.value) {
    stopPlayback()
    emit('pause')
  } else {
    startPlayback()
    emit('play')
  }
}

const startPlayback = () => {
  if (frames.value.length === 0) return
  
  isPlaying.value = true
  
  if (playInterval.value) {
    clearInterval(playInterval.value)
  }
  
  const intervalMs = Math.round(100 / playSpeed.value)
  
  playInterval.value = setInterval(() => {
    if (currentFrameIndex.value < frames.value.length - 1) {
      currentFrameIndex.value++
      emit('seek', currentFrameIndex.value)
    } else {
      stopPlayback()
      emit('pause')
    }
  }, intervalMs)
}

const stopPlayback = () => {
  isPlaying.value = false
  if (playInterval.value) {
    clearInterval(playInterval.value)
    playInterval.value = null
  }
}

const handleSliderChange = (value) => {
  currentFrameIndex.value = value
  emit('seek', value)
}

const handleSeekToStart = () => {
  currentFrameIndex.value = 0
  emit('seek', 0)
}

const handleSeekToEnd = () => {
  if (frames.value.length > 0) {
    currentFrameIndex.value = frames.value.length - 1
    emit('seek', currentFrameIndex.value)
  }
}

const handleForward = () => {
  if (currentFrameIndex.value < frames.value.length - 1) {
    currentFrameIndex.value++
    emit('seek', currentFrameIndex.value)
  }
}

const handleBackward = () => {
  if (currentFrameIndex.value > 0) {
    currentFrameIndex.value--
    emit('seek', currentFrameIndex.value)
  }
}

watch(playSpeed, () => {
  if (isPlaying.value) {
    stopPlayback()
    startPlayback()
  }
})

loadBatches()
</script>

<style scoped>
.panel-container {
  padding: 5px;
}

.section {
  margin-bottom: 15px;
}

.section h3 {
  font-size: 14px;
  color: #303133;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.player-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.play-buttons {
  display: flex;
  justify-content: center;
}

.speed-control {
  display: flex;
  align-items: center;
}

.custom-slider {
  display: flex;
  justify-content: center;
  font-size: 12px;
  color: #606266;
}
</style>
