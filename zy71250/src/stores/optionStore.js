import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { 
  createOptionRecord, 
  detectAnomaly, 
  generateSurfaceGrid,
  OptionStatus,
  StatusFlow
} from '../types/option.js'

function generateMockData() {
  const today = new Date()
  const expiries = [7, 14, 30, 60, 90, 180, 365]
  const strikes = [3.5, 3.7, 3.9, 4.0, 4.1, 4.3, 4.5]
  const records = []
  
  let id = 1
  
  for (const expiry of expiries) {
    const expiryDate = new Date(today.getTime() + expiry * 24 * 60 * 60 * 1000)
    const expiryStr = expiryDate.toISOString().slice(0, 10)
    const atmIv = 0.15 + expiry * 0.0003
    
    for (const strike of strikes) {
      const moneyness = Math.log(strike / 4.0)
      const smileAdjust = 0.08 * moneyness * moneyness
      const randomNoise = (Math.random() - 0.5) * 0.02
      
      let iv = atmIv + smileAdjust + randomNoise
      let volume = Math.floor(Math.random() * 5000) + 100
      
      if (id === 15) {
        iv = 0.85
        volume = 50
      }
      if (id === 23) {
        iv = 0.005
        volume = 10
      }
      if (id === 35) {
        iv = 0.45
      }
      
      records.push(createOptionRecord({
        id: `OPT_${String(id).padStart(4, '0')}`,
        contractCode: `HO_${strike.toFixed(1)}_${expiryStr}`,
        underlying: '510300',
        strikePrice: strike,
        expiryDate: expiryStr,
        expiryDays: expiry,
        iv: Math.max(0.01, iv),
        volume,
        openInterest: Math.floor(volume * (0.5 + Math.random() * 2)),
        createdAt: today.getTime() - Math.random() * 86400000
      }))
      
      id++
    }
  }
  
  return records
}

