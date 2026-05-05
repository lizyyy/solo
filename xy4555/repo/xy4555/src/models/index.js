export const DataTypes = {
  TUNNEL_SECTIONS: 'tunnel_sections',
  GAS_SENSORS: 'gas_sensors',
  INSPECTION_TICKETS: 'inspection_tickets',
  MANHOLE_RECORDS: 'manhole_records',
  RISK_MARKERS: 'risk_markers',
  JUDGMENT_NOTES: 'judgment_notes'
}

export const RiskTypes = {
  OXYGEN_DEFICIENCY: 'oxygen_deficiency',
  FLAMMABLE_GAS: 'flammable_gas',
  WATER_ACCUMULATION: 'water_accumulation',
  UNOPENED_TICKET: 'unopened_ticket'
}

export const RiskColors = {
  [RiskTypes.OXYGEN_DEFICIENCY]: 0xf56c6c,
  [RiskTypes.FLAMMABLE_GAS]: 0xe6a23c,
  [RiskTypes.WATER_ACCUMULATION]: 0x409eff,
  [RiskTypes.UNOPENED_TICKET]: 0x909399
}

export class TunnelSection {
  constructor(data = {}) {
    this.id = data.id || ''
    this.name = data.name || ''
    this.code = data.code || ''
    this.startPoint = data.startPoint || { x: 0, y: 0, z: 0 }
    this.endPoint = data.endPoint || { x: 0, y: 0, z: 0 }
    this.width = data.width || 3
    this.height = data.height || 2.5
    this.depth = data.depth || -5
    this.description = data.description || ''
    this.sensors = data.sensors || []
    this.manholes = data.manholes || []
    this.notes = data.notes || []
  }
}

export class GasSensor {
  constructor(data = {}) {
    this.id = data.id || ''
    this.code = data.code || ''
    this.name = data.name || ''
    this.sectionId = data.sectionId || ''
    this.position = data.position || { x: 0, y: 0, z: 0 }
    this.type = data.type || 'multi_gas'
    this.oxygenLevel = data.oxygenLevel !== undefined ? data.oxygenLevel : 20.9
    this.flammableGasLevel = data.flammableGasLevel !== undefined ? data.flammableGasLevel : 0
    this.h2sLevel = data.h2sLevel !== undefined ? data.h2sLevel : 0
    this.coLevel = data.coLevel !== undefined ? data.coLevel : 0
    this.temperature = data.temperature !== undefined ? data.temperature : 20
    this.humidity = data.humidity !== undefined ? data.humidity : 60
    this.lastUpdate = data.lastUpdate || new Date().toISOString()
    this.alarmStatus = data.alarmStatus || 'normal'
  }

  hasOxygenRisk() {
    return this.oxygenLevel < 19.5 || this.oxygenLevel > 23.5
  }

  hasFlammableGasRisk() {
    return this.flammableGasLevel > 10
  }

  getRiskStatus() {
    const risks = []
    if (this.hasOxygenRisk()) {
      risks.push({
        type: RiskTypes.OXYGEN_DEFICIENCY,
        level: 'high',
        message: `氧含量异常: ${this.oxygenLevel}%`,
        value: this.oxygenLevel
      })
    }
    if (this.hasFlammableGasRisk()) {
      risks.push({
        type: RiskTypes.FLAMMABLE_GAS,
        level: 'high',
        message: `可燃气体超标: ${this.flammableGasLevel}%LEL`,
        value: this.flammableGasLevel
      })
    }
    return risks
  }
}

export class InspectionTicket {
  constructor(data = {}) {
    this.id = data.id || ''
    this.ticketNo = data.ticketNo || ''
    this.sectionId = data.sectionId || ''
    this.sectionName = data.sectionName || ''
    this.manholeId = data.manholeId || ''
    this.inspectionType = data.inspectionType || 'routine'
    this.status = data.status || 'pending'
    this.createdAt = data.createdAt || new Date().toISOString()
    this.scheduledTime = data.scheduledTime || ''
    this.inspector = data.inspector || ''
    this.items = data.items || []
    this.findings = data.findings || ''
    this.photos = data.photos || []
    this.closedAt = data.closedAt || ''
    this.closingRemark = data.closingRemark || ''
  }

  isUnclosed() {
    return this.status !== 'completed' && this.status !== 'closed'
  }

  isOverdue() {
    if (!this.scheduledTime) return false
    const scheduled = new Date(this.scheduledTime)
    const now = new Date()
    return now > scheduled && this.isUnclosed()
  }
}

export class ManholeRecord {
  constructor(data = {}) {
    this.id = data.id || ''
    this.manholeNo = data.manholeNo || ''
    this.sectionId = data.sectionId || ''
    this.position = data.position || { x: 0, y: 0, z: 0 }
    this.openTime = data.openTime || ''
    this.closeTime = data.closeTime || ''
    this.operator = data.operator || ''
    this.purpose = data.purpose || ''
    this.photos = data.photos || []
    this.status = data.status || 'closed'
    this.notes = data.notes || ''
  }

  isOpen() {
    return this.status === 'open' || !this.closeTime
  }
}

export class RiskMarker {
  constructor(data = {}) {
    this.id = data.id || ''
    this.type = data.type || ''
    this.sectionId = data.sectionId || ''
    this.position = data.position || { x: 0, y: 0, z: 0 }
    this.level = data.level || 'high'
    this.message = data.message || ''
    this.sourceType = data.sourceType || ''
    this.sourceId = data.sourceId || ''
    this.createdAt = data.createdAt || new Date().toISOString()
    this.judgment = data.judgment || null
  }
}

export class JudgmentNote {
  constructor(data = {}) {
    this.id = data.id || ''
    this.riskId = data.riskId || ''
    this.sectionId = data.sectionId || ''
    this.judgment = data.judgment || 'confirm'
    this.remark = data.remark || ''
    this.operator = data.operator || ''
    this.createdAt = data.createdAt || new Date().toISOString()
    this.photos = data.photos || []
    this.evidences = data.evidences || []
  }
}
