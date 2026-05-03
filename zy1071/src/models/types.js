import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'

export const BoxStatus = {
  PENDING: 'pending',
  PACKED: 'packed',
  MOVED: 'moved',
  ARRIVED: 'arrived',
  UNPACKED: 'unpacked'
}

export const BoxStatusLabels = {
  [BoxStatus.PENDING]: '待装箱',
  [BoxStatus.PACKED]: '已封箱',
  [BoxStatus.MOVED]: '已搬运',
  [BoxStatus.ARRIVED]: '已到达',
  [BoxStatus.UNPACKED]: '已拆箱'
}

export const BoxStatusColors = {
  [BoxStatus.PENDING]: 'warning',
  [BoxStatus.PACKED]: 'primary',
  [BoxStatus.MOVED]: 'info',
  [BoxStatus.ARRIVED]: 'success',
  [BoxStatus.UNPACKED]: 'success'
}

export const SystemTags = {
  FRAGILE: 'fragile',
  VALUABLE: 'valuable',
  URGENT: 'urgent',
  DOCUMENT: 'document'
}

export const SystemTagLabels = {
  [SystemTags.FRAGILE]: '易碎',
  [SystemTags.VALUABLE]: '贵重',
  [SystemTags.URGENT]: '急用',
  [SystemTags.DOCUMENT]: '证件'
}

export const SystemTagColors = {
  [SystemTags.FRAGILE]: 'danger',
  [SystemTags.VALUABLE]: 'warning',
  [SystemTags.URGENT]: 'primary',
  [SystemTags.DOCUMENT]: 'success'
}

export const RiskLevel = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
}

export const RiskLevelLabels = {
  [RiskLevel.LOW]: '低',
  [RiskLevel.MEDIUM]: '中',
  [RiskLevel.HIGH]: '高',
  [RiskLevel.CRITICAL]: '严重'
}

export const RiskLevelColors = {
  [RiskLevel.LOW]: 'info',
  [RiskLevel.MEDIUM]: 'warning',
  [RiskLevel.HIGH]: 'danger',
  [RiskLevel.CRITICAL]: 'danger'
}

export class StatusHistory {
  constructor({ status, timestamp, note = '' } = {}) {
    this.status = status
    this.timestamp = timestamp || dayjs().toISOString()
    this.note = note
  }

  static create(status, note = '') {
    return new StatusHistory({
      status,
      timestamp: dayjs().toISOString(),
      note
    })
  }
}

export class Tag {
  constructor({ id, name, color, isSystem = false } = {}) {
    this.id = id || uuidv4()
    this.name = name
    this.color = color || 'info'
    this.isSystem = isSystem
  }

  static createSystemTag(tagKey) {
    return new Tag({
      id: tagKey,
      name: SystemTagLabels[tagKey] || tagKey,
      color: SystemTagColors[tagKey] || 'info',
      isSystem: true
    })
  }
}

export class Item {
  constructor({
    id,
    name,
    quantity = 1,
    weight = 0,
    roomId,
    boxId,
    tags = [],
    responsiblePerson = '',
    description = '',
    cushioningNote = '',
    createdAt,
    updatedAt
  } = {}) {
    this.id = id || uuidv4()
    this.name = name
    this.quantity = quantity
    this.weight = weight
    this.roomId = roomId
    this.boxId = boxId
    this.tags = tags
    this.responsiblePerson = responsiblePerson
    this.description = description
    this.cushioningNote = cushioningNote
    this.createdAt = createdAt || dayjs().toISOString()
    this.updatedAt = updatedAt || dayjs().toISOString()
  }

