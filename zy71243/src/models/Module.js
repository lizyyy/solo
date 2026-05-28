import { SolarPanel } from './SolarPanel.js'
import { Battery } from './Battery.js'
import { Load } from './Load.js'

export class Module {
  constructor(id, name, type, position = { x: 0, y: 0 }) {
    this.id = id
    this.name = name
    this.type = type
    this.position = position
    this.solarPanels = []
    this.batteries = []
    this.loads = []
    this.status = 'operational'
    this.integrity = 100
  }

  addSolarPanel(panel) {
    this.solarPanels.push(panel)
  }

  addBattery(battery) {
    this.batteries.push(battery)
  }

  addLoad(load) {
    this.loads.push(load)
  }

  removeSolarPanel(panelId) {
    this.solarPanels = this.solarPanels.filter(p => p.id !== panelId)
  }

  removeBattery(batteryId) {
    this.batteries = this.batteries.filter(b => b.id !== batteryId)
  }

  removeLoad(loadId) {
    this.loads = this.loads.filter(l => l.id !== loadId)
  }

  getTotalSolarOutput(sunAngle = 90) {
    return this.solarPanels.reduce((sum, panel) => sum + panel.calculateOutput(sunAngle), 0)
  }

  getTotalBatteryCapacity() {
    return this.batteries.reduce((sum, bat) => sum + bat.effectiveCapacity, 0)
  }

  getTotalBatteryCharge() {
    return this.batteries.reduce((sum, bat) => sum + bat.currentCharge, 0)
  }

  getTotalLoadDemand() {
    return this.loads.reduce((sum, load) => sum + load.powerDemand, 0)
  }

  getCriticalLoadDemand() {
    return this.loads
      .filter(l => l.priority <= 2)
      .reduce((sum, load) => sum + load.powerDemand, 0)
  }

  applyHullDamage(amount) {
    this.integrity = Math.max(0, this.integrity - amount)
    if (this.integrity <= 0) {
      this.status = 'destroyed'
    } else if (this.integrity < 50) {
      this.status = 'damaged'
    }
  }
}
