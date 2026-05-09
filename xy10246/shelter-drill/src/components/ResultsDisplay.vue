<template>
  <div v-if="results" class="results-display">
    <h3>3. 演练结果分析</h3>
    
    <div :class="['overall-status', results.riskReport.overallStatus]">
      <div class="status-icon">{{ getStatusIcon() }}</div>
      <div class="status-text">
        <div class="status-title">{{ getStatusTitle() }}</div>
        <div class="status-message">{{ results.riskReport.overallMessage }}</div>
      </div>
    </div>
    
    <div class="statistics-grid">
      <div class="stat-card">
        <div class="stat-label">总流入人数</div>
        <div class="stat-value">{{ results.riskReport.statistics.totalInflow }}</div>
        <div class="stat-unit">人</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">总容量</div>
        <div class="stat-value">{{ results.riskReport.statistics.totalCapacity }}</div>
        <div class="stat-unit">人</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">整体利用率</div>
        <div :class="['stat-value', getUtilizationClass()]">
          {{ results.riskReport.statistics.overallUtilizationRate.toFixed(1) }}%
        </div>
      </div>
    </div>
    
    <div class="sections-container">
      <div class="section">
        <h4>入口拥堵分析</h4>
        <div class="entrances-list">
          <div 
            v-for="entrance in results.simulationResult.finalState.entrances" 
            :key="entrance.id"
            :class="['entrance-item', getEntranceSeverityClass(entrance.utilizationRate)]"
          >
            <div class="entrance-header">
              <div class="entrance-name">{{ getEntranceName(entrance.id) }}</div>
              <div :class="['entrance-badge', getEntranceSeverityClass(entrance.utilizationRate)]">
                {{ getEntranceStatusText(entrance.utilizationRate) }}
              </div>
            </div>
            <div class="entrance-progress">
              <div 
                class="progress-bar"
                :style="{ width: Math.min(entrance.utilizationRate, 100) + '%' }"
                :class="getEntranceSeverityClass(entrance.utilizationRate)"
              ></div>
            </div>
            <div class="entrance-stats">
              <span>{{ entrance.currentFlow }} / {{ entrance.maxCapacity }} 人</span>
              <span>{{ entrance.utilizationRate.toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <h4>帐篷区容量分析</h4>
        <div class="tents-list">
          <div 
            v-for="tent in results.simulationResult.finalState.tentZones" 
            :key="tent.id"
            :class="['tent-item', getTentSeverityClass(tent.utilizationRate)]"
          >
            <div class="tent-header">
              <div class="tent-name">{{ getTentName(tent.id) }}</div>
              <div :class="['tent-badge', getTentSeverityClass(tent.utilizationRate)]">
                {{ getTentStatusText(tent.utilizationRate) }}
              </div>
            </div>
            <div class="tent-progress">
              <div 
                class="progress-bar"
                :style="{ width: Math.min(tent.utilizationRate, 100) + '%' }"
                :class="getTentSeverityClass(tent.utilizationRate)"
              ></div>
            </div>
            <div class="tent-stats">
              <span>{{ tent.currentOccupancy }} / {{ tent.capacity }} 人</span>
              <span>{{ tent.utilizationRate.toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <h4>物资可达性分析</h4>
        <div v-if="supplyAccessibility" class="supply-analysis">
          <div :class="['supply-overview', supplyAccessibility.overallLevel]">
            <div class="supply-icon">{{ getSupplyIcon() }}</div>
            <div>{{ supplyAccessibility.overallMessage }}</div>
          </div>
          <div class="supply-zones">
            <div 
              v-for="zone in supplyAccessibility.zones" 
              :key="zone.tentZoneId"
              :class="['supply-zone-item', zone.level]"
            >
              <div class="zone-header">
                <div class="zone-name">{{ zone.tentZoneName }}</div>
                <div class="zone-connection">
                  连接 {{ zone.connectedSupplyCount }}/{{ zone.totalSupplyCount }} 个物资点
                </div>
              </div>
              <div v-if="zone.issues.length > 0" class="zone-issues">
                <div v-for="(issue, idx) in zone.issues" :key="idx" class="issue-item">
                  {{ issue }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="no-supply-data">
          暂无物资点数据
        </div>
      </div>
    </div>
    
    <div v-if="results.riskReport.allRisks.length > 0" class="risks-section">
      <h4>风险事件时间线</h4>
      <div class="risks-timeline">
        <div 
          v-for="(risk, idx) in results.riskReport.allRisks" 
          :key="idx"
          :class="['risk-item', risk.severity]"
        >
          <div class="risk-time">{{ risk.time }}</div>
          <div class="risk-content">
            <div :class="['risk-type', risk.severity]">{{ getRiskTypeLabel(risk.type) }}</div>
            <div class="risk-message">{{ risk.message }}</div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="results.riskReport.allRisks.length === 0" class="no-risks">
      🎉 太棒了！本次演练没有发现任何风险事件
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { calculateSupplyAccessibility } from '../utils/calculator'

const props = defineProps({
  results: {
    type: Object,
    default: null
  }
})

const supplyAccessibility = computed(() => {
  if (!props.results || !props.results.layout) return null
  return calculateSupplyAccessibility(props.results.layout)
})

function getStatusIcon() {
  const status = props.results.riskReport.overallStatus
  if (status === 'safe') return '✅'
  if (status === 'warning') return '⚠️'
  return '❌'
}

function getStatusTitle() {
  const status = props.results.riskReport.overallStatus
  if (status === 'safe') return '演练通过'
  if (status === 'warning') return '演练有风险'
  return '演练失败'
}

function getUtilizationClass() {
  const rate = props.results.riskReport.statistics.overallUtilizationRate
  if (rate >= 100) return 'critical'
  if (rate >= 85) return 'warning'
  return 'normal'
}

function getEntranceSeverityClass(rate) {
  if (rate >= 100) return 'critical'
  if (rate >= 80) return 'warning'
  return 'normal'
}

function getEntranceStatusText(rate) {
  if (rate >= 100) return '拥堵'
  if (rate >= 80) return '繁忙'
  return '正常'
}

function getTentSeverityClass(rate) {
  if (rate >= 100) return 'critical'
  if (rate >= 85) return 'warning'
  return 'normal'
}

function getTentStatusText(rate) {
  if (rate >= 100) return '已满'
  if (rate >= 85) return '紧张'
  return '充足'
}

function getSupplyIcon() {
  if (!supplyAccessibility.value) return '❓'
  const level = supplyAccessibility.value.overallLevel
  if (level === 'normal') return '✅'
  if (level === 'warning') return '⚠️'
  return '❌'
}

function getEntranceName(id) {
  if (!props.results || !props.results.layout) return id
  const entrance = props.results.layout.entrances.find(e => e.id === id)
  return entrance ? entrance.name : id
}

function getTentName(id) {
  if (!props.results || !props.results.layout) return id
  const tent = props.results.layout.tentZones.find(t => t.id === id)
  return tent ? tent.name : id
}

function getRiskTypeLabel(type) {
  const labels = {
    entrance_congestion: '入口拥堵',
    tent_zone_full: '帐篷满员',
    tent_zone_warning: '帐篷紧张',
    tent_zone_shortage: '容量不足',
    entrance_not_found: '入口错误'
  }
  return labels[type] || type
}
</script>

<style scoped>
.results-display {
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;
}

h3 {
  margin-top: 0;
  margin-bottom: 16px;
  color: #333;
}

h4 {
  margin-top: 0;
  margin-bottom: 12px;
  color: #555;
  font-size: 14px;
}

.overall-status {
  display: flex;
  align-items: center;
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 20px;
}

.overall-status.safe {
  background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
  border: 2px solid #4caf50;
}

.overall-status.warning {
  background: linear-gradient(135deg, #fff3e0, #ffe0b2);
  border: 2px solid #ff9800;
}

.overall-status.fail {
  background: linear-gradient(135deg, #ffebee, #ffcdd2);
  border: 2px solid #f44336;
}

.status-icon {
  font-size: 48px;
  margin-right: 16px;
}

.status-title {
  font-size: 20px;
  font-weight: bold;
  color: #333;
}

.status-message {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
}

.statistics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  background: white;
  padding: 16px;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.stat-label {
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
}

.stat-value.critical { color: #f44336; }
.stat-value.warning { color: #ff9800; }

.stat-unit {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}

.sections-container {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.section {
  background: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.entrances-list, .tents-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.entrance-item, .tent-item {
  padding: 12px;
  border-radius: 8px;
  background: #fafafa;
}

.entrance-item.critical, .tent-item.critical {
  background: #ffebee;
  border-left: 4px solid #f44336;
}

.entrance-item.warning, .tent-item.warning {
  background: #fff3e0;
  border-left: 4px solid #ff9800;
}

.entrance-header, .tent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.entrance-name, .tent-name {
  font-weight: bold;
  color: #333;
}

.entrance-badge, .tent-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: bold;
}

.entrance-badge.normal, .tent-badge.normal {
  background: #e8f5e9;
  color: #2e7d32;
}

.entrance-badge.warning, .tent-badge.warning {
  background: #fff3e0;
  color: #ef6c00;
}

.entrance-badge.critical, .tent-badge.critical {
  background: #ffebee;
  color: #c62828;
}

.entrance-progress, .tent-progress {
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-bar {
  height: 100%;
  background: #4caf50;
  transition: width 0.3s;
}

.progress-bar.warning {
  background: #ff9800;
}

.progress-bar.critical {
  background: #f44336;
}

.entrance-stats, .tent-stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #666;
}

.supply-analysis {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.supply-overview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
}

.supply-overview.normal {
  background: #e8f5e9;
  color: #2e7d32;
}

.supply-overview.warning {
  background: #fff3e0;
  color: #ef6c00;
}

.supply-overview.critical {
  background: #ffebee;
  color: #c62828;
}

.supply-icon {
  font-size: 24px;
}

.supply-zones {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.supply-zone-item {
  padding: 12px;
  border-radius: 6px;
  background: #f5f5f5;
}

.supply-zone-item.warning {
  background: #fff3e0;
}

.supply-zone-item.critical {
  background: #ffebee;
}

.zone-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.zone-name {
  font-weight: bold;
  color: #333;
}

.zone-connection {
  font-size: 11px;
  color: #888;
}

.zone-issues {
  font-size: 12px;
}

.issue-item {
  padding: 4px 0;
  color: #ef6c00;
}

.supply-zone-item.critical .issue-item {
  color: #c62828;
}

.no-supply-data {
  padding: 20px;
  text-align: center;
  color: #888;
  background: #f5f5f5;
  border-radius: 8px;
}

.risks-section {
  background: white;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.risks-timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.risk-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
}

.risk-item.critical {
  background: #ffebee;
  border-left: 4px solid #f44336;
}

.risk-item.warning {
  background: #fff3e0;
  border-left: 4px solid #ff9800;
}

.risk-item.error {
  background: #fce4ec;
  border-left: 4px solid #e91e63;
}

.risk-time {
  font-weight: bold;
  color: #666;
  min-width: 80px;
  font-size: 13px;
}

.risk-content {
  flex: 1;
}

.risk-type {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
  margin-bottom: 4px;
}

.risk-type.critical {
  background: #f44336;
  color: white;
}

.risk-type.warning {
  background: #ff9800;
  color: white;
}

.risk-type.error {
  background: #e91e63;
  color: white;
}

.risk-message {
  font-size: 13px;
  color: #333;
}

.no-risks {
  background: #e8f5e9;
  color: #2e7d32;
  padding: 24px;
  text-align: center;
  border-radius: 8px;
  font-weight: bold;
}

@media (min-width: 769px) {
  .sections-container {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .results-display {
    padding: 12px;
  }
  
  .overall-status {
    padding: 16px;
    flex-direction: column;
    text-align: center;
  }
  
  .status-icon {
    margin-right: 0;
    margin-bottom: 8px;
  }
  
  .statistics-grid {
    grid-template-columns: 1fr;
  }
  
  .risk-item {
    flex-direction: column;
    gap: 4px;
  }
  
  .risk-time {
    min-width: auto;
  }
}
</style>
