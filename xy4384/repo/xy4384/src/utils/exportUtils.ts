import type {
  TestRound,
  AnalysisResult,
  ReviewRecord,
  RiskItem,
  SupportConfiguration,
  ExportOptions
} from '@/types'

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatSeverity(severity: string): string {
  const map: Record<string, string> = {
    low: '低',
    medium: '中',
    high: '高'
  }
  return map[severity] || severity
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    pending: '待处理',
    resolved: '已解决',
    ignored: '已忽略',
    normal: '正常',
    warning: '警告',
    critical: '严重'
  }
  return map[status] || status
}

export function generateMarkdownReport(
  testRound: TestRound,
  analysisResult: AnalysisResult | null,
  reviewRecord: ReviewRecord | null,
  supportConfig: SupportConfiguration | null,
  options?: ExportOptions
): string {
  const lines: string[] = []
  
  lines.push(`# 风洞实验复盘报告`)
  lines.push('')
  lines.push(`**测试编号**: ${testRound.testNumber}`)
  lines.push(`**测试名称**: ${testRound.testName}`)
  lines.push(`**模型名称**: ${testRound.modelName}`)
  lines.push(`**测试日期**: ${formatDate(testRound.testDate)}`)
  lines.push(`**开始时间**: ${testRound.startTime}`)
  lines.push(`**结束时间**: ${testRound.endTime}`)
  lines.push('')
  
  if (analysisResult) {
    lines.push(`## 分析概述`)
    lines.push('')
    lines.push(`**分析日期**: ${formatDate(analysisResult.analysisDate)}`)
    lines.push(`**整体状态**: ${formatStatus(analysisResult.overallStatus)}`)
    lines.push(`**摘要**: ${analysisResult.summary}`)
    lines.push('')
  }
  
  lines.push(`## 测试配置`)
  lines.push('')
  lines.push(`- **参考面积**: ${testRound.referenceArea} m²`)
  lines.push(`- **空气密度**: ${testRound.airDensity} kg/m³`)
  lines.push(`- **数据点数**: 风速 ${testRound.windSpeedProfile.length} 个, 六分力 ${testRound.forceData.length} 个`)
  
  if (supportConfig) {
    lines.push('')
    lines.push(`### 支架配置`)
    lines.push('')
    lines.push(`- **名称**: ${supportConfig.name}`)
    lines.push(`- **描述**: ${supportConfig.description || '无'}`)
    lines.push(`- **材料**: ${supportConfig.material}`)
    lines.push(`- **刚度**: ${supportConfig.stiffness}`)
    lines.push(`- **固有频率**: ${supportConfig.naturalFrequency} Hz`)
    lines.push(`- **阻尼比**: ${supportConfig.dampingRatio}`)
    lines.push(`- **安装方式**: ${supportConfig.mountingType}`)
  }
  
  if (testRound.sensorCalibrations.length > 0) {
    lines.push('')
    lines.push(`### 传感器校准信息`)
    lines.push('')
    lines.push(`| 传感器ID | 传感器名称 | 校准日期 | 有效期至 | 校准因子 |`)
    lines.push(`|----------|------------|----------|----------|----------|`)
    for (const cal of testRound.sensorCalibrations) {
      lines.push(`| ${cal.sensorId} | ${cal.sensorName} | ${cal.calibrationDate} | ${cal.expirationDate} | ${cal.calibrationFactor} |`)
    }
  }
  
  if (analysisResult) {
    if (analysisResult.dragCoefficientDrifts.length > 0) {
      lines.push('')
      lines.push(`## 阻力系数漂移`)
      lines.push('')
      lines.push(`| 严重程度 | 漂移量 | 漂移百分比 | 基线值 | 当前值 | 开始时间 | 结束时间 | 状态 |`)
      lines.push(`|----------|--------|------------|--------|--------|----------|----------|------|`)
      for (const drift of analysisResult.dragCoefficientDrifts) {
        const status = drift.isRejected ? '已驳回' : '待复核'
        lines.push(`| ${formatSeverity(drift.severity)} | ${drift.driftAmount.toFixed(6)} | ${drift.driftPercentage.toFixed(2)}% | ${drift.baselineValue.toFixed(6)} | ${drift.currentValue.toFixed(6)} | ${drift.startTime} | ${drift.endTime} | ${status} |`)
      }
    }
    
    if (analysisResult.resonanceWindows.length > 0) {
      lines.push('')
      lines.push(`## 支架共振窗口`)
      lines.push('')
      lines.push(`| 严重程度 | 频率范围 | 振幅 | 风速范围 | 置信度 | 状态 |`)
      lines.push(`|----------|----------|------|----------|--------|------|`)
      for (const resonance of analysisResult.resonanceWindows) {
        const status = resonance.isRejected ? '已驳回' : '待复核'
        lines.push(`| ${formatSeverity(resonance.severity)} | ${resonance.frequencyStart.toFixed(1)} - ${resonance.frequencyEnd.toFixed(1)} Hz | ${resonance.amplitude.toFixed(3)} | ${resonance.windSpeedRange.min.toFixed(1)} - ${resonance.windSpeedRange.max.toFixed(1)} m/s | ${(resonance.confidence * 100).toFixed(0)}% | ${status} |`)
      }
    }
    
    if (analysisResult.calibrationAlerts.length > 0) {
      lines.push('')
      lines.push(`## 校准过期警告`)
      lines.push('')
      lines.push(`| 传感器 | 剩余天数 | 校准日期 | 有效期至 | 状态 |`)
      lines.push(`|--------|----------|----------|----------|------|`)
      for (const alert of analysisResult.calibrationAlerts) {
        const status = alert.isRejected ? '已驳回' : (alert.isExpired ? '已过期' : '即将过期')
        lines.push(`| ${alert.sensorName} (${alert.sensorId}) | ${alert.daysUntilExpiration} 天 | ${alert.calibrationDate} | ${alert.expirationDate} | ${status} |`)
      }
    }
    
    if (analysisResult.anomalySpikes.length > 0) {
      lines.push('')
      lines.push(`## 异常尖峰`)
      lines.push('')
      lines.push(`| 严重程度 | 力类型 | 值 | 基线值 | 偏差 | 当时风速 | 时间戳 | 状态 |`)
      lines.push(`|----------|--------|-----|--------|------|----------|--------|------|`)
      const forceTypeNames: Record<string, string> = {
        fx: 'X向力', fy: 'Y向力', fz: 'Z向力',
        mx: 'X向力矩', my: 'Y向力矩', mz: 'Z向力矩'
      }
      for (const spike of analysisResult.anomalySpikes) {
        const status = spike.isRejected ? '已驳回' : '待复核'
        const typeName = forceTypeNames[spike.forceType] || spike.forceType
        lines.push(`| ${formatSeverity(spike.severity)} | ${typeName} | ${spike.value.toFixed(4)} | ${spike.baselineValue.toFixed(4)} | ${spike.deviationPercentage.toFixed(2)}% | ${spike.windSpeedAtTime.toFixed(1)} m/s | ${spike.timestamp} | ${status} |`)
      }
    }
  }
  
  if (testRound.manualNotes.length > 0) {
    lines.push('')
    lines.push(`## 人工备注`)
    lines.push('')
    for (const note of testRound.manualNotes) {
      lines.push(`### ${formatStatus(note.category)} - ${formatDate(note.timestamp.toString())}`)
      lines.push('')
      lines.push(`**作者**: ${note.author}`)
      lines.push('')
      lines.push(note.content)
      lines.push('')
    }
  }
  
  if (reviewRecord) {
    lines.push('')
    lines.push(`## 复核记录`)
    lines.push('')
    lines.push(`**复核人**: ${reviewRecord.reviewer}`)
    lines.push(`**复核日期**: ${formatDate(reviewRecord.reviewDate)}`)
    lines.push(`**复核状态**: ${reviewRecord.status === 'approved' ? '已通过' : reviewRecord.status === 'approved_with_notes' ? '有条件通过' : reviewRecord.status === 'rejected' ? '已驳回' : '待复核'}`)
    lines.push('')
    lines.push(`### 复核意见`)
    lines.push('')
    lines.push(reviewRecord.comments || '无')
    lines.push('')
    
    if (reviewRecord.decisions.length > 0) {
      lines.push(`### 改判记录`)
      lines.push('')
      lines.push(`| 类型 | 项目ID | 决定 | 原因 |`)
      lines.push(`|------|--------|------|------|`)
      const typeNames: Record<string, string> = {
        drift: '阻力系数漂移',
        resonance: '共振窗口',
        calibration: '校准警告',
        spike: '异常尖峰'
      }
      const decisionNames: Record<string, string> = {
        accept: '接受',
        reject: '驳回',
        further_investigation: '进一步调查'
      }
      for (const decision of reviewRecord.decisions) {
        lines.push(`| ${typeNames[decision.type] || decision.type} | ${decision.itemId} | ${decisionNames[decision.decision] || decision.decision} | ${decision.reason || '无'} |`)
      }
    }
  }
  
  lines.push('')
  lines.push(`---`)
  lines.push(`*报告生成时间: ${formatDate(new Date().toISOString())}*`)
  
  return lines.join('\n')
}

