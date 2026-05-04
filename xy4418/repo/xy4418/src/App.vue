<template>
  <div class="game-container">
    <!-- 开始界面 -->
    <div v-if="gamePhase === 'start'" class="start-screen">
      <div class="start-content">
        <h1 class="start-title">❄️ 夜间雪道搜救</h1>
        <p class="start-subtitle">
          滑雪场闭园后，游客迷路在雪道中。<br>
          调度雪地车和无人机，在时间耗尽前找到并营救所有游客！<br>
          小心低温、雪崩风险区和电量不足。
        </p>
        
        <div class="level-select">
          <div class="section-title" style="color: rgba(255,255,255,0.8); margin-bottom: 16px;">选择关卡</div>
          <div class="level-cards">
            <div 
              v-for="level in levels" 
              :key="level.id"
              :class="['level-card', { selected: selectedLevel?.id === level.id }]"
              @click="selectedLevel = level"
            >
              <div class="level-name">{{ level.name }}</div>
              <span :class="['level-difficulty', getDifficultyClass(level.difficulty)]">
                {{ getDifficultyLabel(level.difficulty) }}
              </span>
              <p class="level-desc">{{ level.description }}</p>
            </div>
          </div>
        </div>
        
        <div class="start-buttons">
          <button 
            class="start-btn primary" 
            :disabled="!selectedLevel"
            @click="startNewGame"
          >
            开始新游戏
          </button>
          <button 
            class="start-btn secondary"
            :disabled="!hasSavedGame"
            @click="continueGame"
          >
            继续最近一局
          </button>
        </div>
      </div>
    </div>

    <!-- 游戏主界面 -->
    <div v-if="gamePhase === 'playing' && gameState">
      <!-- 顶部状态栏 -->
      <header class="game-header">
        <div class="game-title">
          <span class="logo">❄️</span>
          <span>{{ gameState.levelName }}</span>
        </div>
        
        <div class="header-stats">
          <div class="stat-item">
            <span class="stat-label">游戏时间</span>
            <span :class="['stat-value', { warning: timePercent > 80 }]">
              {{ formatTime(gameState.currentTime) }} / {{ formatTime(gameState.timeLimit) }}
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label">已营救</span>
            <span class="stat-value">
              {{ gameState.tourists.filter(t => t.rescued).length }} / {{ gameState.tourists.length }}
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label">得分</span>
            <span class="stat-value">{{ gameState.score }}</span>
          </div>
        </div>
      </header>

      <div class="game-body">
        <!-- 左侧控制面板 -->
        <aside class="game-sidebar">
          <!-- 单位列表 -->
          <div class="sidebar-section">
            <div class="section-title">📋 调度单位</div>
            <div v-for="unit in gameState.units" :key="unit.id">
              <div 
                :class="['unit-card', { 
                  selected: selectedUnit?.id === unit.id,
                  disabled: unit.battery <= 0
                }]"
                @click="selectUnit(unit)"
              >
                <div :class="['unit-icon', unit.type]">
                  {{ unit.type === 'snowmobile' ? '🚜' : '🛸' }}
                </div>
                <div class="unit-info">
                  <div class="unit-name">
                    {{ unit.type === 'snowmobile' ? '雪地车' : '无人机' }}
                    {{ unit.id.split('-')[1] }}
                  </div>
                  <div class="unit-status">
                    {{ getUnitStatusLabel(unit.status) }}
                  </div>
                  <div class="unit-battery">
                    <div class="battery-bar">
                      <div 
                        :class="['battery-fill', getBatteryClass(unit.battery)]"
                        :style="{ width: `${unit.battery}%` }"
                      ></div>
                    </div>
                    <span class="battery-text">{{ Math.round(unit.battery) }}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 游客状态 -->
          <div class="sidebar-section">
            <div class="section-title">👥 游客状态</div>
            <div v-for="(tourist, index) in gameState.tourists" :key="tourist.id">
              <div class="tourist-card">
                <div class="tourist-header">
                  <span style="color: white; font-weight: 600;">游客 {{ index + 1 }}</span>
                  <span :class="['tourist-status', tourist.rescued ? 'rescued' : tourist.found ? 'found' : 'lost']">
                    {{ tourist.rescued ? '已营救' : tourist.found ? '已发现' : '失踪' }}
                  </span>
                </div>
                <div class="tourist-temperature">
                  <span class="temp-label">体温:</span>
                  <span :class="['temp-value', { critical: tourist.temperature < 34 }]">
                    {{ tourist.temperature.toFixed(1) }}°C
                  </span>
                </div>
                <template v-if="tourist.found && !tourist.rescued">
                  <el-button 
                    v-if="gameState.hotDrinks > 0"
                    size="small" 
                    type="warning" 
                    style="margin-top: 8px; width: 100%;"
                    @click="provideHotDrink(tourist.id)"
                  >
                    ☕ 提供热饮 (剩余{{ gameState.hotDrinks }})
                  </el-button>
                  <el-button 
                    v-else
                    size="small" 
                    type="warning" 
                    style="margin-top: 8px; width: 100%;"
                    disabled
                  >
                    ☕ 热饮已耗尽
                  </el-button>
                </template>
              </div>
            </div>
          </div>

          <!-- 资源面板 -->
          <div class="sidebar-section">
            <div class="section-title">📦 资源</div>
            <div class="resource-item">
              <div class="resource-info">
                <span class="resource-icon">🚜</span>
                <span class="resource-name">雪地车</span>
              </div>
              <span class="resource-count">{{ gameState.units.filter(u => u.type === 'snowmobile').length }}</span>
            </div>
            <div class="resource-item">
              <div class="resource-info">
                <span class="resource-icon">🛸</span>
                <span class="resource-name">无人机</span>
              </div>
              <span class="resource-count">{{ gameState.units.filter(u => u.type === 'drone').length }}</span>
            </div>
            <div class="resource-item">
              <div class="resource-info">
                <span class="resource-icon">☕</span>
                <span class="resource-name">热饮补给</span>
              </div>
              <span class="resource-count">{{ gameState.hotDrinks }}</span>
            </div>
          </div>

          <!-- 事件日志 -->
          <div class="sidebar-section">
            <div class="section-title">📝 事件日志</div>
            <div class="event-log">
              <div 
                v-if="gameState.events.length === 0"
                style="color: rgba(255,255,255,0.4); font-size: 0.875rem; text-align: center; padding: 16px;"
              >
                暂无事件
              </div>
              <div 
                v-for="event in recentEvents" 
                :key="event.id"
                :class="['event-item', getEventClass(event.type)]"
              >
                <div class="event-time">{{ formatEventTime(event.timestamp) }}</div>
                <div>{{ getEventMessage(event) }}</div>
              </div>
            </div>
          </div>
        </aside>

        <!-- 地图区域 -->
        <main class="game-map-container">
          <!-- 地图控制按钮 -->
          <div class="map-controls">
            <button class="map-control-btn" @click="zoomIn">➕</button>
            <button class="map-control-btn" @click="zoomOut">➖</button>
            <button class="map-control-btn" @click="resetView">🔄</button>
          </div>

          <!-- 游戏地图 -->
          <div 
            ref="mapContainer"
            class="game-map"
            @mousedown="onMapMouseDown"
            @mousemove="onMapMouseMove"
            @mouseup="onMapMouseUp"
            @mouseleave="onMapMouseUp"
            @wheel="onMapWheel"
          >
            <canvas 
              ref="mapCanvas"
              class="map-canvas"
            ></canvas>
            
            <!-- 提示文字 -->
            <div 
              v-if="!selectedUnit" 
              class="hint-text"
            >
              在左侧选择一个单位，然后点击地图设置移动目标
            </div>
          </div>

          <!-- 底部操作栏 -->
          <div class="action-panel">
            <div class="time-controls">
              <button class="action-btn secondary" @click="togglePause">
                {{ isPaused ? '▶️ 继续' : '⏸️ 暂停' }}
              </button>
              <span :class="['time-display', { warning: timePercent > 80 }]">
                {{ formatTime(gameState.currentTime) }}
              </span>
              <button class="action-btn secondary" @click="setSpeed(1)" :style="{ background: gameSpeed === 1 ? 'rgba(78, 205, 196, 0.3)' : '' }">1x</button>
              <button class="action-btn secondary" @click="setSpeed(2)" :style="{ background: gameSpeed === 2 ? 'rgba(78, 205, 196, 0.3)' : '' }">2x</button>
              <button class="action-btn secondary" @click="setSpeed(4)" :style="{ background: gameSpeed === 4 ? 'rgba(78, 205, 196, 0.3)' : '' }">4x</button>
            </div>
            
            <button 
              class="action-btn primary" 
              :disabled="!selectedUnit || selectedUnit.status === 'moving'"
              @click="clearPath"
            >
              🗑️ 清除路线
            </button>
            
            <button class="action-btn secondary" @click="exportReport">
              📄 导出简报
            </button>
            
            <button class="action-btn secondary" @click="exportLogs">
              📋 导出日志
            </button>
          </div>
        </main>
      </div>
    </div>

    <!-- 结束界面 -->
    <div v-if="gamePhase === 'ended'" class="end-screen">
      <div class="end-content">
        <h1 :class="['end-title', gameState.status === 'won' ? 'won' : 'lost']">
          {{ gameState.status === 'won' ? '🎉 任务成功！' : '❌ 任务失败' }}
        </h1>
        <p class="end-message">
          {{ gameState.status === 'won' 
            ? '所有游客已成功营救！干得漂亮！' 
            : getFailReason() }}
        </p>
        
        <div class="end-stats">
          <div class="end-stat">
            <div class="end-stat-label">游戏时长</div>
            <div class="end-stat-value">{{ formatTime(gameState.currentTime) }}</div>
          </div>
          <div class="end-stat">
            <div class="end-stat-label">已营救</div>
            <div class="end-stat-value">
              {{ gameState.tourists.filter(t => t.rescued).length }}/{{ gameState.tourists.length }}
            </div>
          </div>
          <div class="end-stat">
            <div class="end-stat-label">最终得分</div>
            <div class="end-stat-value">{{ gameState.score }}</div>
          </div>
        </div>
        
        <div class="end-buttons">
          <button class="action-btn primary" @click="exportReport">
            📄 导出简报
          </button>
          <button class="action-btn secondary" @click="exportLogs">
            📋 导出日志
          </button>
          <button class="action-btn secondary" @click="backToStart">
            🏠 返回主菜单
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// 游戏状态
const gamePhase = ref('start') // start, playing, ended
const levels = ref([])
const selectedLevel = ref(null)
const hasSavedGame = ref(false)
const gameState = ref(null)
const selectedUnit = ref(null)
const isPaused = ref(false)
const gameSpeed = ref(1)

