import { Ship, ShipTypes, ShipStatus } from './Ship'
import { Channel, Berth, WaitingZone } from './Channel'
import { Tug, WeatherCondition } from './Resource'

export const LevelDifficulty = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
  EXPERT: 'expert'
}

export class Level {
  constructor(params = {}) {
    this.id = params.id || `level_${Date.now()}`
    this.name = params.name || '未知关卡'
    this.description = params.description || ''
    this.difficulty = params.difficulty || LevelDifficulty.MEDIUM
    
    this.mapConfig = params.mapConfig || {
      width: 1200,
      height: 800,
      gridSize: 20
    }
    
    this.channels = (params.channels || []).map(c => Channel.fromJSON(c))
    this.berths = (params.berths || []).map(b => Berth.fromJSON(b))
    this.waitingZones = (params.waitingZones || []).map(w => WaitingZone.fromJSON(w))
    
    this.entryVessels = (params.entryVessels || []).map(s => Ship.fromJSON({
      ...s,
      isEntry: true,
      isDeparture: false
    }))
    
    this.departureVessels = (params.departureVessels || []).map(s => Ship.fromJSON({
      ...s,
      isEntry: false,
      isDeparture: true
    }))
    
    this.tugs = (params.tugs || []).map(t => Tug.fromJSON(t))
    this.weatherConditions = (params.weatherConditions || []).map(w => WeatherCondition.fromJSON(w))
    
    this.startTime = params.startTime || 0
    this.maxTime = params.maxTime || 1440
    
    this.objectives = params.objectives || []
    this.scoringRules = params.scoringRules || {
      onTimeBonus: 100,
      delayPenalty: 50,
      conflictPenalty: 200,
      tugUtilizationBonus: 50,
      safetyViolationPenalty: 500
    }
    
    this.hints = params.hints || []
    this.tutorialMessages = params.tutorialMessages || []
  }

  static fromJSON(json) {
    return new Level(json)
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      difficulty: this.difficulty,
      mapConfig: { ...this.mapConfig },
      channels: this.channels.map(c => c.toJSON()),
      berths: this.berths.map(b => b.toJSON()),
      waitingZones: this.waitingZones.map(w => w.toJSON()),
      entryVessels: this.entryVessels.map(s => s.toJSON()),
      departureVessels: this.departureVessels.map(s => s.toJSON()),
      tugs: this.tugs.map(t => t.toJSON()),
      weatherConditions: this.weatherConditions.map(w => w.toJSON()),
      startTime: this.startTime,
      maxTime: this.maxTime,
      objectives: [...this.objectives],
      scoringRules: { ...this.scoringRules },
      hints: [...this.hints],
      tutorialMessages: [...this.tutorialMessages]
    }
  }

  clone() {
    return Level.fromJSON(this.toJSON())
  }

  getDifficultyName() {
    const names = {
      [LevelDifficulty.EASY]: '简单',
      [LevelDifficulty.MEDIUM]: '中等',
      [LevelDifficulty.HARD]: '困难',
      [LevelDifficulty.EXPERT]: '专家'
    }
    return names[this.difficulty] || '中等'
  }

  getAllVessels() {
    return [...this.entryVessels, ...this.departureVessels]
  }

  getVesselById(id) {
    const allVessels = this.getAllVessels()
    return allVessels.find(v => v.id === id)
  }

  getBerthById(id) {
    return this.berths.find(b => b.id === id)
  }

  getChannelById(id) {
    return this.channels.find(c => c.id === id)
  }

  getTugById(id) {
    return this.tugs.find(t => t.id === id)
  }

  getCurrentWeather(time) {
    return this.weatherConditions.find(w => w.isActiveAt(time)) || null
  }

  getActiveEntryVessels(time) {
    return this.entryVessels.filter(v => v.arrivalTime <= time && v.status !== ShipStatus.COMPLETED)
  }

  getActiveDepartureVessels(time) {
    return this.departureVessels.filter(v => v.arrivalTime <= time && v.status !== ShipStatus.COMPLETED)
  }

  getTotalVessels() {
    return this.entryVessels.length + this.departureVessels.length
  }
}

export default Level
