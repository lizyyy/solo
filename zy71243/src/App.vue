<template>
  <div class="app">
    <header class="header">
      <div class="header-content">
        <div class="logo">⚡ 太空电网配平局</div>
        <div class="flex gap-4 items-center">
          <span v-if="gameStarted && !isGameOver" class="text-muted">
            {{ isReplayMode ? '📽️ 回放模式' : '回合 ' + currentTurn + ' / ' + maxTurns }}
          </span>
          <span 
            v-if="gameStarted" 
            class="status-badge" 
            :class="'status-' + stationStatus"
          >
            {{ getStatusText(stationStatus) }}
          </span>
          <span v-if="gameStarted && !crewAlive" class="status-badge status-critical">
            ⚠️ 乘员失活
          </span>
          <button 
            v-if="isReplayMode"
            class="btn text-xs py-1 px-3 btn-warning"
            @click="exitReplayMode"
          >
            退出回放
          </button>
        </div>
      </div>
    </header>

    <div class="container">
      <ScenarioSelector 
        v-if="!gameStarted"
        :scenarios="scenarios"
        :selected-scenario="selectedScenario"
        @select="selectScenario"
        @start="startGame"
      />

      <div v-else class="grid grid-3">
        <div class="grid-item span-2">
          <PowerOverview 
            v-if="!isReplayMode"
            :station="station"
            :sun-angle="sunAngle"
            :power-balance="powerBalance"
          />
          
          <div v-if="isReplayMode" class="card">
            <h2 class="card-title">📽️ 回放视图 - 回合 {{ replayCurrentTurn }}</h2>
            <div v-if="replayState" class="stat-grid">
              <div class="stat-box">
                <div class="stat-value text-success">{{ replaySolarOutput.toFixed(1) }}</div>
                <div class="stat-label">太阳能输出 (kW)</div>
              </div>
              <div class="stat-box">
                <div class="stat-value text-warning">{{ replayLoadDemand.toFixed(1) }}</div>
                <div class="stat-label">负载需求 (kW)</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">{{ replayBatteryPercent.toFixed(0) }}%</div>
                <div class="stat-label">电池电量</div>
              </div>
              <div class="stat-box">
                <div class="stat-value">{{ replayState.sunAngle.toFixed(0) }}°</div>
                <div class="stat-label">太阳角度</div>
              </div>
            </div>
          </div>
          
          <div class="mt-4">
            <div class="tabs">
              <div 
                v-for="tab in displayTabs" 
                :key="tab.id"
                class="tab"
                :class="{ active: activeTab === tab.id }"
                @click="activeTab = tab.id"
              >
                {{ tab.name }}
              </div>
            </div>
            
            <ModuleView 
              v-if="activeTab === 'modules' && !isReplayMode"
              :modules="station.modules"
              :current-turn="currentTurn"
              @toggle-load="toggleLoad"
              @transfer-device="handleTransferDevice"
              @archive-note="handleArchiveNote"
            />
            
            <div v-if="activeTab === 'modules' && isReplayMode" class="card">
              <h3 class="font-semibold mb-3">回放模式 - 模块状态快照</h3>
              <div v-if="replayState?.modules" class="space-y-3">
                <div 
                  v-for="module in replayState.modules" 
                  :key="module.id"
                  class="p-3 bg-secondary rounded"
                >
                  <h4 class="font-medium mb-2">{{ module.name }}</h4>
                  <div class="grid grid-3 gap-2 text-xs">
                    <div>
                      <div class="text-muted">太阳能板</div>
                      <div>{{ module.solarPanels?.length || 0 }} 块</div>
                    </div>
                    <div>
                      <div class="text-muted">电池组</div>
                      <div>{{ module.batteries?.length || 0 }} 组</div>
                    </div>
                    <div>
                      <div class="text-muted">负载</div>
                      <div>{{ module.loads?.length || 0 }} 台</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <EnergyLedgerView 
              v-if="activeTab === 'ledger'"
              :ledger-entries="ledgerEntries"
            />
            
            <EventLogView 
              v-if="activeTab === 'events'"
              :events="events"
            />
            
            <ReplayView 
              v-if="activeTab === 'replay'"
              :history="gameHistory"
              :failure-points="failurePoints"
              @replay-step="handleReplayStep"
              @replay-complete="handleReplayComplete"
            />
          </div>
        </div>

        <div class="grid-item">
          <ControlPanel 
            v-if="!isReplayMode"
            :is-game-over="isGameOver"
            :can-advance="canAdvanceTurn"
            @advance="advanceTurn"
            @reset="resetGame"
            @show-report="showReport = true"
            @start-replay="enterReplayMode"
          />
          
          <div v-if="isReplayMode" class="card">
            <h2 class="card-title">📽️ 回放控制</h2>
            <p class="text-sm text-muted mb-4">
              正在查看回合 {{ replayCurrentTurn }} 的历史状态
            </p>
            <div class="space-y-2">
              <button 
                class="btn w-full justify-center"
                style="background: var(--bg-secondary);"
                @click="exitReplayMode"
              >
                ← 返回游戏
              </button>
              <button 
                class="btn w-full justify-center"
                style="background: var(--bg-secondary);"
                @click="activeTab = 'replay'"
              >
                🎬 打开回放控制台
              </button>
            </div>
          </div>
          
          <div class="mt-4">
            <BatteryStatus :batteries="isReplayMode ? replayBatteries : station.getAllBatteries()" />
          </div>
        </div>
      </div>
    </div>

    <ReportModal 
      v-if="showReport"
      :report="report"
      @close="showReport = false"
      @download="downloadReport"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ScenarioData } from './data/ScenarioData.js'