  static fromCSV(row, roomMap, tagMap) {
    const tags = []
    
    if (row.tags) {
      const tagNames = row.tags.split(',').map(t => t.trim())
      tagNames.forEach(name => {
        if (SystemTagLabels[name]) {
          tags.push(SystemTagLabels[name])
        } else {
          tags.push(name)
        }
      })
    }

    return new Item({
      name: row.name,
      quantity: parseInt(row.quantity) || 1,
      weight: parseFloat(row.weight) || 0,
      roomId: roomMap[row.room] || null,
      responsiblePerson: row.responsiblePerson || '',
      description: row.description || '',
      cushioningNote: row.cushioningNote || '',
      tags
    })
  }

  update(data) {
    Object.assign(this, data)
    this.updatedAt = dayjs().toISOString()
  }
}

export class Box {
  constructor({
    id,
    boxNumber,
    name = '',
    status = BoxStatus.PENDING,
    targetRoomId,
    responsiblePerson = '',
    maxWeight = 20,
    maxItems = 20,
    statusHistory = [],
    createdAt,
    updatedAt
  } = {}) {
    this.id = id || uuidv4()
    this.boxNumber = boxNumber
    this.name = name
    this.status = status
    this.targetRoomId = targetRoomId
    this.responsiblePerson = responsiblePerson
    this.maxWeight = maxWeight
    this.maxItems = maxItems
    this.statusHistory = statusHistory.length ? statusHistory : [
      StatusHistory.create(status, '箱子创建')
    ]
    this.createdAt = createdAt || dayjs().toISOString()
    this.updatedAt = updatedAt || dayjs().toISOString()
  }

  changeStatus(newStatus, note = '') {
    this.status = newStatus
    this.statusHistory.push(StatusHistory.create(newStatus, note))
    this.updatedAt = dayjs().toISOString()
  }

  getCurrentStatusLabel() {
    return BoxStatusLabels[this.status] || this.status
  }

  getLastStatusChange() {
    return this.statusHistory[this.statusHistory.length - 1]
  }
}

export class Room {
  constructor({
    id,
    name,
    isSource = true,
    order = 0
  } = {}) {
    this.id = id || uuidv4()
    this.name = name
    this.isSource = isSource
    this.order = order
  }
}

export class Project {
  constructor({
    id,
    name,
    description = '',
    moveDate,
    rooms = [],
    boxes = [],
    items = [],
    tags = [],
    createdAt,
    updatedAt
  } = {}) {
    this.id = id || uuidv4()
    this.name = name
    this.description = description
    this.moveDate = moveDate
    this.rooms = rooms
    this.boxes = boxes
    this.items = items
    this.tags = this.initSystemTags(tags)
    this.createdAt = createdAt || dayjs().toISOString()
    this.updatedAt = updatedAt || dayjs().toISOString()
  }

  initSystemTags(existingTags = []) {
    const systemTags = Object.values(SystemTags).map(key => Tag.createSystemTag(key))
    
    const existingSystemTagIds = existingTags
      .filter(t => t.isSystem)
      .map(t => t.id)
    
    const mergedSystemTags = systemTags.filter(st => !existingSystemTagIds.includes(st.id))
    
    return [
      ...existingTags,
      ...mergedSystemTags
    ]
  }

  getItemsByBox(boxId) {
    return this.items.filter(item => item.boxId === boxId)
  }

  getItemsByRoom(roomId) {
    return this.items.filter(item => item.roomId === roomId)
  }

  getUnboxedItems() {
    return this.items.filter(item => !item.boxId)
  }

  getRoomById(roomId) {
    return this.rooms.find(r => r.id === roomId)
  }

  getBoxById(boxId) {
    return this.boxes.find(b => b.id === boxId)
  }

  getItemById(itemId) {
    return this.items.find(i => i.id === itemId)
  }

  calculateBoxStats(boxId) {
    const boxItems = this.getItemsByBox(boxId)
    const totalWeight = boxItems.reduce((sum, item) => sum + (item.weight * item.quantity), 0)
    const totalItems = boxItems.reduce((sum, item) => sum + item.quantity, 0)
    return { totalWeight, totalItems, itemCount: boxItems.length }
  }
}
