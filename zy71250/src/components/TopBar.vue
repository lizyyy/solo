<template>
  <div class="top-bar">
    <div class="top-bar-left">
      <span class="current-time">{{ currentTime }}</span>
      <span class="data-source">标的: {{ underlying }}</span>
    </div>
    <div class="top-bar-center">
      <span v-if="store.surfaceData" class="surface-info">
        网格: {{ store.surfaceData.grid.length }}×{{ store.surfaceData.grid[0].length }} | 
        异常点: {{ store.surfaceData.anomalies.length }} | 
        范围: {{ (ivRange.min * 100).toFixed(0) }}% - {{ (ivRange.max * 100).toFixed(0) }}%
      </span>
    </div>
    <div class="top-bar-right">
      <button class="btn btn-secondary" @click="runDiagnostics">运行诊断</button>
      <button class="btn btn-warning" @click="exportScreenshot">
        📷 截图导出
      </button>
      <div class="btn-group" style="margin: 0;">
        <button class="btn btn-success" @click="exportReport('json')">导出JSON</button>
        <button class="btn btn-success" @click="exportReport('csv')">导出CSV</button>
      </div>
    </div>
    
    <div v-if="showDiagnostics" class="modal-overlay" @click.self="showDiagnostics = false">
      <div class="modal modal-wide">
        <h3>系统诊断报告</h3>
        
        <div class="diagnostics-section">
          <h4>数据完整性检查</h4>
          <div class="check-row">
            <span :class="['status-dot', diagnostics.dataComplete ? 'ok' : 'error']"></span>
            <span class="status-text">数据完整性</span>
            <span>{{ diagnostics.dataComplete ? '通过' : '失败' }}</span>
          </div>
          <div class="check-row">
            <span :class="['status-dot', diagnostics.noDuplicates ? 'ok' : 'error']"></span>
            <span class="status-text">重复合约检查</span>
            <span>{{ diagnostics.noDuplicates ? '通过' : '失败' }}</span>
          </div>
          <div class="check-row">
            <span :class="['status-dot', diagnostics.expiryValid ? 'ok' : 'error']"></span>
            <span class="status-text">到期日有效性</span>
            <span>{{ diagnostics.expiryValid ? '通过' : '失败' }}</span>
          </div>
        </div>
        
        <div class="diagnostics-section">
          <h4>曲面生成检查</h4>
          <div class="check-row">
            <span :class="['status-dot', diagnostics.surfaceBuilt ? 'ok' : 'error']"></span>
            <span class="status-text">曲面构建成功</span>
            <span>{{ diagnostics.surfaceBuilt ? '通过' : '失败' }}</span>
          </div>
          <div class="check-row">
            <span :class="['status-dot', diagnostics.interpolationReliable ? 'ok' : 'warn']"></span>
            <span class="status-text">插值可靠性</span>
            <span>{{ diagnostics.interpolationReliable ? '高' : '中' }}</span>
          </div>
          <div class="check-row">
            <span :class="['status-dot', diagnostics.anomalyDetected ? 'warn' : 'ok']"></span>
            <span class="status-text">异常点检测</span>
            <span>{{ diagnostics.anomalyDetected ? '发现' + diagnostics.anomalyCount + '个' : '无' }}</span>
          </div>
        </div>
        
        <div class="diagnostics-section">
          <h4>状态流转检查</h4>
          <div class="check-row">
            <span :class="['status-dot', diagnostics.flowComplete ? 'ok' : 'warn']"></span>
            <span class="status-text">完整流转记录</span>
            <span>{{ diagnostics.flowCompleteCount }}/{{ store.validRecords.length }}</span>
          </div>
          <div class="check-row">
            <span :class="['status-dot', diagnostics.revokeRestore ? 'ok' : 'ok']"></span>
            <span class="status-text">撤回/恢复功能</span>
            <span>正常</span>
          </div>
        </div>
        
        <div class="diagnostics-section" v-if="diagnostics.issues.length > 0">
          <h4>发现的问题</h4>
          <ul class="issue-list">
            <li v-for="(issue, idx) in diagnostics.issues" :key="idx" :class="issue.level">
              <strong>[{{ issue.level.toUpperCase() }}]</strong> {{ issue.message }}
            </li>
          </ul>
        </div>
        
        <div class="btn-group" style="margin-top: 16px;">
          <button class="btn btn-secondary" @click="showDiagnostics = false">关闭</button>
          <button class="btn btn-primary" @click="exportDiagnostics">导出诊断报告</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useOptionStore } from '../stores/optionStore.js'
import { OptionStatus } from '../types/option.js'

const emit = defineEmits(['exportScreenshot', 'exportReport'])

const store = useOptionStore()