import { TurnManager } from './core/TurnManager.js'
import { ReportGenerator } from './core/ReportGenerator.js'
import { ReplaySystem } from './core/ReplaySystem.js'

import ScenarioSelector from './components/ScenarioSelector.vue'
import PowerOverview from './components/PowerOverview.vue'
import ModuleView from './components/ModuleView.vue'
import EnergyLedgerView from './components/EnergyLedgerView.vue'
import EventLogView from './components/EventLogView.vue'
import ControlPanel from './components/ControlPanel.vue'
import BatteryStatus from './components/BatteryStatus.vue'
import ReportModal from './components/ReportModal.vue'
import ReplayView from './components/ReplayView.vue'

const scenarios = ScenarioData.getScenarios()
const selectedScenario = ref('basic')
const gameStarted = ref(false)

const station = ref(null)
const turnManager = ref(null)
const replaySystem = ref(null)
const currentTurn = ref(0)
const sunAngle = ref(90)
const stationStatus = ref('stable')
const crewAlive = ref(true)
const isGameOver = ref(false)
const powerBalance = ref({})
const events = ref([])
const ledgerEntries = ref([])
const activeTab = ref('modules')
const showReport = ref(false)
const report = ref(null)
const maxTurns = 24
const archiveNotes = ref([])
const transferTrigger = ref(0)

const isReplayMode = ref(false)
const replayCurrentTurn = ref(0)
const replayState = ref(null)

const displayTabs = computed(() => {
  const tabs = [
    { id: 'modules', name: '舱段管理' },
    { id: 'ledger', name: '能源账本' },
    { id: 'events', name: '事件日志' }
  ]
  if (gameHistory.value.length > 0) {
    tabs.push({ id: 'replay', name: '🎬 回放分析' })
  }
  return tabs
})

const gameHistory = computed(() => {
  return turnManager.value?.history || []
})

const failurePoints = computed(() => {
  return replaySystem.value?.findFailurePoint() || []
})

const replaySolarOutput = computed(() => {
  if (!replayState.value?.modules) return 0
  let total = 0
  for (const module of replayState.value.modules) {
    for (const panel of module.solarPanels || []) {
      const angleDiff = Math.abs((replayState.value.sunAngle || 90) - panel.tiltAngle)
      const sunFactor = Math.cos(angleDiff * Math.PI / 180)
      const healthFactor = 1 - (panel.damageLevel * 0.3)
      total += panel.maxOutput * panel.efficiency * sunFactor * healthFactor
    }
  }
  return total
})

const replayLoadDemand = computed(() => {
  if (!replayState.value?.modules) return 0
  let total = 0
  for (const module of replayState.value.modules) {
    for (const load of module.loads || []) {
      if (load.isPowered) {
        total += load.powerDemand
      }
    }
  }
  return total
})

const replayBatteryPercent = computed(() => {
  if (!replayState.value?.modules) return 0
  let totalCharge = 0
  let totalCapacity = 0
  for (const module of replayState.value.modules) {
    for (const battery of module.batteries || []) {
      totalCharge += battery.currentCharge
      const healthFactor = 1 - (battery.damageLevel * 0.4)
      totalCapacity += battery.capacity * healthFactor
    }
  }
  return totalCapacity > 0 ? (totalCharge / totalCapacity) * 100 : 0
})

const replayBatteries = computed(() => {
  if (!replayState.value?.modules) return []
  const batteries = []
  for (const module of replayState.value.modules) {
    for (const battery of module.batteries || []) {
      batteries.push(battery)
    }
  }
  return batteries
})

const canAdvanceTurn = computed(() => !isGameOver.value && !isReplayMode.value)

function selectScenario(id) {
  selectedScenario.value = id
}

