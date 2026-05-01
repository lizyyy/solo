import { ShipStatus } from '../models/Ship'
import { TugStatus } from '../models/Resource'

export const SimulationSpeed = {
  PAUSED: 0,
  NORMAL: 1,
  FAST: 2,
  VERY_FAST: 5,
  TURBO: 10
}

export class Simulator {
  constructor(level, rulesEngine) {
    this.level = level || null
    this.rulesEngine = rulesEngine || null
    this.currentTime = level ? (level.startTime || 0) : 0
    this.speed = SimulationSpeed.NORMAL
    this.isRunning = false
    this.lastUpdateCallback = null
    this.completedCallback = null
    this.conflictCallback = null
    this.eventCallback = null
    this.intervalId = null
    this.lastTickTime = null
  }

  loadLevel(level, rulesEngine) {
    this.level = level
    this.rulesEngine = rulesEngine
    this.currentTime = level.startTime || 0
    this.speed = SimulationSpeed.NORMAL
    this.isRunning = false
    this.pause()
  }

  createSnapshot() {
    if (!this.level) return null
    
    return {
      currentTime: this.currentTime,
      speed: this.speed,
      isRunning: this.isRunning,
      levelJSON: this.level.toJSON(),
      ships: this.level.getAllVessels().map(s => s.toJSON()),
      tugs: this.level.tugs.map(t => t.toJSON()),
      berths: this.level.berths.map(b => b.toJSON())
    }
  }

  restoreFromSnapshot(snapshot) {
    if (!snapshot || !this.level) return false
    
    try {
      this.currentTime = snapshot.currentTime
      this.speed = snapshot.speed
      this.isRunning = snapshot.isRunning
      
      if (snapshot.ships && this.level.entryVessels && this.level.departureVessels) {
        const allShips = [...this.level.entryVessels, ...this.level.departureVessels]
        snapshot.ships.forEach(shipData => {
          const ship = allShips.find(s => s.id === shipData.id)
          if (ship) {
            Object.assign(ship, shipData)
          }
        })
      }
      
      if (snapshot.tugs && this.level.tugs) {
        snapshot.tugs.forEach((tugData, index) => {
          if (this.level.tugs[index]) {
            Object.assign(this.level.tugs[index], tugData)
          }
        })
      }
      
      if (snapshot.berths && this.level.berths) {
        snapshot.berths.forEach((berthData, index) => {
          if (this.level.berths[index]) {
            Object.assign(this.level.berths[index], berthData)
          }
        })
      }
      
      return true
    } catch (e) {
      console.error('Error restoring snapshot:', e)
      return false
    }
  }

  setUpdateCallback(callback) {
    this.lastUpdateCallback = callback
  }

  setCompletedCallback(callback) {
    this.completedCallback = callback
  }

  setConflictCallback(callback) {
    this.conflictCallback = callback
  }

  setEventCallback(callback) {
    this.eventCallback = callback
  }

  setSpeed(speed) {
    this.speed = speed
  }

  getSpeed() {
    return this.speed
  }

  get ships() {
    if (!this.level) return []
    return this.level.getAllVessels()
  }

  get tugs() {
    if (!this.level) return []
    return this.level.tugs
  }

  get berths() {
    if (!this.level) return []
    return this.level.berths
  }

  get waitingZones() {
    if (!this.level) return []
    return this.level.waitingZones
  }

  get channels() {
    if (!this.level) return []
    return this.level.channels
  }

  get currentWeather() {
    if (!this.level) return null
    return this.level.getCurrentWeather(this.currentTime)
  }

  start() {
    if (this.isRunning) return
    this.isRunning = true
    this.lastTickTime = performance.now()
    this.scheduleNextTick()
  }

  pause() {
    this.isRunning = false
    if (this.intervalId) {
      clearTimeout(this.intervalId)
      this.intervalId = null
    }
  }

  toggle() {
    if (this.isRunning) {
      this.pause()
    } else {
      this.start()
    }
  }

  reset() {
    this.pause()
    this.currentTime = this.level.startTime || 0
  }

  scheduleNextTick() {
    if (!this.isRunning) return
    
    const tickInterval = 1000 / 60
    this.intervalId = setTimeout(() => {
      this.tick()
      this.scheduleNextTick()
    }, tickInterval)
  }

  tick() {
    if (!this.isRunning) return

    const now = performance.now()
    const elapsed = now - (this.lastTickTime || now)
    this.lastTickTime = now

    const deltaTime = elapsed / 1000
    const timeIncrement = deltaTime * this.speed
    this.currentTime += timeIncrement

    if (this.currentTime >= this.level.maxTime) {
      this.currentTime = this.level.maxTime
      this.pause()
      if (this.completedCallback) {
        this.completedCallback()
      }
      return
    }

    this.updateShips(timeIncrement)
    this.updateTugs(timeIncrement)
    this.checkConflicts()

    if (this.lastUpdateCallback) {
      this.lastUpdateCallback(this.currentTime)
    }
  }

  updateShips(deltaTime) {
    const allShips = this.level.getAllVessels()
    
    for (const ship of allShips) {
      if (ship.status === ShipStatus.COMPLETED) continue
      if (ship.arrivalTime > this.currentTime) continue

      this.updateShipMovement(ship, deltaTime)
    }
  }

