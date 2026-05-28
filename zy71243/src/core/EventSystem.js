export const EventType = {
  METEOR_STRIKE: 'meteor_strike',
  SOLAR_FLARE: 'solar_flare',
  EQUIPMENT_FAILURE: 'equipment_failure',
  THERMAL_CYCLING: 'thermal_cycling',
  CREW_ERROR: 'crew_error'
}

export class EventLogEntry {
  constructor(turn, type, severity, message, details = {}) {
    this.turn = turn
    this.timestamp = new Date()
    this.type = type
    this.severity = severity
    this.message = message
    this.details = details
    this.acknowledged = false
  }
}

export class EventSystem {
  constructor(station) {
    this.station = station
    this.eventLog = []
    this.eventQueue = []
    this.pendingEvents = []
  }

  generateRandomEvent(turn) {
    const rand = Math.random()
    
    if (rand < 0.15) {
      return this.createMeteorStrike(turn)
    } else if (rand < 0.25) {
      return this.createSolarFlare(turn)
    } else if (rand < 0.35) {
      return this.createEquipmentFailure(turn)
    }
    
    return null
  }

  createMeteorStrike(turn) {
    const modules = this.station.modules.filter(m => m.status === 'operational')
    if (modules.length === 0) return null

    const targetModule = modules[Math.floor(Math.random() * modules.length)]
    const damage = 10 + Math.random() * 30
    
    const targets = [
      ...targetModule.solarPanels,
      ...targetModule.batteries
    ]
    
    const hitTarget = targets.length > 0 
      ? targets[Math.floor(Math.random() * targets.length)]
      : null

    const event = new EventLogEntry(
      turn,
      EventType.METEOR_STRIKE,
      'high',
      `陨石撞击 ${targetModule.name}`,
      {
        moduleId: targetModule.id,
        damage: damage,
        targetType: hitTarget?.constructor.name || 'hull',
        targetId: hitTarget?.id || null
      }
    )

    this.pendingEvents.push(event)
    return event
  }

  createSolarFlare(turn) {
    const event = new EventLogEntry(
      turn,
      EventType.SOLAR_FLARE,
      'medium',
      '太阳耀斑活动增强，太阳能输出临时提升',
      {
        outputBoost: 1.3 + Math.random() * 0.4,
        duration: 2 + Math.floor(Math.random() * 3)
      }
    )

    this.pendingEvents.push(event)
    return event
  }

  createEquipmentFailure(turn) {
    const panels = this.station.getAllSolarPanels().filter(p => p.status === 'operational')
    const batteries = this.station.getAllBatteries().filter(b => b.status === 'operational')
    const allEquipment = [...panels, ...batteries]
    
    if (allEquipment.length === 0) return null

    const target = allEquipment[Math.floor(Math.random() * allEquipment.length)]
    const isSolar = 'tiltAngle' in target

    const event = new EventLogEntry(
      turn,
      EventType.EQUIPMENT_FAILURE,
      'medium',
      `${isSolar ? '太阳能板' : '电池组'} ${target.name} 性能下降`,
      {
        equipmentId: target.id,
        equipmentType: isSolar ? 'solar_panel' : 'battery',
        degradation: 0.1 + Math.random() * 0.2
      }
    )

    this.pendingEvents.push(event)
    return event
  }

  applyEvent(event) {
    switch (event.type) {
      case EventType.METEOR_STRIKE:
        this.applyMeteorStrike(event)
        break
      case EventType.SOLAR_FLARE:
        this.applySolarFlare(event)
        break
      case EventType.EQUIPMENT_FAILURE:
        this.applyEquipmentFailure(event)
        break
    }
    
    this.eventLog.push(event)
    return event
  }

  applyMeteorStrike(event) {
    const module = this.station.getModule(event.details.moduleId)
    if (!module) return

    module.applyHullDamage(event.details.damage)

    if (event.details.targetType === 'SolarPanel') {
      const panel = module.solarPanels.find(p => p.id === event.details.targetId)
      if (panel) panel.applyDamage(0.3)
    } else if (event.details.targetType === 'Battery') {
      const battery = module.batteries.find(b => b.id === event.details.targetId)
      if (battery) battery.applyDamage(0.3)
    }
  }

  applySolarFlare(event) {
    this.station.sunAngle = Math.min(120, this.station.sunAngle + 20)
  }

  applyEquipmentFailure(event) {
    const panels = this.station.getAllSolarPanels()
    const batteries = this.station.getAllBatteries()
    const equipment = [...panels, ...batteries].find(e => e.id === event.details.equipmentId)
    
    if (equipment) {
      equipment.applyDamage(event.details.degradation)
    }
  }

  processPendingEvents(turn) {
    const processed = []
    for (const event of this.pendingEvents) {
      this.applyEvent(event)
      processed.push(event)
    }
    this.pendingEvents = []
    return processed
  }

  getEventsForTurn(turn) {
    return this.eventLog.filter(e => e.turn === turn)
  }

  getRecentEvents(count = 10) {
    return this.eventLog.slice(-count)
  }

  getUnacknowledgedEvents() {
    return this.eventLog.filter(e => !e.acknowledged)
  }

  acknowledgeEvent(eventIndex) {
    if (this.eventLog[eventIndex]) {
      this.eventLog[eventIndex].acknowledged = true
    }
  }
}
