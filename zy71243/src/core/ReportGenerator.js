export class ReportGenerator {
  constructor(ledger, eventSystem, station) {
    this.ledger = ledger
    this.eventSystem = eventSystem
    this.station = station
  }

  generateFullReport() {
    const stats = this.ledger.calculateStatistics()
    const events = this.eventSystem.eventLog
    
    return {
      summary: this.generateSummary(stats),
      energyAnalysis: this.generateEnergyAnalysis(stats),
      eventTimeline: this.generateEventTimeline(events),
      loadAnalysis: this.generateLoadAnalysis(),
      batteryHealth: this.generateBatteryHealth(),
      recommendations: this.generateRecommendations(stats, events),
      score: this.calculateScore(stats, events)
    }
  }

  generateSummary(stats) {
    const grade = this.getGrade(stats.systemUptime)
    
    return {
      missionDuration: `${stats.totalTurns} 回合`,
      systemUptime: `${stats.systemUptime.toFixed(1)}%`,
      grade: grade,
      totalIncidents: stats.criticalIncidents,
      loadsShed: stats.totalLoadsShed,
      crewSurvived: this.station.crewAlive
    }
  }

  getGrade(uptime) {
    if (uptime >= 95) return 'S'
    if (uptime >= 85) return 'A'
    if (uptime >= 70) return 'B'
    if (uptime >= 50) return 'C'
    if (uptime >= 30) return 'D'
    return 'F'
  }

  generateEnergyAnalysis(stats) {
    const entries = this.ledger.entries
    
    const peakSolar = Math.max(...entries.map(e => e.solarOutput), 0)
    const peakLoad = Math.max(...entries.map(e => e.totalLoadDemand), 0)
    const minBattery = Math.min(...entries.map(e => e.batteryEndCharge), Infinity)
    
    return {
      averageSolarOutput: stats.avgSolarOutput.toFixed(2) + ' kW',
      peakSolarOutput: peakSolar.toFixed(2) + ' kW',
      averageLoad: stats.avgLoadDemand.toFixed(2) + ' kW',
      peakLoad: peakLoad.toFixed(2) + ' kW',
      minimumBatteryLevel: minBattery.toFixed(2) + ' kWh',
      overDischargeEvents: stats.overDischargeEvents,
      netEnergyBalance: entries.reduce((sum, e) => sum + e.netBalance, 0).toFixed(2) + ' kWh'
    }
  }

  generateEventTimeline(events) {
    return events.map(e => ({
      turn: e.turn,
      type: e.type,
      severity: e.severity,
      message: e.message,
      details: e.details
    }))
  }

  generateLoadAnalysis() {
    const loads = this.station.getAllLoads()
    
    return loads.map(load => ({
      name: load.name,
      category: load.category,
      priority: load.priority,
      powerDemand: load.powerDemand,
      reliability: load.getReliabilityScore().toFixed(1) + '%',
      totalDowntime: load.downtime + ' 小时',
      trips: load.trips,
      currentStatus: load.getStatusText()
    }))
  }

  generateBatteryHealth() {
    const batteries = this.station.getAllBatteries()
    
    return batteries.map(bat => ({
      name: bat.name,
      currentCharge: bat.currentCharge.toFixed(2) + ' kWh',
      effectiveCapacity: bat.effectiveCapacity.toFixed(2) + ' kWh',
      stateOfCharge: (bat.stateOfCharge * 100).toFixed(1) + '%',
      cycleCount: bat.cycleCount,
      overDischarges: bat.overDischargeCount,
      overCharges: bat.overChargeCount,
      temperature: bat.temperature + ' °C',
      healthStatus: bat.getHealthStatus(),
      damageLevel: (bat.damageLevel * 100).toFixed(0) + '%'
    }))
  }

  generateRecommendations(stats, events) {
    const recommendations = []
    
    if (stats.overDischargeEvents > 0) {
      recommendations.push({
        priority: 'high',
        category: 'battery',
        message: '电池组发生过放事件，建议增加备用电池容量或优化负载管理策略'
      })
    }
    
    if (stats.totalLoadsShed > 5) {
      recommendations.push({
        priority: 'high',
        category: 'power',
        message: `发生 ${stats.totalLoadsShed} 次负载断电，建议增加太阳能板或储能容量`
      })
    }
    
    const meteorStrikes = events.filter(e => e.type === 'meteor_strike').length
    if (meteorStrikes > 2) {
      recommendations.push({
        priority: 'medium',
        category: 'structure',
        message: `遭受 ${meteorStrikes} 次陨石撞击，建议规划舱段冗余设计`
      })
    }
    
    const criticalLoads = this.station.getAllLoads().filter(l => l.priority === 1)
    const unreliableCritical = criticalLoads.filter(l => l.getReliabilityScore() < 95)
    if (unreliableCritical.length > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'safety',
        message: `关键负载可靠性不足: ${unreliableCritical.map(l => l.name).join(', ')}`
      })
    }
    
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'low',
        category: 'general',
        message: '系统运行良好，无重大改进建议'
      })
    }
    
    return recommendations
  }

  calculateScore(stats, events) {
    let score = 1000
    
    score -= stats.criticalIncidents * 50
    score -= stats.overDischargeEvents * 20
    score -= stats.totalLoadsShed * 10
    
    const criticalLoads = this.station.getAllLoads().filter(l => l.priority === 1)
    criticalLoads.forEach(load => {
      if (load.getReliabilityScore() < 100) {
        score -= (100 - load.getReliabilityScore()) * 5
      }
    })
    
    if (!this.station.crewAlive) {
      score = 0
    }
    
    return Math.max(0, score)
  }

  exportReportAsText() {
    const report = this.generateFullReport()
    
    let text = '='.repeat(60) + '\n'
    text += '           太空电网配平 - 任务报告\n'
    text += '='.repeat(60) + '\n\n'
    
    text += '【任务概要】\n'
    text += `- 任务时长: ${report.summary.missionDuration}\n`
    text += `- 系统可用率: ${report.summary.systemUptime}\n`
    text += `- 评级: ${report.summary.grade}\n`
    text += `- 最终得分: ${report.score} 分\n`
    text += `- 乘员存活: ${report.summary.crewSurvived ? '是' : '否'}\n\n`
    
    text += '【能源分析】\n'
    for (const [key, value] of Object.entries(report.energyAnalysis)) {
      const label = this.translateKey(key)
      text += `- ${label}: ${value}\n`
    }
    text += '\n'
    
    text += '【负载分析】\n'
    report.loadAnalysis.forEach(load => {
      text += `  ${load.name} (${load.currentStatus}): 可靠性 ${load.reliability}\n`
    })
    text += '\n'
    
    text += '【改进建议】\n'
    report.recommendations.forEach(rec => {
      const priorityMark = rec.priority === 'critical' ? '!!' : rec.priority === 'high' ? '!' : ''
      text += `${priorityMark}[${rec.category.toUpperCase()}] ${rec.message}\n`
    })
    
    return text
  }

  translateKey(key) {
    const translations = {
      averageSolarOutput: '平均太阳能输出',
      peakSolarOutput: '峰值太阳能输出',
      averageLoad: '平均负载',
      peakLoad: '峰值负载',
      minimumBatteryLevel: '最低电池电量',
      overDischargeEvents: '过放事件数',
      netEnergyBalance: '净能量平衡'
    }
    return translations[key] || key
  }

  downloadReport(format = 'txt') {
    const report = this.generateFullReport()
    let content, filename, mimeType
    
    if (format === 'json') {
      content = JSON.stringify(report, null, 2)
      filename = 'power-grid-report.json'
      mimeType = 'application/json'
    } else if (format === 'csv') {
      content = this.ledger.exportToCSV()
      filename = 'power-grid-ledger.csv'
      mimeType = 'text/csv'
    } else {
      content = this.exportReportAsText()
      filename = 'power-grid-report.txt'
      mimeType = 'text/plain'
    }
    
    return { content, filename, mimeType }
  }
}
