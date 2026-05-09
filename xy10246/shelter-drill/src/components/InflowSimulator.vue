<template>
  <div class="inflow-simulator">
    <h3>2. 设置人员流入场景</h3>
    
    <div class="scenario-selection">
      <div 
        v-for="scenario in sampleInflowScenarios" 
        :key="scenario.id"
        :class="['scenario-card', { active: selectedScenarioId === scenario.id }]"
        @click="selectScenario(scenario.id)"
      >
        <div class="scenario-name">{{ scenario.name }}</div>
        <div class="scenario-desc">{{ scenario.description }}</div>
        <div class="scenario-stats">
          时间步: {{ scenario.timeSteps.length }} | 
          总流入: {{ getTotalInflow(scenario) }} 人
        </div>
      </div>
    </div>
    
    <div v-if="selectedScenario" class="timeline-display">
      <h4>流入时间线</h4>
      <div class="timeline">
        <div 
          v-for="(step, idx) in selectedScenario.timeSteps" 
          :key="idx"
          class="timeline-step"
        >
          <div class="step-time">{{ step.time }}</div>
          <div class="step-inflow">{{ step.inflow }} 人</div>
          <div class="step-entrance">{{ getEntranceName(step.entrance) }}</div>
          <div class="step-bar">
            <div 
              class="step-bar-fill"
              :style="{ width: getInflowPercentage(step.inflow) + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="action-section">
      <button 
        class="btn btn-primary btn-large"
        @click="runSimulation"
        :disabled="!canRunSimulation"
      >
        开始演练模拟
      </button>
      <div v-if="simulationRunning" class="running-indicator">
        <div class="spinner"></div>
        模拟进行中...
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { sampleInflowScenarios } from '../data/sampleData'
import { validateInflowScenario, simulateInflow, generateRiskReport } from '../utils/calculator'

const props = defineProps({
  layout: {
    type: Object,
    default: null
  },
  layoutValidation: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['simulationComplete'])

const selectedScenarioId = ref('gradual')
const selectedScenario = ref(null)
const simulationRunning = ref(false)

const canRunSimulation = computed(() => {
  return props.layout && 
         props.layoutValidation && 
         props.layoutValidation.valid &&
         selectedScenario.value
})

function selectScenario(scenarioId) {
  selectedScenarioId.value = scenarioId
  const scenario = sampleInflowScenarios.find(s => s.id === scenarioId)
  if (scenario) {
    selectedScenario.value = JSON.parse(JSON.stringify(scenario))
  }
}

function getTotalInflow(scenario) {
  return scenario.timeSteps.reduce((sum, step) => sum + step.inflow, 0)
}

function getEntranceName(entranceId) {
  if (!props.layout) return `入口 ${entranceId}`
  const entrance = props.layout.entrances.find(e => e.id === entranceId)
  return entrance ? entrance.name : `入口 ${entranceId}`
}

function getInflowPercentage(inflow) {
  const maxInflow = selectedScenario.value 
    ? Math.max(...selectedScenario.value.timeSteps.map(s => s.inflow)) 
    : 1
  return (inflow / maxInflow) * 100
}

async function runSimulation() {
  if (!canRunSimulation.value) return
  
  simulationRunning.value = true
  
  try {
    const scenarioValidation = validateInflowScenario(selectedScenario.value)
    
    if (!scenarioValidation.valid) {
      emit('simulationComplete', {
        success: false,
        error: '流入场景校验失败',
        validation: scenarioValidation
      })
      return
    }
    
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const simulationResult = simulateInflow(props.layout, selectedScenario.value)
    const riskReport = generateRiskReport(props.layout, selectedScenario.value, simulationResult)
    
    emit('simulationComplete', {
      success: true,
      simulationResult,
      riskReport,
      layout: props.layout,
      scenario: selectedScenario.value
    })
  } catch (error) {
    emit('simulationComplete', {
      success: false,
      error: error.message
    })
  } finally {
    simulationRunning.value = false
  }
}

selectScenario('gradual')
</script>

<style scoped>
.inflow-simulator {
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;
  margin-bottom: 16px;
}

h3 {
  margin-top: 0;
  margin-bottom: 16px;
  color: #333;
}

h4 {
  margin-top: 20px;
  margin-bottom: 12px;
  color: #555;
  font-size: 14px;
}

.scenario-selection {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.scenario-card {
  padding: 16px;
  background: white;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.scenario-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  border-color: #a5d6a7;
}

.scenario-card.active {
  border-color: #43a047;
  background: #e8f5e9;
}

.scenario-name {
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
}

.scenario-desc {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.scenario-stats {
  font-size: 11px;
  color: #888;
}

.timeline-display {
  background: white;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.timeline-step {
  display: grid;
  grid-template-columns: 80px 80px 120px 1fr;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: #fafafa;
  border-radius: 4px;
}

.step-time {
  font-weight: bold;
  color: #333;
  font-size: 13px;
}

.step-inflow {
  font-size: 14px;
  font-weight: bold;
  color: #1976d2;
}

.step-entrance {
  font-size: 12px;
  color: #666;
}

.step-bar {
  height: 20px;
  background: #eee;
  border-radius: 10px;
  overflow: hidden;
}

.step-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #42a5f5, #1976d2);
  transition: width 0.3s;
}

.action-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #1976d2, #1565c0);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.4);
}

.btn-large {
  padding: 14px 32px;
  font-size: 16px;
}

.btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.running-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1976d2;
  font-weight: bold;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 3px solid #e3f2fd;
  border-top-color: #1976d2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .inflow-simulator {
    padding: 12px;
  }
  
  .scenario-selection {
    grid-template-columns: 1fr;
  }
  
  .timeline-step {
    grid-template-columns: 60px 60px 80px 1fr;
    gap: 8px;
  }
  
  .step-time, .step-entrance {
    font-size: 11px;
  }
  
  .step-inflow {
    font-size: 12px;
  }
  
  .action-section {
    flex-direction: column;
    align-items: stretch;
  }
  
  .btn-large {
    width: 100%;
  }
}
</style>
