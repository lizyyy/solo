import { Level } from '../models/Level'
import { Ship } from '../models/Ship'
import { Tug } from '../models/Resource'
import { Berth, WaitingZone, Channel } from '../models/Channel'
import { Conflict } from '../engine/RulesEngine'

const STORAGE_KEY = 'night_simulation_save'
const HISTORY_KEY = 'night_simulation_history'
const MAX_HISTORY = 50

export class SaveManager {
  constructor() {
    this.historyStack = []
    this.historyPointer = -1
    this.loadHistory()
  }

  saveGameState(simulator, level, rulesEngine, levelId) {
    const state = {
      version: '1.0',
      levelId: levelId,
      timestamp: Date.now(),
      simulation: {
        currentTime: simulator.currentTime,
        speed: simulator.speed,
        isRunning: simulator.isRunning
      },
      ships: level.getAllVessels().map(ship => ship.toJSON()),
      tugs: level.tugs.map(tug => tug.toJSON()),
      berths: level.berths.map(berth => berth.toJSON()),
      waitingZones: level.waitingZones.map(zone => zone.toJSON()),
      channels: level.channels.map(channel => channel.toJSON()),
      events: rulesEngine.eventLog.slice(-200),
      conflicts: rulesEngine.conflicts.map(c => c.toJSON()),
      userActions: this.historyStack.slice(0, this.historyPointer + 1).map(h => h.action)
    }

    this.saveToLocalStorage(state)
    return state
  }

  loadGameState(simulator, level, rulesEngine) {
    const savedState = this.loadFromLocalStorage()
    if (!savedState) return null

    try {
      level.entryVessels = savedState.ships
        .filter(s => s.isEntry)
        .map(s => Ship.fromJSON(s))
      
      level.departureVessels = savedState.ships
        .filter(s => s.isDeparture)
        .map(s => Ship.fromJSON(s))

      level.tugs = savedState.tugs.map(t => Tug.fromJSON(t))
      level.berths = savedState.berths.map(b => Berth.fromJSON(b))
      level.waitingZones = savedState.waitingZones.map(w => WaitingZone.fromJSON(w))
      level.channels = savedState.channels.map(c => Channel.fromJSON(c))

      simulator.restoreState(savedState.simulation)

      rulesEngine.eventLog = savedState.events || []
      rulesEngine.conflicts = (savedState.conflicts || []).map(c => Conflict.fromJSON(c))

      return savedState
    } catch (error) {
      console.error('Failed to load game state:', error)
      return null
    }
  }