// 地图相关
const mapContainer = ref(null)
const mapCanvas = ref(null)
const ctx = ref(null)
const mapOffset = ref({ x: 0, y: 0 })
const mapScale = ref(1)
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const previewPath = ref([])

// 游戏循环
let gameLoop = null
let lastUpdateTime = null

// 计算属性
const timePercent = computed(() => {
  if (!gameState.value) return 0
  return (gameState.value.currentTime / gameState.value.timeLimit) * 100
})

const recentEvents = computed(() => {
  if (!gameState.value) return []
  return [...gameState.value.events].reverse().slice(0, 20)
})

// 工具函数
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const formatEventTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `[${mins}:${secs.toString().padStart(2, '0')}]`
}

const getDifficultyLabel = (difficulty) => {
  const labels = { 1: '简单', 2: '中等', 3: '困难' }
  return labels[difficulty] || '未知'
}

const getDifficultyClass = (difficulty) => {
  const classes = { 1: 'easy', 2: 'medium', 3: 'hard' }
  return classes[difficulty] || ''
}

const getUnitStatusLabel = (status) => {
  const labels = { idle: '待命', moving: '移动中' }
  return labels[status] || '未知'
}

const getBatteryClass = (battery) => {
  if (battery > 60) return 'high'
  if (battery > 30) return 'medium'
  return 'low'
}

