export class LedgerEntry {
  constructor(turn, timestamp) {
    this.turn = turn
    this.timestamp = timestamp
    this.sunAngle = 0
    this.solarOutput = 0
    this.totalLoadDemand = 0
    this.poweredLoads = 0
    this.unpoweredLoads = 0
    this.batteryStartCharge = 0
    this.batteryEndCharge = 0
    this.batteryDelta = 0
    this.batteryOverDischargeEvents = 0
    this.batteryOverChargeEvents = 0
    this.loadsShed = []
    this.events = []
    this.netBalance = 0
    this.status = 'normal'
  }
}

export class EnergyLedger {
  constructor() {
    this.entries = []
    this.startTime = new Date()
  }

  createEntry(turn) {
    const entry = new LedgerEntry(turn, new Date())
    this.entries.push(entry)
    return entry
  }

  getCurrentEntry() {
    return this.entries[this.entries.length - 1]
  }

  getEntry(turn) {
    return this.entries.find(e => e.turn === turn)
  }

  getLastNEntries(n) {
    return this.entries.slice(-n)
  }

  calculateStatistics() {
    if (this.entries.length === 0) return null

    const totalSolar = this.entries.reduce((sum, e) => sum + e.solarOutput, 0)
    const totalLoad = this.entries.reduce((sum, e) => sum + e.totalLoadDemand, 0)
    const totalShed = this.entries.reduce((sum, e) => sum + e.loadsShed.length, 0)
    const avgSoc = this.entries.reduce((sum, e) => sum + e.batteryEndCharge, 0) / this.entries.length
    const overDischargeEvents = this.entries.reduce((sum, e) => sum + e.batteryOverDischargeEvents, 0)
    
    const criticalEntries = this.entries.filter(e => e.status === 'critical').length
    const uptime = this.entries.filter(e => e.status !== 'failed').length / this.entries.length * 100

    return {
      totalTurns: this.entries.length,
      avgSolarOutput: totalSolar / this.entries.length,
      avgLoadDemand: totalLoad / this.entries.length,
      totalLoadsShed: totalShed,
      avgStateOfCharge: avgSoc,
      overDischargeEvents: overDischargeEvents,
      criticalIncidents: criticalEntries,
      systemUptime: uptime
    }
  }

  exportToCSV() {
    const headers = [
      '回合', '时间', '太阳角度', '太阳能输出', '总负载需求',
      '供电负载数', '断电负载数', '电池起始电量', '电池结束电量',
      '电池变化', '过放事件', '过充事件', '切断负载', '系统状态'
    ]
    
    const rows = this.entries.map(e => [
      e.turn,
      e.timestamp.toISOString(),
      e.sunAngle.toFixed(1),
      e.solarOutput.toFixed(2),
      e.totalLoadDemand.toFixed(2),
      e.poweredLoads,
      e.unpoweredLoads,
      e.batteryStartCharge.toFixed(2),
      e.batteryEndCharge.toFixed(2),
      e.batteryDelta.toFixed(2),
      e.batteryOverDischargeEvents,
      e.batteryOverChargeEvents,
      e.loadsShed.map(l => l.name).join('; '),
      e.status
    ])

    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  exportToJSON() {
    return JSON.stringify({
      startTime: this.startTime,
      entryCount: this.entries.length,
      statistics: this.calculateStatistics(),
      entries: this.entries
    }, null, 2)
  }
}
