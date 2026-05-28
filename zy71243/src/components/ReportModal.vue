<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="text-xl font-bold">📄 任务报告</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      
      <div v-if="!report" class="text-center text-muted py-8">
        暂无报告数据
      </div>
      
      <div v-else>
        <div class="report-section">
          <h3 class="font-semibold text-lg mb-3">任务概要</h3>
          <div class="grid grid-2 gap-3">
            <div class="bg-secondary p-3 rounded">
              <div class="text-muted text-sm">任务时长</div>
              <div class="font-bold">{{ report.summary.missionDuration }}</div>
            </div>
            <div class="bg-secondary p-3 rounded">
              <div class="text-muted text-sm">系统可用率</div>
              <div class="font-bold">{{ report.summary.systemUptime }}</div>
            </div>
            <div class="bg-secondary p-3 rounded">
              <div class="text-muted text-sm">评级</div>
              <div class="font-bold text-2xl" :class="getGradeColor(report.summary.grade)">
                {{ report.summary.grade }}
              </div>
            </div>
            <div class="bg-secondary p-3 rounded">
              <div class="text-muted text-sm">最终得分</div>
              <div class="font-bold text-2xl text-primary">{{ report.score }}</div>
            </div>
          </div>
          
          <div v-if="!report.summary.crewSurvived" class="mt-3 p-3 bg-red-900/30 rounded text-center">
            <span class="text-danger font-semibold">⚠️ 乘员失活 - 任务失败</span>
          </div>
        </div>
        
        <div class="report-section">
          <h3 class="font-semibold text-lg mb-3">能源分析</h3>
          <div class="grid grid-2 gap-2 text-sm">
            <div v-for="(value, key) in report.energyAnalysis" :key="key" class="flex justify-between">
              <span class="text-muted">{{ getEnergyLabel(key) }}</span>
              <span class="font-medium">{{ value }}</span>
            </div>
          </div>
        </div>
        
        <div class="report-section">
          <h3 class="font-semibold text-lg mb-3">负载分析</h3>
          <div class="space-y-2">
            <div 
              v-for="load in report.loadAnalysis" 
              :key="load.name"
              class="flex justify-between items-center p-2 bg-secondary rounded"
            >
              <div>
                <div class="font-medium text-sm">{{ load.name }}</div>
                <div class="text-xs text-muted">
                  {{ load.powerDemand }} kW · {{ load.currentStatus }}
                </div>
              </div>
              <div class="text-right">
                <div 
                  class="font-semibold"
                  :class="parseFloat(load.reliability) >= 95 ? 'text-success' : parseFloat(load.reliability) >= 80 ? 'text-warning' : 'text-danger'"
                >
                  {{ load.reliability }}
                </div>
                <div class="text-xs text-muted">可靠性</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="report-section">
          <h3 class="font-semibold text-lg mb-3">改进建议</h3>
          <div class="space-y-2">
            <div 
              v-for="(rec, index) in report.recommendations" 
              :key="index"
              class="recommendation-item"
              :class="rec.priority"
            >
              <div class="font-bold">{{ getPriorityIcon(rec.priority) }}</div>
              <div>
                <div class="font-medium text-sm">{{ rec.category.toUpperCase() }}</div>
                <div class="text-sm text-muted">{{ rec.message }}</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="flex gap-2 mt-6">
          <button 
            class="btn btn-primary flex-1 justify-center"
            @click="$emit('download', 'txt')"
          >
            📥 下载 TXT
          </button>
          <button 
            class="btn flex-1 justify-center"
            style="background: var(--bg-secondary); color: var(--text-primary);"
            @click="$emit('download', 'csv')"
          >
            📊 下载 CSV
          </button>
          <button 
            class="btn flex-1 justify-center"
            style="background: var(--bg-secondary); color: var(--text-primary);"
            @click="$emit('download', 'json')"
          >
            📋 下载 JSON
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  report: {
    type: Object,
    default: null
  }
})

defineEmits(['close', 'download'])

function getGradeColor(grade) {
  const colors = {
    S: 'text-success',
    A: 'text-primary',
    B: 'text-warning',
    C: 'text-warning',
    D: 'text-danger',
    F: 'text-danger'
  }
  return colors[grade] || 'text-muted'
}

function getEnergyLabel(key) {
  const labels = {
    averageSolarOutput: '平均太阳能输出',
    peakSolarOutput: '峰值太阳能输出',
    averageLoad: '平均负载',
    peakLoad: '峰值负载',
    minimumBatteryLevel: '最低电池电量',
    overDischargeEvents: '过放事件数',
    netEnergyBalance: '净能量平衡'
  }
  return labels[key] || key
}

function getPriorityIcon(priority) {
  const icons = {
    critical: '🛑',
    high: '⚠️',
    medium: '💡',
    low: '✅'
  }
  return icons[priority] || '•'
}
</script>