const getEventClass = (type) => {
  if (['game_lost', 'avalanche_occurred'].includes(type)) return 'danger'
  if (['tourist_found'].includes(type)) return 'warning'
  if (['tourist_rescued', 'game_won'].includes(type)) return 'success'
  return 'info'
}

const getEventMessage = (event) => {
  switch (event.type) {
    case 'unit_move':
      return `${event.unitType === 'snowmobile' ? '雪地车' : '无人机'} 开始移动`
    case 'tourist_found':
      return `发现游客在位置 (${event.position.x}, ${event.position.y})`
    case 'tourist_rescued':
      return `成功营救游客！`
    case 'hot_drink_provided':
      return `提供热饮，体温恢复至 ${event.newTemperature.toFixed(1)}°C`
    case 'avalanche_occurred':
      return `⚠️ 雪崩发生！游客被困`
    case 'game_won':
      return `🎉 任务成功！`
    case 'game_lost':
      return `❌ 任务失败：${event.reason === 'time_limit' ? '时间耗尽' : '游客体温过低'}`
    default:
      return event.type
  }
}

const getFailReason = () => {
  const lastEvent = gameState.value?.events?.find(e => e.type === 'game_lost')
  if (lastEvent?.reason === 'time_limit') {
    return '时间耗尽，未能营救所有游客。'
  }
  return '游客体温过低，未能及时营救。'
}

