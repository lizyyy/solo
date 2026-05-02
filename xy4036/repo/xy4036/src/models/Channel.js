export const ChannelDirection = {
  BIDIRECTIONAL: 'bidirectional',
  ONE_WAY_IN: 'one_way_in',
  ONE_WAY_OUT: 'one_way_out'
}

export const ChannelStatus = {
  OPEN: 'open',
  CLOSED: 'closed',
  RESTRICTED: 'restricted'
}

export class Channel {
  constructor(params = {}) {
    this.id = params.id || `channel_${Date.now()}`
    this.name = params.name || '航道'
    
    this.startPoint = params.startPoint || { x: 0, y: 0 }
    this.endPoint = params.endPoint || { x: 100, y: 0 }
    this.points = params.points || [this.startPoint, this.endPoint]
    
    this.width = params.width || 80
    this.minDraft = params.minDraft || 5
    this.maxDraft = params.maxDraft || 15
    
    this.speedLimit = params.speedLimit || 15
    this.direction = params.direction || ChannelDirection.BIDIRECTIONAL
    
    this.status = params.status || ChannelStatus.OPEN
    this.closedTimeWindows = params.closedTimeWindows || []
    
    this.isRestricted = params.isRestricted || false
    this.restrictionReason = params.restrictionReason || null
    
    this.minTurningRadius = params.minTurningRadius || 30
    this.maxVessels = params.maxVessels || null
  }

  static fromJSON(json) {
    return new Channel(json)
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      startPoint: { ...this.startPoint },
      endPoint: { ...this.endPoint },
      points: this.points.map(p => ({ ...p })),
      width: this.width,
      minDraft: this.minDraft,
      maxDraft: this.maxDraft,
      speedLimit: this.speedLimit,
      direction: this.direction,
      status: this.status,
      closedTimeWindows: [...this.closedTimeWindows],
      isRestricted: this.isRestricted,
      restrictionReason: this.restrictionReason,
      minTurningRadius: this.minTurningRadius,
      maxVessels: this.maxVessels
    }
  }

  clone() {
    return Channel.fromJSON(this.toJSON())
  }

  getDirectionName() {
    const names = {
      [ChannelDirection.BIDIRECTIONAL]: '双向',
      [ChannelDirection.ONE_WAY_IN]: '单向进港',
      [ChannelDirection.ONE_WAY_OUT]: '单向出港'
    }
    return names[this.direction] || '双向'
  }

  isClosedAtTime(time) {
    if (this.status === ChannelStatus.CLOSED) return true
    return this.closedTimeWindows.some(window => 
      time >= window.start && time <= window.end
    )
  }

  canVesselPass(ship, time) {
    if (this.isClosedAtTime(time)) return false
    if (ship.draft > this.maxDraft) return false
    if (ship.draft < this.minDraft) return false
    if (ship.turningRadius < this.minTurningRadius) return false
    
    if (this.direction === ChannelDirection.ONE_WAY_IN && ship.isDeparture) return false
    if (this.direction === ChannelDirection.ONE_WAY_OUT && ship.isEntry) return false
    
    return true
  }

  getLength() {
    let length = 0
    for (let i = 0; i < this.points.length - 1; i++) {
      const dx = this.points[i + 1].x - this.points[i].x
      const dy = this.points[i + 1].y - this.points[i].y
      length += Math.sqrt(dx * dx + dy * dy)
    }
    return length
  }
}

export class Berth {
  constructor(params = {}) {
    this.id = params.id || `berth_${Date.now()}`
    this.name = params.name || '泊位'
    
    this.position = params.position || { x: 0, y: 0 }
    this.length = params.length || 200
    this.width = params.width || 30
    
    this.maxDraft = params.maxDraft || 15
    this.minDraft = params.minDraft || 5
    
    this.allowedShipTypes = params.allowedShipTypes || null
    this.isDangerousBerth = params.isDangerousBerth || false
    this.isPassengerBerth = params.isPassengerBerth || false
    
    this.occupiedBy = params.occupiedBy || null
    this.occupiedUntil = params.occupiedUntil || null
    this.bookingSchedule = params.bookingSchedule || []
    
    this.channelId = params.channelId || null
  }

  static fromJSON(json) {
    return new Berth(json)
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      position: { ...this.position },
      length: this.length,
      width: this.width,
      maxDraft: this.maxDraft,
      minDraft: this.minDraft,
      allowedShipTypes: this.allowedShipTypes ? [...this.allowedShipTypes] : null,
      isDangerousBerth: this.isDangerousBerth,
      isPassengerBerth: this.isPassengerBerth,
      occupiedBy: this.occupiedBy,
      occupiedUntil: this.occupiedUntil,
      bookingSchedule: [...this.bookingSchedule],
      channelId: this.channelId
    }
  }

  clone() {
    return Berth.fromJSON(this.toJSON())
  }

  isAvailableAt(time, duration = 0) {
    if (this.occupiedBy && (this.occupiedUntil === null || time < this.occupiedUntil)) {
      return false
    }
    
    return !this.bookingSchedule.some(booking => 
      (time >= booking.start && time <= booking.end) ||
      (time + duration >= booking.start && time + duration <= booking.end) ||
      (time <= booking.start && time + duration >= booking.end)
    )
  }

  canAccommodate(ship) {
    if (ship.length > this.length) return false
    if (ship.draft > this.maxDraft) return false
    if (ship.draft < this.minDraft) return false
    
    if (this.allowedShipTypes && !this.allowedShipTypes.includes(ship.type)) return false
    
    if (ship.isDangerous && !this.isDangerousBerth) return false
    if (ship.type === 'passenger' && !this.isPassengerBerth) return false
    
    return true
  }

  book(shipId, startTime, endTime) {
    this.bookingSchedule.push({ shipId, start: startTime, end: endTime })
  }

  occupy(shipId, untilTime = null) {
    this.occupiedBy = shipId
    this.occupiedUntil = untilTime
  }

  release() {
    this.occupiedBy = null
    this.occupiedUntil = null
  }
}

export class WaitingZone {
  constructor(params = {}) {
    this.id = params.id || `waiting_${Date.now()}`
    this.name = params.name || '等待区'
    
    this.position = params.position || { x: 0, y: 0 }
    this.radius = params.radius || 100
    
    this.maxCapacity = params.maxCapacity || 5
    this.currentVessels = params.currentVessels || []
    
    this.isEntryZone = params.isEntryZone || false
    this.isExitZone = params.isExitZone || false
  }

  static fromJSON(json) {
    return new WaitingZone(json)
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      position: { ...this.position },
      radius: this.radius,
      maxCapacity: this.maxCapacity,
      currentVessels: [...this.currentVessels],
      isEntryZone: this.isEntryZone,
      isExitZone: this.isExitZone
    }
  }

  clone() {
    return WaitingZone.fromJSON(this.toJSON())
  }

  hasSpace() {
    return this.currentVessels.length < this.maxCapacity
  }

  addVessel(shipId) {
    if (!this.hasSpace()) return false
    if (!this.currentVessels.includes(shipId)) {
      this.currentVessels.push(shipId)
      return true
    }
    return false
  }

  removeVessel(shipId) {
    const index = this.currentVessels.indexOf(shipId)
    if (index !== -1) {
      this.currentVessels.splice(index, 1)
      return true
    }
    return false
  }
}

export default Channel
