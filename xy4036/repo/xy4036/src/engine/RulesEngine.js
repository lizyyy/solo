import { ShipStatus, ShipTypes } from '../models/Ship'
import { ChannelDirection } from '../models/Channel'
import { TugStatus } from '../models/Resource'

export const ConflictType = {
  TUG_SHORTAGE: 'tug_shortage',
  BERTH_CONFLICT: 'berth_conflict',
  CHANNEL_MEETING: 'channel_meeting',
  SAFETY_DISTANCE: 'safety_distance',
  DRAFT_EXCEEDED: 'draft_exceeded',
  SPEED_EXCEEDED: 'speed_exceeded',
  CHANNEL_CLOSED: 'channel_closed',
  DIRECTION_VIOLATION: 'direction_violation',
  OVERDUE: 'overdue',
  DANGEROUS_PASSENGER_CONFLICT: 'dangerous_passenger_conflict',
  WAITING_ZONE_FULL: 'waiting_zone_full',
  UNKNOWN: 'unknown'
}

export const ConflictSeverity = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info'
}

export class Conflict {
  constructor(params = {}) {
    this.id = params.id || `conflict_${Date.now()}`
    this.type = params.type || ConflictType.UNKNOWN
    this.severity = params.severity || ConflictSeverity.WARNING
    this.message = params.message || '未知冲突'
    this.shipIds = params.shipIds || []
    this.channelId = params.channelId || null
    this.berthId = params.berthId || null
    this.tugIds = params.tugIds || []
    this.position = params.position || null
    this.time = params.time || 0
    this.resolved = params.resolved || false
  }

  static fromJSON(json) {
    return new Conflict(json)
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      severity: this.severity,
      message: this.message,
      shipIds: [...this.shipIds],
      channelId: this.channelId,
      berthId: this.berthId,
      tugIds: [...this.tugIds],
      position: this.position ? { ...this.position } : null,
      time: this.time,
      resolved: this.resolved
    }
  }

  getTypeName() {
    const names = {
      [ConflictType.TUG_SHORTAGE]: '拖轮不足',
      [ConflictType.BERTH_CONFLICT]: '泊位冲突',
      [ConflictType.CHANNEL_MEETING]: '航道会船',
      [ConflictType.SAFETY_DISTANCE]: '安全距离不足',
      [ConflictType.DRAFT_EXCEEDED]: '吃水超限',
      [ConflictType.SPEED_EXCEEDED]: '超速',
      [ConflictType.CHANNEL_CLOSED]: '航道关闭',
      [ConflictType.DIRECTION_VIOLATION]: '方向违规',
      [ConflictType.OVERDUE]: '超时',
      [ConflictType.DANGEROUS_PASSENGER_CONFLICT]: '危险品与客船冲突',
      [ConflictType.WAITING_ZONE_FULL]: '等待区已满',
      [ConflictType.UNKNOWN]: '未知'
    }
    return names[this.type] || '未知'
  }

  getSeverityName() {
    const names = {
      [ConflictSeverity.CRITICAL]: '严重',
      [ConflictSeverity.WARNING]: '警告',
      [ConflictSeverity.INFO]: '提示'
    }
    return names[this.severity] || '警告'
  }
}

export class RulesEngine {
  constructor(simulator) {
    this.simulator = simulator
    this.level = simulator ? simulator.level : null
    this.conflicts = []
    this.eventLog = []
  }

  setSimulator(simulator) {
    this.simulator = simulator
    this.level = simulator ? simulator.level : null
  }

  checkAll(ships, currentTime) {
    const shipsToCheck = ships || (this.simulator ? this.simulator.ships : [])
    const timeToCheck = currentTime !== undefined ? currentTime : (this.simulator ? this.simulator.currentTime : 0)
    
    this.conflicts = []
    const activeShips = shipsToCheck.filter(s => 
      s.status !== ShipStatus.COMPLETED && 
      s.status !== ShipStatus.WAITING
    )

    activeShips.forEach(ship => {
      this.checkShipConstraints(ship, timeToCheck)
    })

    for (let i = 0; i < activeShips.length; i++) {
      for (let j = i + 1; j < activeShips.length; j++) {
        this.checkShipInteraction(activeShips[i], activeShips[j], timeToCheck)
      }
    }

    return this.conflicts.filter(c => !c.resolved)
  }