export const useOptionStore = defineStore('option', () => {
  const records = ref([])
  const selectedRecordId = ref(null)
  const surfaceData = ref(null)
  const filters = ref({
    status: 'all',
    minExpiry: null,
    maxExpiry: null,
    minStrike: null,
    maxStrike: null,
    showInterpolated: true,
    showAnomalies: true
  })
  const sliceView = ref({
    type: 'expiry',
    value: 30,
    enabled: false
  })
  const verificationResults = ref(null)
  const operationHistory = ref([])
  
  const validRecords = computed(() => 
    records.value.filter(r => r.status !== OptionStatus.REVOKED)
  )
  
  const filteredRecords = computed(() => {
    let result = validRecords.value
    
    if (filters.value.status !== 'all') {
      result = result.filter(r => r.status === filters.value.status)
    }
    if (filters.value.minExpiry !== null) {
      result = result.filter(r => r.expiryDays >= filters.value.minExpiry)
    }
    if (filters.value.maxExpiry !== null) {
      result = result.filter(r => r.expiryDays <= filters.value.maxExpiry)
    }
    if (filters.value.minStrike !== null) {
      result = result.filter(r => r.strikePrice >= filters.value.minStrike)
    }
    if (filters.value.maxStrike !== null) {
      result = result.filter(r => r.strikePrice <= filters.value.maxStrike)
    }
    if (!filters.value.showInterpolated) {
      result = result.filter(r => !r.isInterpolated)
    }
    
    return result
  })
  
  const anomalyRecords = computed(() => 
    validRecords.value.filter(r => 
      r.status === OptionStatus.ANOMALY || r.status === OptionStatus.WARNING
    )
  )
  
  const stats = computed(() => ({
    total: validRecords.value.length,
    normal: validRecords.value.filter(r => r.status === OptionStatus.NORMAL).length,
    warning: validRecords.value.filter(r => r.status === OptionStatus.WARNING).length,
    anomaly: validRecords.value.filter(r => r.status === OptionStatus.ANOMALY).length,
    pending: validRecords.value.filter(r => r.status === OptionStatus.PENDING).length,
    avgIv: validRecords.value.length > 0 
      ? validRecords.value.reduce((s, r) => s + r.iv, 0) / validRecords.value.length 
      : 0,
    totalVolume: validRecords.value.reduce((s, r) => s + r.volume, 0)
  }))
  
  const selectedRecord = computed(() => 
    records.value.find(r => r.id === selectedRecordId.value) || null
  )
  
  function initMockData() {
    records.value = generateMockData()
    runFullValidation()
    updateSurface()
    addHistory('init', '加载示例数据', records.value.length + '条合约')
  }
  
  function addRecord(data) {
    const record = createOptionRecord(data)
    record.history.push({
      action: 'create',
      timestamp: Date.now(),
      details: '手动补录'
    })
    records.value.push(record)
    runFullValidation()
    updateSurface()
    addHistory('add', '补录合约', record.contractCode)
    return record
  }
  
  function updateRecord(id, updates) {
    const idx = records.value.findIndex(r => r.id === id)
    if (idx === -1) return null
    
    const record = records.value[idx]
    record.history.push({
      action: 'update',
      timestamp: Date.now(),
      before: { ...record },
      after: { ...updates }
    })
    
    Object.assign(record, updates, { updatedAt: Date.now() })
    
    if (!record.statusFlow.includes('interpolated')) {
      record.statusFlow.push('interpolated')
    }
    
    runFullValidation()
    updateSurface()
    addHistory('update', '更新合约', record.contractCode)
    return record
  }
  
  function revokeRecord(id) {
    const idx = records.value.findIndex(r => r.id === id)
    if (idx === -1) return null
    
    const record = records.value[idx]
    record.history.push({
      action: 'revoke',
      timestamp: Date.now(),
      details: '撤回合约'
    })
    
    record.status = OptionStatus.REVOKED
    record.statusFlow = [...record.statusFlow, 'revoked']
    record.updatedAt = Date.now()
    
    runFullValidation()
    updateSurface()
    addHistory('revoke', '撤回合约', record.contractCode)
    return record
  }
  
  function restoreRecord(id) {
    const idx = records.value.findIndex(r => r.id === id)
    if (idx === -1) return null
    
    const record = records.value[idx]
    record.history.push({
      action: 'restore',
      timestamp: Date.now(),
      details: '恢复合约'
    })
    
    record.statusFlow = record.statusFlow.filter(s => s !== 'revoked')
    record.updatedAt = Date.now()
    
    runFullValidation()
    updateSurface()
    addHistory('restore', '恢复合约', record.contractCode)
    return record
  }
  
  function runFullValidation() {
    const checks = {
      interpolationCheck: { passed: true, issues: [] },
      expiryOrderCheck: { passed: true, issues: [] },
      anomalyOcclusionCheck: { passed: true, issues: [] },
      statusFlowCheck: { passed: true, issues: [] }
    }
    
    for (const record of records.value) {
      if (record.status === OptionStatus.REVOKED) continue
      
      const result = detectAnomaly(record, records.value)
      record.anomalyScore = result.score
      record.anomalyReason = result.reasons
      record.status = result.status
      
      if (!record.statusFlow.includes('verified')) {
        record.statusFlow.push('verified')
      }
      
      if (record.isInterpolated && record.iv > 0.5) {
        checks.interpolationCheck.issues.push(
          `${record.contractCode}: 插值IV过高 ${(record.iv * 100).toFixed(1)}%`
        )
        checks.interpolationCheck.passed = false
      }
      
      if (record.expiryDays < 1 || record.expiryDays > 730) {
        checks.expiryOrderCheck.issues.push(
          `${record.contractCode}: 到期日异常 ${record.expiryDays}天`
        )
        checks.expiryOrderCheck.passed = false
      }
      
      if (result.status === OptionStatus.ANOMALY && record.volume > 1000) {
        checks.anomalyOcclusionCheck.issues.push(
          `${record.contractCode}: 高成交量异常 ${record.volume}手`
        )
        checks.anomalyOcclusionCheck.passed = false
      }
      
      if (record.status === OptionStatus.ANOMALY && !record.anomalyReason) {
        checks.statusFlowCheck.issues.push(
          `${record.contractCode}: 状态流转异常`
        )
        checks.statusFlowCheck.passed = false
      }
    }
    
    const allExpiries = [...new Set(validRecords.value.map(r => r.expiryDays))].sort((a, b) => a - b)
    for (let i = 1; i < allExpiries.length; i++) {
      if (allExpiries[i] <= allExpiries[i - 1]) {
        checks.expiryOrderCheck.issues.push(`到期序列排序错误: ${allExpiries[i - 1]} -> ${allExpiries[i]}`)
        checks.expiryOrderCheck.passed = false
      }
    }
    
    verificationResults.value = checks
    return checks
  }
  
  function updateSurface() {
    surfaceData.value = generateSurfaceGrid(filteredRecords.value, 25)
    return surfaceData.value
  }
  
  function setFilter(key, value) {
    filters.value[key] = value
    updateSurface()
  }
  
  function resetFilters() {
    filters.value = {
      status: 'all',
      minExpiry: null,
      maxExpiry: null,
      minStrike: null,
      maxStrike: null,
      showInterpolated: true,
      showAnomalies: true
    }
    updateSurface()
  }
  
  function setSliceView(enabled, type, value) {
    sliceView.value = { enabled, type, value }
  }
  
  function selectRecord(id) {
    selectedRecordId.value = id
  }
  
  function addHistory(action, label, detail) {
    operationHistory.value.unshift({
      id: Date.now(),
      action,
      label,
      detail,
      timestamp: Date.now()
    })
    if (operationHistory.value.length > 50) {
      operationHistory.value = operationHistory.value.slice(0, 50)
    }
  }
  
  function exportReport(format = 'json') {
    const reportData = {
      generatedAt: new Date().toISOString(),
      stats: stats.value,
      verification: verificationResults.value,
      records: validRecords.value,
      anomalies: anomalyRecords.value.map(r => ({
        contractCode: r.contractCode,
        strikePrice: r.strikePrice,
        expiryDays: r.expiryDays,
        iv: r.iv,
        anomalyScore: r.anomalyScore,
        anomalyReason: r.anomalyReason,
        status: r.status
      }))
    }
    
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `volatility-report-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } else if (format === 'csv') {
      let csv = '合约代码,标的,行权价,到期日,剩余天数,IV,成交量,持仓量,状态,异常分\n'
      for (const r of validRecords.value) {
        csv += `${r.contractCode},${r.underlying},${r.strikePrice},${r.expiryDate},${r.expiryDays},${r.iv.toFixed(4)},${r.volume},${r.openInterest},${r.status},${r.anomalyScore}\n`
      }
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `volatility-data-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
    
    addHistory('export', '导出报告', format)
    return reportData
  }
  
  function bulkImport(dataArray) {
    let count = 0
    for (const data of dataArray) {
      try {
        const record = createOptionRecord(data)
        record.history.push({
          action: 'import',
          timestamp: Date.now(),
          details: '批量导入'
        })
        records.value.push(record)
        count++
      } catch (e) {
        console.error('Import error:', e)
      }
    }
    runFullValidation()
    updateSurface()
    addHistory('import', '批量导入', `${count}条记录`)
    return count
  }
  
  return {
    records,
    selectedRecordId,
    surfaceData,
    filters,
    sliceView,
    verificationResults,
    operationHistory,
    validRecords,
    filteredRecords,
    anomalyRecords,
    stats,
    selectedRecord,
    initMockData,
    addRecord,
    updateRecord,
    revokeRecord,
    restoreRecord,
    runFullValidation,
    updateSurface,
    setFilter,
    resetFilters,
    setSliceView,
    selectRecord,
    exportReport,
    bulkImport
  }
})