// API 调用
const fetchLevels = async () => {
  try {
    const response = await fetch('/api/levels')
    levels.value = await response.json()
    if (levels.value.length > 0) {
      selectedLevel.value = levels.value[0]
    }
  } catch (error) {
    console.error('获取关卡失败:', error)
  }
}

const checkSavedGame = async () => {
  try {
    const response = await fetch('/api/games/current')
    if (response.ok) {
      hasSavedGame.value = true
    }
  } catch (error) {
    hasSavedGame.value = false
  }
}

const startNewGame = async () => {
  if (!selectedLevel.value) return
  
  try {
    const response = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ levelId: selectedLevel.value.id })
    })
    
    gameState.value = await response.json()
    gamePhase.value = 'playing'
    isPaused.value = false
    selectedUnit.value = null
    previewPath.value = []
    
    await nextTick()
    initCanvas()
    startGameLoop()
    
    ElMessage.success('游戏开始！')
  } catch (error) {
    ElMessage.error('启动游戏失败')
    console.error(error)
  }
}

const continueGame = async () => {
  try {
    const response = await fetch('/api/games/current')
    
    if (response.ok) {
      gameState.value = await response.json()
      gamePhase.value = gameState.value.status === 'active' ? 'playing' : 'ended'
      isPaused.value = true
      selectedUnit.value = null
      previewPath.value = []
      
      await nextTick()
      initCanvas()
      
      if (gamePhase.value === 'playing') {
        startGameLoop()
      }
      
      ElMessage.success('已继续上一局游戏')
    }
  } catch (error) {
    ElMessage.error('继续游戏失败')
    console.error(error)
  }
}