  updateShipMovement(ship, deltaTime) {
    const weather = this.level.getCurrentWeather(this.currentTime)
    const weatherModifier = weather ? weather.getSpeedModifier() : 1

    const effectiveSpeed = ship.speed * ship.speedMultiplier * weatherModifier
    const distanceToMove = effectiveSpeed * deltaTime

    switch (ship.status) {
      case ShipStatus.WAITING:
        ship.waitTime += deltaTime
        break

      case ShipStatus.APPROACHING:
      case ShipStatus.ENTERING:
      case ShipStatus.EXITING:
        if (ship.route.length > 0 && ship.currentRouteIndex < ship.route.length) {
          const targetPoint = ship.route[ship.currentRouteIndex]
          const dx = targetPoint.x - ship.currentPosition.x
          const dy = targetPoint.y - ship.currentPosition.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance <= distanceToMove) {
            ship.currentPosition = { ...targetPoint }
            ship.currentRouteIndex++

            if (ship.currentRouteIndex >= ship.route.length) {
              if (ship.isEntry) {
                ship.status = ShipStatus.BERTHING
                this.addEvent(`船舶 ${ship.name} 开始靠泊`)
              } else {
                ship.status = ShipStatus.COMPLETED
                this.addEvent(`船舶 ${ship.name} 完成离港`)
              }
            }
          } else {
            const ratio = distanceToMove / distance
            ship.currentPosition.x += dx * ratio
            ship.currentPosition.y += dy * ratio
          }
        }
        break

      case ShipStatus.BERTHING:
        if (ship.berthTime > 0) {
          ship.berthTime -= deltaTime
          if (ship.berthTime <= 0) {
            ship.status = ShipStatus.DOCKED
            ship.actualArrivalTime = this.currentTime
            this.addEvent(`船舶 ${ship.name} 已靠泊`)

            if (ship.assignedBerth) {
              const berth = this.level.getBerthById(ship.assignedBerth)
              if (berth) {
                berth.occupy(ship.id, this.currentTime + (ship.berthTime || 60))
              }
            }

            if (ship.assignedTugs.length > 0) {
              for (const tugId of ship.assignedTugs) {
                const tug = this.level.getTugById(tugId)
                if (tug) {
                  tug.release()
                }
              }
              ship.assignedTugs = []
            }
          }
        }
        break

      case ShipStatus.DOCKED:
        break

      case ShipStatus.UNBERTHING:
        if (ship.berthTime > 0) {
          ship.berthTime -= deltaTime
          if (ship.berthTime <= 0) {
            ship.status = ShipStatus.EXITING
            ship.actualDepartureTime = this.currentTime
            this.addEvent(`船舶 ${ship.name} 开始离港`)

            if (ship.assignedBerth) {
              const berth = this.level.getBerthById(ship.assignedBerth)
              if (berth) {
                berth.release()
              }
            }
          }
        }
        break
    }
  }

  updateTugs(deltaTime) {
    for (const tug of this.level.tugs) {
      if (tug.status === TugStatus.MAINTENANCE) continue

      if (tug.assignedShipId) {
        const ship = this.level.getVesselById(tug.assignedShipId)
        if (ship) {
          tug.position = { ...ship.currentPosition }
        }
      } else if (tug.status === TugStatus.AVAILABLE) {
        const homeDist = this.calculateDistance(tug.position, tug.homePosition)
        if (homeDist > 50) {
          const dx = tug.homePosition.x - tug.position.x
          const dy = tug.homePosition.y - tug.position.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          const moveDistance = tug.speed * deltaTime

          if (distance <= moveDistance) {
            tug.position = { ...tug.homePosition }
          } else {
            const ratio = moveDistance / distance
            tug.position.x += dx * ratio
            tug.position.y += dy * ratio
          }
        }
      }
    }
  }

  checkConflicts() {
    const allShips = this.level.getAllVessels()
    const conflicts = this.rulesEngine.checkAll(allShips, this.currentTime)

    if (conflicts.length > 0 && this.conflictCallback) {
      this.conflictCallback(conflicts)
    }
  }

  calculateDistance(pos1, pos2) {
    const dx = pos2.x - pos1.x
    const dy = pos2.y - pos1.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  addEvent(message, type = 'info') {
    const event = {
      id: `event_${Date.now()}_${Math.random()}`,
      type,
      message,
      time: this.currentTime,
      timestamp: Date.now()
    }

    this.rulesEngine.addEventLog(event)

    if (this.eventCallback) {
      this.eventCallback(event)
    }
  }

  advanceToTime(targetTime) {
    if (targetTime <= this.currentTime) return

    const originalSpeed = this.speed
    this.speed = SimulationSpeed.TURBO

    while (this.currentTime < targetTime && this.isRunning) {
      this.tick()
    }

    this.speed = originalSpeed
  }

  getState() {
    return {
      currentTime: this.currentTime,
      speed: this.speed,
      isRunning: this.isRunning,
      ships: this.level.getAllVessels().map(s => s.toJSON()),
      tugs: this.level.tugs.map(t => t.toJSON()),
      berths: this.level.berths.map(b => b.toJSON()),
      events: this.rulesEngine.eventLog.slice(-100),
      conflicts: this.rulesEngine.getUnresolvedConflicts().map(c => c.toJSON())
    }
  }

  restoreState(state) {
    this.currentTime = state.currentTime
    this.speed = state.speed
    this.isRunning = false
  }
}

export default Simulator