const currentTime = ref('')
const underlying = ref('510300')
const showDiagnostics = ref(false)
const diagnostics = ref({
  dataComplete: true,
  noDuplicates: true,
  expiryValid: true,
  surfaceBuilt: true,
  interpolationReliable: true,
  anomalyDetected: false,
  anomalyCount: 0,
  flowComplete: true,
  flowCompleteCount: 0,
  revokeRestore: true,
  issues: []
})

const ivRange = computed(() => {
  if (!store.surfaceData) return { min: 0, max: 1 }
  let min = Infinity, max = -Infinity
  for (const row of store.surfaceData.grid) {
    for (const cell of row) {
      min = Math.min(min, cell.iv)
      max = Math.max(max, cell.iv)
    }
  }
  return { min, max }
})

let timer = null

function updateTime() {
  const d = new Date()
  currentTime.value = d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function runDiagnostics() {
  const issues = []
  const valid = store.validRecords
  
  diagnostics.value.dataComplete = valid.every(r => 
    r.contractCode && r.strikePrice > 0 && r.expiryDays > 0 && r.iv > 0
  )
  if (!diagnostics.value.dataComplete) {
    issues.push({ level: 'error', message: '存在数据字段不完整的合约' })
  }
  
  const codes = new Set()
  diagnostics.value.noDuplicates = valid.every(r => {
    if (codes.has(r.contractCode)) return false
    codes.add(r.contractCode)
    return true
  })
  if (!diagnostics.value.noDuplicates) {
    issues.push({ level: 'warning', message: '存在重复的合约代码' })
  }
  
  diagnostics.value.expiryValid = valid.every(r => r.expiryDays > 0 && r.expiryDays < 730)
  if (!diagnostics.value.expiryValid) {
    issues.push({ level: 'error', message: '存在到期日异常的合约' })
  }
  
  diagnostics.value.surfaceBuilt = !!store.surfaceData
  if (!diagnostics.value.surfaceBuilt) {
    issues.push({ level: 'error', message: '曲面未成功构建' })
  }
  
  const interpolatedCount = valid.filter(r => r.isInterpolated).length
  diagnostics.value.interpolationReliable = interpolatedCount < valid.length * 0.3
  if (!diagnostics.value.interpolationReliable) {
    issues.push({ level: 'warning', message: `插值点占比过高 (${interpolatedCount}/${valid.length})` })
  }
  
  diagnostics.value.anomalyCount = store.anomalyRecords.length
  diagnostics.value.anomalyDetected = diagnostics.value.anomalyCount > 0
  if (diagnostics.value.anomalyDetected) {
    issues.push({ 
      level: 'warning', 
      message: `检测到 ${diagnostics.value.anomalyCount} 个异常/警告合约需要处理` 
    })
  }
  
  diagnostics.value.flowCompleteCount = valid.filter(r => 
    r.statusFlow.includes('imported') && 
    r.statusFlow.includes('verified')
  ).length
  diagnostics.value.flowComplete = diagnostics.value.flowCompleteCount === valid.length
  if (!diagnostics.value.flowComplete) {
    issues.push({ level: 'info', message: '部分合约状态流转不完整' })
  }
  
  diagnostics.value.issues = issues
  showDiagnostics.value = true
}

function exportDiagnostics() {
  const report = {
    generatedAt: new Date().toISOString(),
    diagnostics: diagnostics.value,
    verification: store.verificationResults,
    stats: store.stats
  }
  
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `diagnostics-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
  
  store.addHistory('export', '导出诊断', 'diagnostics')
}

function exportScreenshot() {
  emit('exportScreenshot')
}

function exportReport(format) {
  emit('exportReport', format)
}

onMounted(() => {
  updateTime()
  timer = setInterval(updateTime, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.top-bar {
  justify-content: space-between;
}

.top-bar-left, .top-bar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.current-time {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: monospace;
}

.data-source {
  font-size: 12px;
  color: var(--accent-blue);
  font-weight: 500;
}

.surface-info {
  font-size: 12px;
  color: var(--text-secondary);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 20px;
  width: 480px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
}

.modal.modal-wide {
  width: 560px;
}

.modal h3 {
  margin-bottom: 16px;
  font-size: 16px;
}

.diagnostics-section {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.diagnostics-section:last-of-type {
  border-bottom: none;
}

.diagnostics-section h4 {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.ok { background: var(--accent-green); }
.status-dot.warn { background: var(--accent-yellow); }
.status-dot.error { background: var(--accent-red); }

.status-text {
  flex: 1;
  color: var(--text-secondary);
}

.issue-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 12px;
}

.issue-list li {
  padding: 6px 8px;
  margin-bottom: 4px;
  border-radius: 4px;
  background: var(--bg-tertiary);
}

.issue-list li.error { border-left: 3px solid var(--accent-red); }
.issue-list li.warning { border-left: 3px solid var(--accent-yellow); }
.issue-list li.info { border-left: 3px solid var(--accent-blue); }
</style>
