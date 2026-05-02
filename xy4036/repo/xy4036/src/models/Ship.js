export const ShipTypes = {
  PASSENGER: 'passenger',
  CONTAINER: 'container',
  TANKER: 'tanker',
  BULK: 'bulk',
  DANGEROUS: 'dangerous',
  TUG: 'tug'
}

export const ShipStatus = {
  WAITING: 'waiting',
  APPROACHING: 'approaching',
  ENTERING: 'entering',
  BERTHING: 'berthing',
  DOCKED: 'docked',
  UNBERTHING: 'unberthing',
  EXITING: 'exiting',
  COMPLETED: 'completed',
  DELAYED: 'delayed'
}

export class Ship {
  constructor(params = {}) {
    this.id = params.id || `ship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.name = params.name || '未知船舶'
    this.type = params.type || ShipTypes.CONTAINER
    this.status = params.status || ShipStatus.WAITING
    
    this.length = params.length || 150
    this.width = params.width || 25
    this.draft = params.draft || 10
    this.turningRadius = params.turningRadius || 50
    
    this.isDangerous = params.isDangerous || false
    this.priority = params.priority || 2
    this.tugsRequired = params.tugsRequired || 1
    
    this.arrivalTime = params.arrivalTime || 0
    this.deadlineTime = params.deadlineTime || null
    this.berthTime = params.berthTime || 60
    
    this.currentPosition = params.currentPosition || { x: 0, y: 0 }
    this.targetPosition = params.targetPosition || null
    this.assignedBerth = params.assignedBerth || null
    this.route = params.route || []
    this.currentRouteIndex = params.currentRouteIndex || 0
    
    this.assignedTugs = params.assignedTugs || []
    this.speed = params.speed || 10
    this.speedMultiplier = params.speedMultiplier || 1
    
    this.waitTime = params.waitTime || 0
    this.actualArrivalTime = params.actualArrivalTime || null
    this.actualDepartureTime = params.actualDepartureTime || null
    
    this.isEntry = params.isEntry !== false
    this.isDeparture = params.isDeparture || false
    
    this.originalParams = { ...params }
  }

  static fromJSON(json) {
    return new Ship(json)
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      status: this.status,
      length: this.length,
      width: this.width,
      draft: this.draft,
      turningRadius: this.turningRadius,
      isDangerous: this.isDangerous,
      priority: this.priority,
      tugsRequired: this.tugsRequired,
      arrivalTime: this.arrivalTime,
      deadlineTime: this.deadlineTime,
      berthTime: this.berthTime,
      currentPosition: { ...this.currentPosition },
      targetPosition: this.targetPosition ? { ...this.targetPosition } : null,
      assignedBerth: this.assignedBerth,
      route: [...this.route],
      currentRouteIndex: this.currentRouteIndex,
      assignedTugs: [...this.assignedTugs],
      speed: this.speed,
      speedMultiplier: this.speedMultiplier,
      waitTime: this.waitTime,
      actualArrivalTime: this.actualArrivalTime,
      actualDepartureTime: this.actualDepartureTime,
      isEntry: this.isEntry,
      isDeparture: this.isDeparture
    }
  }

  clone() {
    return Ship.fromJSON(this.toJSON())
  }

  getPriorityName() {
    const priorities = {
      1: '紧急',
      2: '正常',
      3: '低优先级'
    }
    return priorities[this.priority] || '正常'
  }

  getTypeName() {
    const typeNames = {
      [ShipTypes.PASSENGER]: '客船',
      [ShipTypes.CONTAINER]: '集装箱',
      [ShipTypes.TANKER]: '油轮',
      [ShipTypes.BULK]: '散货',
      [ShipTypes.DANGEROUS]: '危险品',
      [ShipTypes.TUG]: '拖轮'
    }
    return typeNames[this.type] || '未知'
  }

  isOverdue(currentTime) {
    if (!this.deadlineTime) return false
    return currentTime > this.deadlineTime
  }

  getRemainingTime(currentTime) {
    if (!this.deadlineTime) return null
    return Math.max(0, this.deadlineTime - currentTime)
  }
}

export default Ship
