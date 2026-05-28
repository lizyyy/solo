import { Module } from './Module.js'
import { SolarPanel } from './SolarPanel.js'
import { Battery } from './Battery.js'
import { Load, LoadPriority } from './Load.js'

export class SpaceStation {
  constructor(id, name) {
    this.id = id
    this.name = name
    this.modules = []
    this.energyLedger = []
    this.eventLog = []
    this.currentTurn = 0
    this.sunAngle = 90
    this.sunAngleRate = -15
    this.status = 'stable'
    this.crewAlive = true
  }

  addModule(module) {
    this.modules.push(module)
  }

  getModule(moduleId) {
    return this.modules.find(m => m.id === moduleId)
  }

  getAllSolarPanels() {
    return this.modules.flatMap(m => m.solarPanels)
  }

  getAllBatteries() {
    return this.modules.flatMap(m => m.batteries)
  }

  getAllLoads() {
    return this.modules.flatMap(m => m.loads)
  }

  getTotalSolarOutput() {
    return this.modules.reduce((sum, m) => sum + m.getTotalSolarOutput(this.sunAngle), 0)
  }

  getTotalBatteryCapacity() {
    return this.modules.reduce((sum, m) => sum + m.getTotalBatteryCapacity(), 0)
  }

  getTotalBatteryCharge() {
    return this.modules.reduce((sum, m) => sum + m.getTotalBatteryCharge(), 0)
  }

  getTotalLoadDemand() {
    return this.modules.reduce((sum, m) => sum + m.getTotalLoadDemand(), 0)
  }

  getCriticalLoadDemand() {
    return this.modules.reduce((sum, m) => sum + m.getCriticalLoadDemand(), 0)
  }

  getPoweredLoadDemand() {
    return this.getAllLoads()
      .filter(l => l.isPowered)
      .reduce((sum, l) => sum + l.powerDemand, 0)
  }

  getLoadsByPriority() {
    return this.getAllLoads().sort((a, b) => a.priority - b.priority)
  }

  getOverallState() {
    const charge = this.getTotalBatteryCharge()
    const capacity = this.getTotalBatteryCapacity()
    const soc = capacity > 0 ? charge / capacity : 0
    
    if (soc < 0.05) return 'critical'
    if (soc < 0.15) return 'danger'
    if (soc < 0.3) return 'warning'
    return 'stable'
  }

  checkCrewStatus() {
    const criticalLoads = this.getAllLoads().filter(l => l.priority === LoadPriority.CRITICAL)
    const allCriticalPowered = criticalLoads.every(l => l.isPowered)
    
    if (!allCriticalPowered) {
      const longestOutage = Math.max(...criticalLoads.map(l => l.consecutiveOutages), 0)
      if (longestOutage >= 3) {
        this.crewAlive = false
        this.status = 'failed'
      }
    }
    return this.crewAlive
  }
}