function startGame() {
  const scenario = scenarios.find(s => s.id === selectedScenario.value)
  if (!scenario) return

  station.value = scenario.create()
  turnManager.value = new TurnManager(station.value)
  replaySystem.value = new ReplaySystem(turnManager.value)
  
  const state = turnManager.value.start()
  updateState(state)
  
  gameStarted.value = true
  isReplayMode.value = false
  replayCurrentTurn.value = 0
  replayState.value = null
  archiveNotes.value = []
}

function advanceTurn() {
  if (!turnManager.value) return
  
  const result = turnManager.value.advanceTurn()
  if (result) {
    currentTurn.value = result.turn
    isGameOver.value = result.isGameOver
    crewAlive.value = result.crewAlive
    stationStatus.value = result.stationStatus
    events.value = turnManager.value.eventSystem.getRecentEvents(20)
    ledgerEntries.value = turnManager.value.ledger.getLastNEntries(10)
  }
  
  updateState(turnManager.value.getCurrentState())
  
  if (isGameOver.value) {
    generateReport()
  }
}

function updateState(state) {
  sunAngle.value = state.sunAngle
  powerBalance.value = state.powerBalance
  stationStatus.value = state.station.getOverallState()
}

function toggleLoad(loadId) {
  if (!turnManager.value) return
  
  const load = station.value.getAllLoads().find(l => l.id === loadId)
  if (load) {
    if (load.isPowered) {
      turnManager.value.powerManager.manuallyShedLoad(loadId)
    } else {
      turnManager.value.powerManager.restoreLoad(loadId)
    }
  }
}

function handleTransferDevice({ device, type, from, to }) {
  if (!station.value) return
  
  const sourceModule = station.value.getModule(from)
  const targetModule = station.value.getModule(to)
  
  if (!sourceModule || !targetModule) return
  
  if (type === 'solar') {
    const actualPanel = sourceModule.solarPanels.find(p => p.id === device.id)
    if (actualPanel) {
      sourceModule.removeSolarPanel(actualPanel.id)
      targetModule.addSolarPanel(actualPanel)
    }
  } else if (type === 'battery') {
    const actualBattery = sourceModule.batteries.find(b => b.id === device.id)
    if (actualBattery) {
      sourceModule.removeBattery(actualBattery.id)
      targetModule.addBattery(actualBattery)
    }
  } else if (type === 'load') {
    const actualLoad = sourceModule.loads.find(l => l.id === device.id)
    if (actualLoad) {
      sourceModule.removeLoad(actualLoad.id)
      actualLoad.moduleId = to
      targetModule.addLoad(actualLoad)
    }
  }
  
  transferTrigger.value++
  updateState(turnManager.value.getCurrentState())
}

function handleArchiveNote(note) {
  archiveNotes.value.push(note)
  console.log('归档笔记已保存:', note)
}

function resetGame() {
  if (!turnManager.value) return
  
  const state = turnManager.value.reset()
  updateState(state)
  currentTurn.value = 0
  isGameOver.value = false
  crewAlive.value = true
  events.value = []
  ledgerEntries.value = []
  activeTab.value = 'modules'
  showReport.value = false
  isReplayMode.value = false
  replayCurrentTurn.value = 0
  replayState.value = null
  archiveNotes.value = []
}

function generateReport() {
  if (!turnManager.value) return
  
  const generator = new ReportGenerator(
    turnManager.value.ledger,
    turnManager.value.eventSystem,
    station.value
  )
  report.value = generator.generateFullReport()
}

function downloadReport(format) {
  if (!turnManager.value) return
  
  const generator = new ReportGenerator(
    turnManager.value.ledger,
    turnManager.value.eventSystem,
    station.value
  )
  const { content, filename, mimeType } = generator.downloadReport(format)
  
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function enterReplayMode() {
  if (gameHistory.value.length === 0) return
  isReplayMode.value = true
  activeTab.value = 'replay'
  replayCurrentTurn.value = gameHistory.value.length - 1
  replayState.value = gameHistory.value[replayCurrentTurn.value]
}

function exitReplayMode() {
  isReplayMode.value = false
  replayCurrentTurn.value = 0
  replayState.value = null
  updateState(turnManager.value.getCurrentState())
}

function handleReplayStep(state, turn) {
  replayCurrentTurn.value = turn
  replayState.value = state
}

function handleReplayComplete() {
  console.log('回放完成')
}

function getStatusText(status) {
  const texts = {
    stable: '稳定',
    warning: '警告',
    danger: '危险',
    critical: '危急'
  }
  return texts[status] || status
}

onMounted(() => {
  console.log('太空电网配平局 已启动')
})
</script>

<style scoped>
.grid-item.span-2 {
  grid-column: span 2;
}

@media (max-width: 768px) {
  .grid-item.span-2 {
    grid-column: span 1;
  }
}
</style>