  saveToLocalStorage(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      return true
    } catch (error) {
      console.error('Failed to save to localStorage:', error)
      return false
    }
  }

  loadFromLocalStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (!data) return null
      return JSON.parse(data)
    } catch (error) {
      console.error('Failed to load from localStorage:', error)
      return null
    }
  }

  hasSave() {
    return localStorage.getItem(STORAGE_KEY) !== null
  }

  clearSave() {
    localStorage.removeItem(STORAGE_KEY)
  }

  recordAction(action, snapshot, metadata = {}) {
    if (this.historyPointer < this.historyStack.length - 1) {
      this.historyStack = this.historyStack.slice(0, this.historyPointer + 1)
    }

    this.historyStack.push({
      action,
      snapshot,
      metadata,
      timestamp: Date.now()
    })

    if (this.historyStack.length > MAX_HISTORY) {
      this.historyStack.shift()
    } else {
      this.historyPointer = this.historyStack.length - 1
    }

    this.saveHistory()
    return true
  }

  undo() {
    if (!this.canUndo()) return null

    const historyItem = this.historyStack[this.historyPointer]
    if (historyItem && historyItem.snapshot) {
      this.historyPointer--
      this.saveHistory()
      return {
        action: historyItem.action,
        snapshot: historyItem.snapshot,
        metadata: historyItem.metadata
      }
    }

    return null
  }

  redo() {
    if (!this.canRedo()) return null

    this.historyPointer++
    const historyItem = this.historyStack[this.historyPointer]
    
    if (historyItem && historyItem.snapshot) {
      this.saveHistory()
      return {
        action: historyItem.action,
        snapshot: historyItem.snapshot,
        metadata: historyItem.metadata
      }
    }

    return null
  }

  canUndo() {
    return this.historyPointer >= 0
  }

  canRedo() {
    return this.historyPointer < this.historyStack.length - 1
  }

  createSnapshot(simulator, level) {
    return {
      simulation: {
        currentTime: simulator.currentTime,
        speed: simulator.speed
      },
      ships: level.getAllVessels().map(s => s.toJSON()),
      tugs: level.tugs.map(t => t.toJSON()),
      berths: level.berths.map(b => b.toJSON()),
      waitingZones: level.waitingZones.map(w => w.toJSON())
    }
  }

  restoreFromSnapshot(snapshot, simulator, level) {
    simulator.currentTime = snapshot.simulation.currentTime
    simulator.speed = snapshot.simulation.speed

    level.entryVessels = snapshot.ships
      .filter(s => s.isEntry)
      .map(s => Ship.fromJSON(s))
    
    level.departureVessels = snapshot.ships
      .filter(s => s.isDeparture)
      .map(s => Ship.fromJSON(s))

    level.tugs = snapshot.tugs.map(t => Tug.fromJSON(t))
    level.berths = snapshot.berths.map(b => Berth.fromJSON(b))
    level.waitingZones = snapshot.waitingZones.map(w => WaitingZone.fromJSON(w))
  }

  saveHistory() {
    try {
      const historyData = {
        stack: this.historyStack.map(item => ({
          action: item.action,
          timestamp: item.timestamp
        })),
        pointer: this.historyPointer
      }
      localStorage.setItem(HISTORY_KEY, JSON.stringify(historyData))
    } catch (error) {
      console.error('Failed to save history:', error)
    }
  }

  loadHistory() {
    try {
      const data = localStorage.getItem(HISTORY_KEY)
      if (data) {
        const historyData = JSON.parse(data)
        this.historyPointer = historyData.pointer || -1
        this.historyStack = historyData.stack || []
      }
    } catch (error) {
      console.error('Failed to load history:', error)
    }
  }

  clearHistory() {
    this.historyStack = []
    this.historyPointer = -1
    localStorage.removeItem(HISTORY_KEY)
  }

  resetHistory() {
    this.clearHistory()
  }

  getSavedGames() {
    const savedState = this.loadFromLocalStorage()
    if (!savedState) return []
    return [{
      id: savedState.levelId || 'save_1',
      name: `保存于 ${new Date(savedState.timestamp).toLocaleString()}`,
      levelId: savedState.levelId,
      timestamp: savedState.timestamp
    }]
  }

  saveGameState(simulator, levelId) {
    const state = {
      version: '1.0',
      levelId: levelId,
      timestamp: Date.now(),
      simulation: {
        currentTime: simulator.currentTime,
        speed: simulator.speed,
        isRunning: simulator.isRunning
      }
    }
    this.saveToLocalStorage(state)
    return state.timestamp.toString()
  }

  getHistoryCount() {
    return this.historyStack.length
  }

  getUndoCount() {
    return this.historyPointer + 1
  }

  getRedoCount() {
    return this.historyStack.length - this.historyPointer - 1
  }

  exportSaveData() {
    const savedState = this.loadFromLocalStorage()
    if (!savedState) return null
    return JSON.stringify(savedState, null, 2)
  }

  importSaveData(jsonString) {
    try {
      const state = JSON.parse(jsonString)
      return this.saveToLocalStorage(state)
    } catch (error) {
      console.error('Failed to import save data:', error)
      return false
    }
  }

  exportHistory() {
    return JSON.stringify({
      stack: this.historyStack,
      pointer: this.historyPointer
    }, null, 2)
  }
}

export default SaveManager
