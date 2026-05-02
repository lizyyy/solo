export const TugStatus = {
  AVAILABLE: 'available',
  ASSIGNED: 'assigned',
  BUSY: 'busy',
  MAINTENANCE: 'maintenance'
}

export class Tug {
  constructor(params = {}) {
    this.id = params.id || `tug_${Date.now()}`
    this.name = params.name || '拖轮'
    
    this.status = params.status || TugStatus.AVAILABLE
    this.power = params.power || 5000
    
    this.position = params.position || { x: 0, y: 0 }
    this.homePosition = params.homePosition || { x: 0, y: 0 }
    
    this.assignedShipId = params.assignedShipId || null
    this.assignmentEndTime = params.assignmentEndTime || null
    
    this.speed = params.speed || 12
    this.maxRange = params.maxRange || null
    
    this.bookingSchedule = params.bookingSchedule || []
  }

  static fromJSON(json) {
    return new Tug(json)
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      power: this.power,
      position: { ...this.position },
      homePosition: { ...this.homePosition },
      assignedShipId: this.assignedShipId,
      assignmentEndTime: this.assignmentEndTime,
      speed: this.speed,
      maxRange: this.maxRange,
      bookingSchedule: [...this.bookingSchedule]
    }
  }

  clone() {
    return Tug.fromJSON(this.toJSON())
  }

  isAvailableAt(time) {
    if (this.status === TugStatus.MAINTENANCE) return false
    if (this.status === TugStatus.BUSY && this.assignmentEndTime && time < this.assignmentEndTime) {
      return false
    }
    
    return !this.bookingSchedule.some(booking => 
      time >= booking.start && time <= booking.end
    )
  }

  canAssign(ship, startTime, duration) {
    if (!this.isAvailableAt(startTime)) return false
    
    const endTime = startTime + duration
    return !this.bookingSchedule.some(booking => 
      (startTime >= booking.start && startTime <= booking.end) ||
      (endTime >= booking.start && endTime <= booking.end) ||
      (startTime <= booking.start && endTime >= booking.end)
    )
  }

  assign(shipId, startTime, endTime) {
    this.assignedShipId = shipId
    this.status = TugStatus.ASSIGNED
    this.bookingSchedule.push({ shipId, start: startTime, end: endTime })
  }

  release() {
    this.assignedShipId = null
    this.status = TugStatus.AVAILABLE
    this.assignmentEndTime = null
  }
}

export class WeatherCondition {
  constructor(params = {}) {
    this.id = params.id || `weather_${Date.now()}`
    
    this.visibility = params.visibility ?? 100
    this.visibilityMultiplier = params.visibilityMultiplier ?? 1
    
    this.windSpeed = params.windSpeed ?? 0
    this.windDirection = params.windDirection ?? 0
    
    this.currentSpeed = params.currentSpeed ?? 0
    this.currentDirection = params.currentDirection ?? 0
    
    this.waveHeight = params.waveHeight ?? 0
    
    this.startTime = params.startTime ?? 0
    this.endTime = params.endTime ?? null
    
    this.affectsNavigation = params.affectsNavigation ?? false
    this.navigationRestrictions = params.navigationRestrictions ?? null
  }

  static fromJSON(json) {
    return new WeatherCondition(json)
  }

  toJSON() {
    return {
      id: this.id,
      visibility: this.visibility,
      visibilityMultiplier: this.visibilityMultiplier,
      windSpeed: this.windSpeed,
      windDirection: this.windDirection,
      currentSpeed: this.currentSpeed,
      currentDirection: this.currentDirection,
      waveHeight: this.waveHeight,
      startTime: this.startTime,
      endTime: this.endTime,
      affectsNavigation: this.affectsNavigation,
      navigationRestrictions: this.navigationRestrictions
    }
  }

  clone() {
    return WeatherCondition.fromJSON(this.toJSON())
  }

  getVisibilityCategory() {
    if (this.visibility >= 100) return 'good'
    if (this.visibility >= 50) return 'moderate'
    if (this.visibility >= 20) return 'poor'
    return 'very_poor'
  }

  getVisibilityName() {
    const categories = {
      good: '良好',
      moderate: '一般',
      poor: '较差',
      very_poor: '极差'
    }
    return categories[this.getVisibilityCategory()]
  }

  isActiveAt(time) {
    if (time < this.startTime) return false
    if (this.endTime !== null && time > this.endTime) return false
    return true
  }

  getSpeedModifier() {
    let modifier = 1
    
    if (this.visibility < 50) modifier *= 0.7
    if (this.visibility < 20) modifier *= 0.5
    
    if (this.windSpeed > 20) modifier *= 0.8
    if (this.windSpeed > 40) modifier *= 0.6
    
    if (this.waveHeight > 2) modifier *= 0.8
    if (this.waveHeight > 4) modifier *= 0.6
    
    return modifier
  }

  getDangerLevel() {
    if (this.visibility < 20 || this.windSpeed > 40 || this.waveHeight > 4) {
      return 'high'
    }
    if (this.visibility < 50 || this.windSpeed > 20 || this.waveHeight > 2) {
      return 'medium'
    }
    return 'low'
  }
}

export default Tug
