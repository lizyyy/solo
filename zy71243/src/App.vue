<template>
  <div class="app">
    <header class="header">
      <div class="header-content">
        <div class="logo">⚡ 太空电网配平局</div>
        <div class="flex gap-4 items-center">
          <span v-if="gameStarted && !isGameOver" class="text-muted">
            回合 {{ currentTurn }} / {{ maxTurns }}
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
            :station="station"
            :sun-angle="sunAngle"
            :power-balance="powerBalance"
          />
          
          <div class="mt-4">
            <div class="tabs">
              <div 
                v-for="tab in tabs" 
                :key="tab.id"
                class="tab"
                :class="{ active: activeTab === tab.id }"
                @click="activeTab = tab.id"
              >
                {{ tab.name }}
              </div>
            </div>
            
            <ModuleView 
              v-if="activeTab === 'modules'"
              :modules="station.modules"
              @toggle-load="toggleLoad"
            />
            
            <EnergyLedgerView 
              v-if="activeTab === 'ledger'"
              :ledger-entries="ledgerEntries"
            />
            
            <EventLogView 
              v-if="activeTab === 'events'"
              :events="events"
            />
          </div>
        </div>

        <div class="grid-item">
          <ControlPanel 
            :is-game-over="isGameOver"
            :can-advance="canAdvanceTurn"
            @advance="advanceTurn"
            @reset="resetGame"
            @show-report="showReport = true"
            @start-replay="startReplay"
          />
          
          <div class="mt-4">
            <BatteryStatus :batteries="station.getAllBatteries()" />
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

const tabs = [
  { id: 'modules', name: '舱段管理' },
  { id: 'ledger', name: '能源账本' },
  { id: 'events', name: '事件日志' }
]

const canAdvanceTurn = computed(() => !isGameOver.value)

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

function startReplay() {
  if (!replaySystem.value) return
  
  replaySystem.value.onReplayStep = (state, turn) => {
    console.log('Replay turn:', turn, state)
  }
  
  replaySystem.value.startReplay()
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