  checkShipConstraints(ship, currentTime) {
    if (ship.isOverdue(currentTime)) {
      this.addConflict(new Conflict({
        type: ConflictType.OVERDUE,
        severity: ConflictSeverity.WARNING,
        message: `船舶 ${ship.name} 已超过最晚到港时间`,
        shipIds: [ship.id],
        time: currentTime,
        position: { ...ship.currentPosition }
      }))
    }

    if (ship.assignedBerth) {
      const berth = this.level.getBerthById(ship.assignedBerth)
      if (berth && !berth.canAccommodate(ship)) {
        this.addConflict(new Conflict({
          type: ConflictType.BERTH_CONFLICT,
          severity: ConflictSeverity.CRITICAL,
          message: `船舶 ${ship.name} 无法停靠泊位 ${berth.name}`,
          shipIds: [ship.id],
          berthId: berth.id,
          time: currentTime
        }))
      }
    }
  }

  checkShipInteraction(ship1, ship2, currentTime) {
    const distance = this.calculateDistance(ship1.currentPosition, ship2.currentPosition)
    const minDistance = this.getMinimumSafeDistance(ship1, ship2)

    if (distance < minDistance) {
      this.addConflict(new Conflict({
        type: ConflictType.SAFETY_DISTANCE,
        severity: ConflictSeverity.CRITICAL,
        message: `船舶 ${ship1.name} 与 ${ship2.name} 安全距离不足`,
        shipIds: [ship1.id, ship2.id],
        time: currentTime,
        position: {
          x: (ship1.currentPosition.x + ship2.currentPosition.x) / 2,
          y: (ship1.currentPosition.y + ship2.currentPosition.y) / 2
        }
      }))
    }

    if ((ship1.isDangerous && ship2.type === ShipTypes.PASSENGER) ||
        (ship2.isDangerous && ship1.type === ShipTypes.PASSENGER)) {
      if (distance < 500) {
        this.addConflict(new Conflict({
          type: ConflictType.DANGEROUS_PASSENGER_CONFLICT,
          severity: ConflictSeverity.CRITICAL,
          message: `危险品船 ${ship1.isDangerous ? ship1.name : ship2.name} 与客船 ${ship1.type === ShipTypes.PASSENGER ? ship1.name : ship2.name} 距离过近`,
          shipIds: [ship1.id, ship2.id],
          time: currentTime
        }))
      }
    }

    if (ship1.route.length > 0 && ship2.route.length > 0) {
      this.checkChannelMeeting(ship1, ship2, currentTime)
    }
  }

  checkChannelMeeting(ship1, ship2, currentTime) {
    const channels = this.level.channels
    for (const channel of channels) {
      if (channel.direction !== ChannelDirection.BIDIRECTIONAL) continue

      const ship1InChannel = this.isShipInChannel(ship1, channel)
      const ship2InChannel = this.isShipInChannel(ship2, channel)

      if (ship1InChannel && ship2InChannel) {
        if (ship1.isEntry !== ship2.isEntry) {
          this.addConflict(new Conflict({
            type: ConflictType.CHANNEL_MEETING,
            severity: ConflictSeverity.WARNING,
            message: `航道 ${channel.name} 内存在对向会船风险：${ship1.name} 与 ${ship2.name}`,
            shipIds: [ship1.id, ship2.id],
            channelId: channel.id,
            time: currentTime
          }))
        }
      }
    }
  }