const sendAction = async (action, payload) => {
  if (!gameState.value) return
  
  try {
    const response = await fetch(`/api/games/${gameState.value.id}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload })
    })
    
    const result = await response.json()
    gameState.value = result.gameState
    
    if (gameState.value.status !== 'active') {
      gamePhase.value = 'ended'
      stopGameLoop()
    }
    
    return result
  } catch (error) {
    console.error('发送行动失败:', error)
  }
}

const selectUnit = (unit) => {
  if (unit.battery <= 0) {
    ElMessage.warning('该单位电量耗尽')
    return
  }
  selectedUnit.value = selectedUnit.value?.id === unit.id ? null : unit
  previewPath.value = []
}

const clearPath = () => {
  previewPath.value = []
}

const provideHotDrink = async (touristId) => {
  await sendAction('PROVIDE_HOT_DRINK', { touristId })
  ElMessage.success('已提供热饮')
}

// 地图交互
const initCanvas = () => {
  const canvas = mapCanvas.value
  const container = mapContainer.value
  
  if (!canvas || !container) return
  
  canvas.width = container.clientWidth
  canvas.height = container.clientHeight
  ctx.value = canvas.getContext('2d')
  
  mapOffset.value = { x: canvas.width / 2, y: canvas.height / 2 }
  mapScale.value = 1
  
  renderMap()
}

const renderMap = () => {
  const canvas = mapCanvas.value
  const context = ctx.value
  
  if (!canvas || !context || !gameState.value) return
  
  context.clearRect(0, 0, canvas.width, canvas.height)
  
  const tileSize = 32 * mapScale.value
  const map = gameState.value.map
  
  context.save()
  context.translate(mapOffset.value.x, mapOffset.value.y)
  
  const tiles = map.tiles || []
  tiles.forEach((row, y) => {
    row.forEach((tile, x) => {
      const screenX = (x - map.width / 2) * tileSize
      const screenY = (y - map.height / 2) * tileSize
      
      if (screenX + tileSize < -canvas.width / 2 || 
          screenX > canvas.width / 2 ||
          screenY + tileSize < -canvas.height / 2 ||
          screenY > canvas.height / 2) {
        return
      }
      
      if (tile.visible || tile.explored) {
        const alpha = tile.visible ? 1 : 0.5
        
        switch (tile.terrain) {
          case 'forest':
            context.fillStyle = `rgba(34, 139, 34, ${alpha})`
            break
          case 'rock':
            context.fillStyle = `rgba(105, 105, 105, ${alpha})`
            break
          case 'trail':
            context.fillStyle = `rgba(200, 200, 220, ${alpha})`
            break
          default:
            context.fillStyle = `rgba(230, 240, 255, ${alpha})`
        }
        
        context.fillRect(screenX, screenY, tileSize - 1, tileSize - 1)
        
        if (tile.terrain === 'forest') {
          context.fillStyle = `rgba(0, 100, 0, ${alpha * 0.7})`
          context.beginPath()
          context.arc(screenX + tileSize / 2, screenY + tileSize / 2, tileSize / 4, 0, Math.PI * 2)
          context.fill()
        }
      } else {
        context.fillStyle = 'rgba(20, 20, 40, 0.95)'
        context.fillRect(screenX, screenY, tileSize - 1, tileSize - 1)
      }
    })
  })
  
  gameState.value.hazards.forEach(hazard => {
    if (hazard.type === 'avalanche') {
      const x = (hazard.area.x - map.width / 2) * tileSize
      const y = (hazard.area.y - map.height / 2) * tileSize
      const width = hazard.area.width * tileSize
      const height = hazard.area.height * tileSize
      
      context.fillStyle = 'rgba(255, 100, 100, 0.3)'
      context.strokeStyle = 'rgba(255, 100, 100, 0.6)'
      context.lineWidth = 2
      context.setLineDash([5, 5])
      context.fillRect(x, y, width, height)
      context.strokeRect(x, y, width, height)
      context.setLineDash([])
      
      context.fillStyle = 'rgba(255, 100, 100, 0.8)'
      context.font = '14px sans-serif'
      context.fillText('⚠️ 雪崩风险', x + 5, y + 18)
    }
  })
  
  gameState.value.tourists.forEach(tourist => {
    if (tourist.found || tourist.rescued) {
      const x = (tourist.position.x - map.width / 2) * tileSize + tileSize / 2
      const y = (tourist.position.y - map.height / 2) * tileSize + tileSize / 2
      
      context.beginPath()
      context.arc(x, y, tileSize / 2.5, 0, Math.PI * 2)
      context.fillStyle = tourist.rescued ? 'rgba(78, 205, 196, 0.8)' : 'rgba(255, 230, 109, 0.8)'
      context.fill()
      context.strokeStyle = tourist.rescued ? '#4ecdc4' : '#ffe66d'
      context.lineWidth = 2
      context.stroke()
      
      context.fillStyle = '#000'
      context.font = `${tileSize / 2}px sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText('👤', x, y)
    }
  })
  
  if (selectedUnit.value && previewPath.value.length > 0) {
    context.beginPath()
    const startX = (selectedUnit.value.position.x - map.width / 2) * tileSize + tileSize / 2
    const startY = (selectedUnit.value.position.y - map.height / 2) * tileSize + tileSize / 2
    context.moveTo(startX, startY)
    
    previewPath.value.forEach(point => {
      const px = (point.x - map.width / 2) * tileSize + tileSize / 2
      const py = (point.y - map.height / 2) * tileSize + tileSize / 2
      context.lineTo(px, py)
    })
    
    context.strokeStyle = 'rgba(78, 205, 196, 0.6)'
    context.lineWidth = 3
    context.setLineDash([10, 5])
    context.stroke()
    context.setLineDash([])
    
    previewPath.value.forEach((point, index) => {
      const px = (point.x - map.width / 2) * tileSize + tileSize / 2
      const py = (point.y - map.height / 2) * tileSize + tileSize / 2
      
      context.beginPath()
      context.arc(px, py, 6, 0, Math.PI * 2)
      context.fillStyle = index === previewPath.value.length - 1 ? '#4ecdc4' : 'rgba(78, 205, 196, 0.5)'
      context.fill()
    })
  }
  
  gameState.value.units.forEach(unit => {
    const x = (unit.position.x - map.width / 2) * tileSize + tileSize / 2
    const y = (unit.position.y - map.height / 2) * tileSize + tileSize / 2
    const isSelected = selectedUnit.value?.id === unit.id
    
    if (isSelected) {
      context.beginPath()
      context.arc(x, y, tileSize / 1.5, 0, Math.PI * 2)
      context.strokeStyle = '#4ecdc4'
      context.lineWidth = 3
      context.stroke()
    }
    
    context.beginPath()
    context.arc(x, y, tileSize / 2.2, 0, Math.PI * 2)
    context.fillStyle = unit.type === 'snowmobile' 
      ? (unit.battery > 0 ? 'rgba(102, 126, 234, 0.9)' : 'rgba(100, 100, 100, 0.5)')
      : (unit.battery > 0 ? 'rgba(240, 147, 251, 0.9)' : 'rgba(100, 100, 100, 0.5)')
    context.fill()
    context.strokeStyle = unit.type === 'snowmobile' ? '#667eea' : '#f093fb'
    context.lineWidth = 2
    context.stroke()
    
    context.font = `${tileSize / 2}px sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(unit.type === 'snowmobile' ? '🚜' : '🛸', x, y)
    
    if (unit.status === 'moving' && unit.path.length > 0) {
      context.beginPath()
      context.moveTo(x, y)
      unit.path.forEach(point => {
        const px = (point.x - map.width / 2) * tileSize + tileSize / 2
        const py = (point.y - map.height / 2) * tileSize + tileSize / 2
        context.lineTo(px, py)
      })
      context.strokeStyle = 'rgba(255, 255, 255, 0.4)'
      context.lineWidth = 2
      context.setLineDash([5, 5])
      context.stroke()
      context.setLineDash([])
    }
    
    if (unit.type === 'drone' && isSelected) {
      const scanRadius = (unit.scanRadius || 3) * tileSize
      context.beginPath()
      context.arc(x, y, scanRadius, 0, Math.PI * 2)
      context.strokeStyle = 'rgba(240, 147, 251, 0.4)'
      context.lineWidth = 2
      context.setLineDash([5, 5])
      context.stroke()
      context.setLineDash([])
    }
  })
  
  context.restore()
}

const screenToWorld = (screenX, screenY) => {
  if (!gameState.value) return null
  
  const canvas = mapCanvas.value
  if (!canvas) return null
  
  const tileSize = 32 * mapScale.value
  const map = gameState.value.map
  
  const worldX = Math.floor((screenX - mapOffset.value.x) / tileSize + map.width / 2)
  const worldY = Math.floor((screenY - mapOffset.value.y) / tileSize + map.height / 2)
  
  return { x: worldX, y: worldY }
}

const onMapMouseDown = (e) => {
  if (e.button === 2) {
    isDragging.value = true
    dragStart.value = { x: e.clientX - mapOffset.value.x, y: e.clientY - mapOffset.value.y }
    return
  }
  
  if (selectedUnit.value && selectedUnit.value.status !== 'moving') {
    const pos = screenToWorld(e.offsetX, e.offsetY)
    if (pos) {
      previewPath.value = [pos]
    }
  }
}

const onMapMouseMove = (e) => {
  if (isDragging.value) {
    mapOffset.value = {
      x: e.clientX - dragStart.value.x,
      y: e.clientY - dragStart.value.y
    }
    renderMap()
  }
}

const onMapMouseUp = async (e) => {
  if (isDragging.value) {
    isDragging.value = false
    return
  }
  
  if (selectedUnit.value && selectedUnit.value.status !== 'moving' && previewPath.value.length > 0) {
    const target = previewPath.value[previewPath.value.length - 1]
    
    await sendAction('MOVE_UNIT', {
      unitId: selectedUnit.value.id,
      targetPosition: target,
      path: [target]
    })
    
    previewPath.value = []
  }
}

const onMapWheel = (e) => {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  mapScale.value = Math.max(0.5, Math.min(2, mapScale.value + delta))
  renderMap()
}

const zoomIn = () => {
  mapScale.value = Math.min(2, mapScale.value + 0.2)
  renderMap()
}

const zoomOut = () => {
  mapScale.value = Math.max(0.5, mapScale.value - 0.2)
  renderMap()
}

const resetView = () => {
  mapScale.value = 1
  const canvas = mapCanvas.value
  if (canvas) {
    mapOffset.value = { x: canvas.width / 2, y: canvas.height / 2 }
  }
  renderMap()
}

// 游戏循环
const startGameLoop = () => {
  stopGameLoop()
  lastUpdateTime = performance.now()
  
  gameLoop = setInterval(() => {
    if (!isPaused.value) {
      const now = performance.now()
      const delta = (now - lastUpdateTime) / 1000
      lastUpdateTime = now
      
      advanceGameTime(delta)
    }
  }, 100)
}

const stopGameLoop = () => {
  if (gameLoop) {
    clearInterval(gameLoop)
    gameLoop = null
  }
}

const advanceGameTime = async (delta) => {
  const advanceAmount = Math.floor(delta * gameSpeed.value * 10)
  
  if (advanceAmount > 0) {
    await sendAction('ADVANCE_TIME', { duration: advanceAmount })
    renderMap()
  }
}

const togglePause = () => {
  isPaused.value = !isPaused.value
}

const setSpeed = (speed) => {
  gameSpeed.value = speed
}

// 导出功能
const exportReport = async () => {
  if (!gameState.value) return
  
  try {
    const response = await fetch(`/api/games/${gameState.value.id}/report`)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rescue-report-${gameState.value.id}.md`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('简报已导出')
  } catch (error) {
    ElMessage.error('导出失败')
    console.error(error)
  }
}

const exportLogs = async () => {
  if (!gameState.value) return
  
  try {
    const response = await fetch(`/api/games/${gameState.value.id}/logs`)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `event-log-${gameState.value.id}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('日志已导出')
  } catch (error) {
    ElMessage.error('导出失败')
    console.error(error)
  }
}

const backToStart = () => {
  gamePhase.value = 'start'
  stopGameLoop()
  checkSavedGame()
}

// 生命周期
onMounted(() => {
  fetchLevels()
  checkSavedGame()
})

onUnmounted(() => {
  stopGameLoop()
})

watch(gameState, () => {
  if (gamePhase.value === 'playing') {
    renderMap()
  }
}, { deep: true })
</script>
