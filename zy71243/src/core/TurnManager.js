import { EnergyLedger } from '../models/EnergyLedger.js'
import { PowerManager } from './PowerManager.js'
import { EventSystem } from './EventSystem.js'

export class TurnManager {
  constructor(station) {
    this.station = station
    this.initialSunAngle = station.sunAngle
    this.ledger = new EnergyLedger()
    this.powerManager = new PowerManager(station, this.ledger)
    this.eventSystem = new EventSystem(station)
    this.history = []
    this.isPaused = false
    this.isGameOver = false
    this.turnDurationHours = 1
    this.maxTurns = 24
  }

  start() {
    this.saveState()
    return this.getCurrentState()
  }

  advanceTurn() {
    if (this.isGameOver) return null

    this.station.currentTurn++
    
    this.station.sunAngle += this.station.sunAngleRate
    if (this.station.sunAngle < -90) {
      this.station.sunAngle = this.station.sunAngle + 270
    }

    this.ledger.createEntry(this.station.currentTurn)

    this.eventSystem.generateRandomEvent(this.station.currentTurn)
    const events = this.eventSystem.processPendingEvents(this.station.currentTurn)

    const ledgerEntry = this.powerManager.distributePower(this.turnDurationHours)
    
    if (events.length > 0 && ledgerEntry) {
      ledgerEntry.events = events.map(e => ({
        type: e.type,
        message: e.message,
        severity: e.severity
      }))
    }

    this.station.checkCrewStatus()
    
    if (!this.station.crewAlive) {
      this.isGameOver = true
      ledgerEntry.status = 'failed'
    }

    if (this.station.currentTurn >= this.maxTurns) {
      this.isGameOver = true
    }

    this.saveState()

    return {
      turn: this.station.currentTurn,
      ledgerEntry,
      events,
      stationStatus: this.station.getOverallState(),
      isGameOver: this.isGameOver,
      crewAlive: this.station.crewAlive
    }
  }

  saveState() {
    const state = {
      turn: this.station.currentTurn,
      sunAngle: this.station.sunAngle,
      modules: JSON.parse(JSON.stringify(this.station.modules)),
      ledgerSnapshot: this.ledger.getCurrentEntry() ? { ...this.ledger.getCurrentEntry() } : null
    }
    this.history.push(state)
  }

  getStateAtTurn(turn) {
    return this.history.find(s => s.turn === turn)
  }

  getCurrentState() {
    return {
      turn: this.station.currentTurn,
      sunAngle: this.station.sunAngle,
      station: this.station,
      ledger: this.ledger,
      powerBalance: this.powerManager.getPowerBalance(),
      events: this.eventSystem.getRecentEvents(10),
      isGameOver: this.isGameOver,
      crewAlive: this.station.crewAlive
    }
  }

  pause() {
    this.isPaused = true
  }

  resume() {
    this.isPaused = false
  }

  reset() {
    this.station.currentTurn = 0
    this.station.sunAngle = this.initialSunAngle
    this.station.crewAlive = true
    this.station.status = 'stable'
    this.isGameOver = false
    this.history = []
    
    this.ledger = new EnergyLedger()
    this.powerManager = new PowerManager(this.station, this.ledger)
    this.eventSystem = new EventSystem(this.station)

    return this.start()
  }
}