  validateSchedulingAction(action, currentTime) {
    const errors = []
    const warnings = []

    switch (action.type) {
      case 'assign_berth':
        this.validateAssignBerth(action, currentTime, errors, warnings)
        break
      case 'assign_tugs':
        this.validateAssignTugs(action, currentTime, errors, warnings)
        break
      case 'set_route':
        this.validateSetRoute(action, currentTime, errors, warnings)
        break
      case 'send_to_waiting':
        this.validateSendToWaiting(action, currentTime, errors, warnings)
        break
      default:
        errors.push('未知的调度操作类型')
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  validateAssignBerth(action, currentTime, errors, warnings) {
    const ship = this.level.getVesselById(action.shipId)
    const berth = this.level.getBerthById(action.berthId)

    if (!ship) {
      errors.push('船舶不存在')
      return
    }

    if (!berth) {
      errors.push('泊位不存在')
      return
    }

    if (!berth.canAccommodate(ship)) {
      errors.push(`船舶 ${ship.name} 无法停靠泊位 ${berth.name}`)
      return
    }

    const estimatedDuration = action.estimatedDuration || ship.berthTime
    if (!berth.isAvailableAt(currentTime, estimatedDuration)) {
      errors.push(`泊位 ${berth.name} 在该时段已被占用`)
    }
  }

  validateAssignTugs(action, currentTime, errors, warnings) {
    const ship = this.level.getVesselById(action.shipId)
    const tugIds = action.tugIds || []

    if (!ship) {
      errors.push('船舶不存在')
      return
    }

    if (tugIds.length < ship.tugsRequired) {
      errors.push(`船舶 ${ship.name} 需要 ${ship.tugsRequired} 艘拖轮，当前分配 ${tugIds.length} 艘`)
    }

    const estimatedDuration = action.estimatedDuration || 60
    for (const tugId of tugIds) {
      const tug = this.level.getTugById(tugId)
      if (!tug) {
        errors.push(`拖轮 ${tugId} 不存在`)
        continue
      }
      if (!tug.canAssign(ship, currentTime, estimatedDuration)) {
        errors.push(`拖轮 ${tug.name} 在该时段不可用`)
      }
    }
  }

  validateSetRoute(action, currentTime, errors, warnings) {
    const ship = this.level.getVesselById(action.shipId)
    const route = action.route || []

    if (!ship) {
      errors.push('船舶不存在')
      return
    }

    if (route.length === 0) {
      errors.push('航线不能为空')
      return
    }

    for (const channel of this.level.channels) {
      const routeUsesChannel = this.routeUsesChannel(route, channel)
      if (routeUsesChannel) {
        if (!channel.canVesselPass(ship, currentTime)) {
          if (channel.isClosedAtTime(currentTime)) {
            errors.push(`航道 ${channel.name} 已关闭`)
          } else if (ship.draft > channel.maxDraft) {
            errors.push(`船舶吃水超过航道 ${channel.name} 限制`)
          } else {
            errors.push(`船舶无法通过航道 ${channel.name}`)
          }
        }
      }
    }
  }

  validateSendToWaiting(action, currentTime, errors, warnings) {
    const ship = this.level.getVesselById(action.shipId)
    const waitingZone = this.level.waitingZones.find(w => w.id === action.zoneId)

    if (!ship) {
      errors.push('船舶不存在')
      return
    }

    if (!waitingZone) {
      errors.push('等待区不存在')
      return
    }

    if (!waitingZone.hasSpace()) {
      errors.push(`等待区 ${waitingZone.name} 已满`)
    }
  }

  calculateDistance(pos1, pos2) {
    const dx = pos2.x - pos1.x
    const dy = pos2.y - pos1.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  getMinimumSafeDistance(ship1, ship2) {
    let baseDistance = 200

    if (ship1.isDangerous || ship2.isDangerous) {
      baseDistance *= 2
    }

    if (ship1.type === ShipTypes.PASSENGER || ship2.type === ShipTypes.PASSENGER) {
      baseDistance *= 1.5
    }

    const weather = this.level.getCurrentWeather(0)
    if (weather) {
      if (weather.visibility < 50) baseDistance *= 1.5
      if (weather.visibility < 20) baseDistance *= 2
    }

    return baseDistance
  }

  isShipInChannel(ship, channel) {
    const shipPos = ship.currentPosition
    for (let i = 0; i < channel.points.length - 1; i++) {
      const point1 = channel.points[i]
      const point2 = channel.points[i + 1]
      const distToSegment = this.distanceToSegment(shipPos, point1, point2)
      if (distToSegment <= channel.width / 2) {
        return true
      }
    }
    return false
  }

  distanceToSegment(point, segmentStart, segmentEnd) {
    const x = point.x
    const y = point.y
    const x1 = segmentStart.x
    const y1 = segmentStart.y
    const x2 = segmentEnd.x
    const y2 = segmentEnd.y

    const A = x - x1
    const B = y - y1
    const C = x2 - x1
    const D = y2 - y1

    const dot = A * C + B * D
    const lenSq = C * C + D * D
    let param = -1

    if (lenSq !== 0) param = dot / lenSq

    let xx, yy

    if (param < 0) {
      xx = x1
      yy = y1
    } else if (param > 1) {
      xx = x2
      yy = y2
    } else {
      xx = x1 + param * C
      yy = y1 + param * D
    }

    const dx = x - xx
    const dy = y - yy
    return Math.sqrt(dx * dx + dy * dy)
  }

  routeUsesChannel(route, channel) {
    for (const routePoint of route) {
      for (let i = 0; i < channel.points.length - 1; i++) {
        const point1 = channel.points[i]
        const point2 = channel.points[i + 1]
        const distToSegment = this.distanceToSegment(routePoint, point1, point2)
        if (distToSegment <= channel.width / 2) {
          return true
        }
      }
    }
    return false
  }

  addConflict(conflict) {
    this.conflicts.push(conflict)
    this.addEventLog({
      type: 'conflict',
      severity: conflict.severity,
      message: conflict.message,
      time: conflict.time,
      details: conflict.toJSON()
    })
  }

  addEventLog(event) {
    this.eventLog.push({
      id: `event_${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      ...event
    })
  }

  getUnresolvedConflicts() {
    return this.conflicts.filter(c => !c.resolved)
  }

  resolveConflict(conflictId) {
    const conflict = this.conflicts.find(c => c.id === conflictId)
    if (conflict) {
      conflict.resolved = true
    }
  }
}

export default RulesEngine