export function generateRiskCSV(
  riskItems: RiskItem[]
): string {
  const lines: string[] = []
  
  lines.push('ID,测试编号,类别,描述,严重程度,状态,解决人,解决时间,备注')
  
  for (const item of riskItems) {
    const resolvedBy = item.resolvedBy || ''
    const resolvedAt = item.resolvedAt ? formatDate(item.resolvedAt) : ''
    const notes = (item.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')
    
    lines.push([
      item.id,
      item.testNumber,
      item.category,
      `"${item.description.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      formatSeverity(item.severity),
      formatStatus(item.status),
      resolvedBy,
      resolvedAt,
      `"${notes}"`
    ].join(','))
  }
  
  return lines.join('\n')
}

export function generateJSONAuditPackage(
  testRounds: TestRound[],
  analysisResults: AnalysisResult[],
  reviewRecords: ReviewRecord[],
  riskItems: RiskItem[],
  supportConfigs: SupportConfiguration[]
): string {
  const auditPackage = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    summary: {
      totalTests: testRounds.length,
      totalAnalysis: analysisResults.length,
      totalReviews: reviewRecords.length,
      totalRisks: riskItems.length,
      pendingRisks: riskItems.filter(r => r.status === 'pending').length,
      resolvedRisks: riskItems.filter(r => r.status === 'resolved').length,
      ignoredRisks: riskItems.filter(r => r.status === 'ignored').length
    },
    testRounds,
    analysisResults,
    reviewRecords,
    riskItems,
    supportConfigs
  }
  
  return JSON.stringify(auditPackage, null, 2)
}

export function downloadFile(
  content: string,
  filename: string,
  mimeType: string = 'text/plain'
): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportMarkdownReport(
  testRound: TestRound,
  analysisResult: AnalysisResult | null,
  reviewRecord: ReviewRecord | null,
  supportConfig: SupportConfiguration | null
): void {
  const content = generateMarkdownReport(testRound, analysisResult, reviewRecord, supportConfig)
  const filename = `复盘报告_${testRound.testNumber}_${new Date().toISOString().slice(0, 10)}.md`
  downloadFile(content, filename, 'text/markdown')
}

export function exportRiskCSV(
  riskItems: RiskItem[]
): void {
  const content = generateRiskCSV(riskItems)
  const filename = `风险清单_${new Date().toISOString().slice(0, 10)}.csv`
  downloadFile(content, filename, 'text/csv')
}

export function exportJSONAuditPackage(
  testRounds: TestRound[],
  analysisResults: AnalysisResult[],
  reviewRecords: ReviewRecord[],
  riskItems: RiskItem[],
  supportConfigs: SupportConfiguration[]
): void {
  const content = generateJSONAuditPackage(
    testRounds,
    analysisResults,
    reviewRecords,
    riskItems,
    supportConfigs
  )
  const filename = `审计包_${new Date().toISOString().slice(0, 10)}.json`
  downloadFile(content, filename, 'application/json')
}
