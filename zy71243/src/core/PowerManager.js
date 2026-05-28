import { LoadPriority } from '../models/Load.js'

export class PowerManager {
  constructor(station, ledger) {
    this.station = station
    this.ledger = ledger
    this.shedLoads = []
  }

  distributePower(durationHours = 1) {
    const entry = this.ledger.getCurrentEntry()
    if (!entry) return null

    const solarOutput = this.station.getTotalSolarOutput()
    entry.sunAngle = this.station.sunAngle
    entry.solarOutput = solarOutput
    entry.totalLoadDemand = this.station.getTotalLoadDemand()
    entry.batteryStartCharge = this.station.getTotalBatteryCharge()

    let availablePower = solarOutput * durationHours
    const batteries = this.station.getAllBatteries()
    const loadsByPriority = this.station.getLoadsByPriority()

    const shedThisTurn = []

    for (const load of loadsByPriority) {
      const requiredPower = load.powerDemand * durationHours

      if (availablePower >= requiredPower) {
        load.supplyPower(requiredPower, durationHours)
        availablePower -= requiredPower
      } else {
        const batteryPower = this.dischargeBatteries(requiredPower - availablePower, batteries, durationHours)
        const totalAvailable = availablePower + batteryPower

        if (totalAvailable >= requiredPower) {
          load.supplyPower(requiredPower, durationHours)
          availablePower = 0
        } else {
          load.supplyPower(0, durationHours)
          shedThisTurn.push({
            id: load.id,
            name: load.name,
            priority: load.priority,
            demand: load.powerDemand
          })
        }
      }
    }

    if (availablePower > 0) {
      this.chargeBatteries(availablePower, batteries, durationHours)
    }

    entry.loadsShed = shedThisTurn
    entry.poweredLoads = loadsByPriority.filter(l => l.isPowered).length
    entry.unpoweredLoads = shedThisTurn.length
    entry.batteryEndCharge = this.station.getTotalBatteryCharge()
    entry.batteryDelta = entry.batteryEndCharge - entry.batteryStartCharge
    entry.netBalance = solarOutput * durationHours - entry.totalLoadDemand * durationHours
    
    entry.batteryOverDischargeEvents = batteries.filter(b => b.overDischargeCount > 0).length
    entry.batteryOverChargeEvents = batteries.filter(b => b.overChargeCount > 0).length

    const batterySOC = entry.batteryEndCharge / this.station.getTotalBatteryCapacity()
    if (batterySOC < 0.05) {
      entry.status = 'critical'
    } else if (batterySOC < 0.15) {
      entry.status = 'danger'
    } else if (shedThisTurn.some(l => l.priority <= LoadPriority.HIGH)) {
      entry.status = 'warning'
    } else {
      entry.status = 'normal'
    }

    this.shedLoads.push(...shedThisTurn)

    return entry
  }

  dischargeBatteries(amount, batteries, durationHours) {
    let totalDischarged = 0
    const remaining = amount

    const sortedBatteries = batteries
      .filter(b => b.status === 'operational')
      .sort((a, b) => b.stateOfCharge - a.stateOfCharge)

    for (const battery of sortedBatteries) {
      if (totalDischarged >= amount) break
      
      const toDischarge = Math.min(
        amount - totalDischarged,
        battery.maxSafeDischarge * durationHours
      )
      
      totalDischarged += battery.discharge(toDischarge, durationHours)
    }

    return totalDischarged
  }

  chargeBatteries(amount, batteries, durationHours) {
    let totalCharged = 0

    const sortedBatteries = batteries
      .filter(b => b.status === 'operational')
      .sort((a, b) => a.stateOfCharge - b.stateOfCharge)

    for (const battery of sortedBatteries) {
      if (totalCharged >= amount) break
      
      const toCharge = Math.min(
        amount - totalCharged,
        battery.maxChargeRate * durationHours
      )
      
      totalCharged += battery.charge(toCharge, durationHours)
    }

    return totalCharged
  }

  manuallyShedLoad(loadId) {
    const load = this.station.getAllLoads().find(l => l.id === loadId)
    if (load) {
      load.isPowered = false
      return true
    }
    return false
  }

  restoreLoad(loadId) {
    const load = this.station.getAllLoads().find(l => l.id === loadId)
    if (load) {
      load.isPowered = true
      return true
    }
    return false
  }

  getPowerBalance() {
    return {
      generation: this.station.getTotalSolarOutput(),
      consumption: this.station.getPoweredLoadDemand(),
      batteryCharge: this.station.getTotalBatteryCharge(),
      batteryCapacity: this.station.getTotalBatteryCapacity()
    }
  }
}
