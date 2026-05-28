<template>
  <div class="card">
    <h2 class="card-title">🎬 故障回放与定位分析</h2>
    
    <div v-if="!hasHistory" class="text-center text-muted py-8">
      <div class="text-4xl mb-3">📭</div>
      <p>暂无历史数据</p>
      <p class="text-sm mt-1">完成几回合配平后可在此回放分析</p>
    </div>
    
    <div v-else>
      <div class="mb-4 p-3 bg-secondary rounded-lg">
        <div class="flex justify-between items-center mb-3">
          <h4 class="font-semibold text-sm">回放控制</h4>
          <div class="flex gap-2">
            <button 
              class="btn text-xs py-1 px-3"
              :class="isPlaying ? 'btn-warning' : 'btn-primary'"
              @click="togglePlay"
            >
              {{ isPlaying ? '⏸ 暂停' : '▶ 播放' }}
            </button>
            <button 
              class="btn text-xs py-1 px-3 bg-secondary"
              @click="resetReplay"
            >
              🔄 重置
            </button>
            <button 
              class="btn text-xs py-1 px-3 bg-secondary"
              @click="jumpToFailure"
              :disabled="failurePoints.length === 0"
            >
              🎯 跳转到故障点
            </button>
          </div>
        </div>
        
        <div class="flex items-center gap-3 mb-3">
          <span class="text-xs text-muted w-12">速度:</span>
          <div class="flex gap-1">
            <button 
              v-for="speed in speeds" 
              :key="speed.value"
              class="text-xs px-2 py-1 rounded"
              :class="currentSpeed === speed.value ? 'bg-blue-600 text-white' : 'bg-primary text-muted'"
              @click="setSpeed(speed.value)"
            >
              {{ speed.label }}
            </button>
          </div>
        </div>
        
        <div class="slider-container">
          <span class="text-xs text-muted w-8">回合</span>
          <input 
            type="range" 
            :min="0" 
            :max="history.length - 1" 
            v-model.number="replayTurn"
            @input="onSliderChange"
          />
          <span class="text-xs font-mono w-16 text-right">
            {{ replayTurn }} / {{ history.length - 1 }}
          </span>
        </div>
      </div>
      
      <div v-if="failurePoints.length > 0" class="mb-4">
        <h4 class="text-sm text-muted mb-2">⚠️ 关键事件标记 (点击跳转)</h4>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="(point, idx) in failurePoints"
            :key="idx"
            class="text-xs px-3 py-2 rounded border transition-colors"
            :class="point.status === 'critical' ? 'bg-red-900/30 border-red-500 text-red-400 hover:bg-red-900/50' : 'bg-yellow-900/30 border-yellow-500 text-yellow-400 hover:bg-yellow-900/50'"
            @click="goToTurn(point.turn)"
          >
            <span class="font-semibold">回合 {{ point.turn }}</span>
            <span class="text-xs ml-2 opacity-75">- {{ point.status === 'critical' ? '电量危急' : '负载断电' }}</span>
          </button>
        </div>
      </div>
      
      <div v-if="currentState" class="grid grid-3 gap-3 mb-4">
        <div class="bg-secondary p-3 rounded">
          <div class="text-xs text-muted mb-1">太阳角度</div>
          <div class="font-bold text-lg">{{ currentState.sunAngle.toFixed(0) }}°</div>
          <div class="text-xs mt-1" :class="getSunAngleClass()">
            {{ getSunAngleDescription() }}
          </div>
        </div>
        <div class="bg-secondary p-3 rounded">
          <div class="text-xs text-muted mb-1">电池电量</div>
          <div class="font-bold text-lg">
            {{ (getBatteryPercent() * 100).toFixed(0) }}%
          </div>
          <div class="progress-bar mt-2">
            <div 
              class="progress-fill"
              :class="getBatteryClass()"
              :style="{ width: (getBatteryPercent() * 100) + '%' }"
            ></div>
          </div>
        </div>
        <div class="bg-secondary p-3 rounded">
          <div class="text-xs text-muted mb-1">断电负载</div>
          <div class="font-bold text-lg" :class="getShedLoadsCount() > 0 ? 'text-danger' : 'text-success'">
            {{ getShedLoadsCount() }}
          </div>
          <div class="text-xs mt-1 text-muted">
            {{ getShedLoadsCount() > 0 ? '负载被切断' : '全部供电' }}
          </div>
        </div>
      </div>
      
      <div v-if="currentState && currentState.ledgerSnapshot" class="mb-4">
        <h4 class="text-sm text-muted mb-2">📊 回合 {{ replayTurn }} 能源数据</h4>
        <div class="grid grid-4 gap-2 text-xs">
          <div class="bg-secondary p-2 rounded">
            <div class="text-muted">太阳能输出</div>
            <div class="font-semibold text-success">
              {{ currentState.ledgerSnapshot.solarOutput?.toFixed(1) || 0 }} kW
            </div>
          </div>
          <div class="bg-secondary p-2 rounded">
            <div class="text-muted">负载需求</div>
            <div class="font-semibold text-warning">
              {{ currentState.ledgerSnapshot.totalLoadDemand?.toFixed(1) || 0 }} kW
            </div>
          </div>
          <div class="bg-secondary p-2 rounded">
            <div class="text-muted">电量变化</div>
            <div class="font-semibold" :class="(currentState.ledgerSnapshot.batteryDelta || 0) >= 0 ? 'text-success' : 'text-danger'">
              {{ (currentState.ledgerSnapshot.batteryDelta || 0) >= 0 ? '+' : '' }}{{ currentState.ledgerSnapshot.batteryDelta?.toFixed(1) || 0 }} kWh
            </div>
          </div>
          <div class="bg-secondary p-2 rounded">
            <div class="text-muted">系统状态</div>
            <div class="font-semibold">
              <span class="status-badge text-xs" :class="'status-' + currentState.ledgerSnapshot.status">
                {{ getStatusText(currentState.ledgerSnapshot.status) }}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div v-if="currentState && currentState.ledgerSnapshot?.loadsShed?.length > 0" class="mb-4">
        <h4 class="text-sm text-muted mb-2">⚡ 本回合断电负载</h4>
        <div class="space-y-1">
          <div 
            v-for="load in currentState.ledgerSnapshot.loadsShed" 
            :key="load.id"
            class="flex items-center gap-2 p-2 bg-red-900/20 rounded border-l-2 border-red-500"
          >
            <span class="text-danger">⚠️</span>
            <span class="text-sm">{{ load.name }}</span>
            <span class="text-xs text-muted ml-auto">
              优先级 {{ load.priority }} · {{ load.demand }} kW
            </span>
          </div>
        </div>
      </div>
      
      <div class="p-3 bg-secondary rounded-lg">
        <h4 class="text-sm font-semibold mb-2">🔍 故障分析提示</h4>
        <ul class="text-xs text-muted space-y-1">
          <li>• 拖动滑块查看历史各回合状态</li>
          <li>• 点击"跳转到故障点"直接定位到关键事件</li>
          <li>• 红色标记表示电量危急或关键负载断电</li>
          <li>• 对比太阳角度和负载变化，分析因果关系</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'

const props = defineProps({
  history: {
    type: Array,
    default: () => []
  },
  failurePoints: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['replay-step', 'replay-complete'])

const isPlaying = ref(false)
const replayTurn = ref(0)
const currentSpeed = ref(1000)
const playInterval = ref(null)

const speeds = [
  { label: '0.5x', value: 2000 },
  { label: '1x', value: 1000 },
  { label: '2x', value: 500 },
  { label: '4x', value: 250 }
]

const hasHistory = computed(() => props.history.length > 0)

const currentState = computed(() => {
  if (replayTurn.value < props.history.length) {
    return props.history[replayTurn.value]
  }
  return null
})

function togglePlay() {
  if (isPlaying.value) {
    stopPlayback()
  } else {
    startPlayback()
  }
}

function startPlayback() {
  if (replayTurn.value >= props.history.length - 1) {
    replayTurn.value = 0
  }
  
  isPlaying.value = true
  playNextFrame()
}

function playNextFrame() {
  if (!isPlaying.value) return
  
  emit('replay-step', currentState.value, replayTurn.value)
  
  if (replayTurn.value < props.history.length - 1) {
    replayTurn.value++
    playInterval.value = setTimeout(playNextFrame, currentSpeed.value)
  } else {
    stopPlayback()
    emit('replay-complete')
  }
}

function stopPlayback() {
  isPlaying.value = false
  if (playInterval.value) {
    clearTimeout(playInterval.value)
    playInterval.value = null
  }
}

function resetReplay() {
  stopPlayback()
  replayTurn.value = 0
  emit('replay-step', currentState.value, 0)
}

function setSpeed(speed) {
  currentSpeed.value = speed
  if (isPlaying.value) {
    stopPlayback()
    startPlayback()
  }
}

function onSliderChange() {
  stopPlayback()
  emit('replay-step', currentState.value, replayTurn.value)
}

function goToTurn(turn) {
  stopPlayback()
  replayTurn.value = turn
  emit('replay-step', currentState.value, turn)
}

function jumpToFailure() {
  if (props.failurePoints.length > 0) {
    goToTurn(props.failurePoints[0].turn)
  }
}

function getSunAngleClass() {
  if (!currentState.value) return 'text-muted'
  const angle = currentState.value.sunAngle
  if (angle < 0) return 'text-muted'
  if (angle < 30) return 'text-warning'
  return 'text-success'
}

function getSunAngleDescription() {
  if (!currentState.value) return ''
  const angle = currentState.value.sunAngle
  if (angle < 0) return '🌙 阴影区'
  if (angle < 30) return '🌅 弱日照'
  if (angle < 70) return '☀️ 正常日照'
  return '🌟 日照峰值'
}

function getBatteryPercent() {
  if (!currentState.value?.modules) return 0
  
  let totalCharge = 0
  let totalCapacity = 0
  
  for (const module of currentState.value.modules) {
    for (const battery of module.batteries) {
      totalCharge += battery.currentCharge
      totalCapacity += battery.capacity * (1 - battery.damageLevel * 0.4)
    }
  }
  
  return totalCapacity > 0 ? totalCharge / totalCapacity : 0
}

function getBatteryClass() {
  const percent = getBatteryPercent()
  if (percent < 0.15) return 'progress-fill-danger'
  if (percent < 0.4) return 'progress-fill-warning'
  return 'progress-fill-success'
}

function getShedLoadsCount() {
  return currentState.value?.ledgerSnapshot?.loadsShed?.length || 0
}

function getStatusText(status) {
  const texts = {
    normal: '正常',
    warning: '警告',
    danger: '危险',
    critical: '危急',
    failed: '失败'
  }
  return texts[status] || status
}

watch(() => props.history, (newHistory) => {
  if (newHistory.length > 0 && replayTurn.value >= newHistory.length) {
    replayTurn.value = newHistory.length - 1
  }
})

onUnmounted(() => {
  stopPlayback()
})
</script>
