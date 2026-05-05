// 风险类型
export const RISK_TYPES = {
  PRIORITY: 'priority',
  BATTERY: 'battery',
  ADJUST: 'adjust',
  OVERDUE: 'overdue',
  NORMAL: 'normal'
}

// 风险等级
export const RISK_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  NORMAL: 'normal'
}

// 风险类型标签
export const RISK_TAGS = {
  [RISK_TYPES.PRIORITY]: { label: '优先回访', class: 'priority' },
  [RISK_TYPES.BATTERY]: { label: '需换电池', class: 'battery' },
  [RISK_TYPES.ADJUST]: { label: '需调参数', class: 'adjust' },
  [RISK_TYPES.OVERDUE]: { label: '设备未还', class: 'overdue' },
  [RISK_TYPES.NORMAL]: { label: '正常', class: 'normal' }
}

// 老人基本信息
export class ElderlyInfo {
  constructor(data = {}) {
    this.id = data.id || this.generateId()
    this.name = data.name || ''
    this.age = data.age || 0
    this.gender = data.gender || ''
    this.phone = data.phone || ''
    this.address = data.address || ''
    this.hearingScreening = data.hearingScreening || null
    this.deviceInfo = data.deviceInfo || null
    this.repairRecords = data.repairRecords || []
    this.nextAppointment = data.nextAppointment || null
    this.remarks = data.remarks || ''
    this.manualOverride = data.manualOverride || null
    this.createdAt = data.createdAt || new Date().toISOString()
    this.updatedAt = data.updatedAt || new Date().toISOString()
  }

  generateId() {
    return 'elder_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      age: this.age,
      gender: this.gender,
      phone: this.phone,
      address: this.address,
      hearingScreening: this.hearingScreening,
      deviceInfo: this.deviceInfo,
      repairRecords: this.repairRecords,
      nextAppointment: this.nextAppointment,
      remarks: this.remarks,
      manualOverride: this.manualOverride,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}

// 听力筛查数据
export class HearingScreening {
  constructor(data = {}) {
    this.id = data.id || this.generateId()
    this.elderlyId = data.elderlyId || ''
    this.screeningDate = data.screeningDate || ''
    this.leftEar = {
      pta: data.leftEar?.pta || 0,
      thresholds: data.leftEar?.thresholds || []
    }
    this.rightEar = {
      pta: data.rightEar?.pta || 0,
      thresholds: data.rightEar?.thresholds || []
    }
    this.speechRecognition = data.speechRecognition || 0
    this.tinnitus = data.tinnitus || false
    this.earDischarge = data.earDischarge || false
    this.notes = data.notes || ''
    this.createdAt = data.createdAt || new Date().toISOString()
  }

  generateId() {
    return 'screening_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  // 获取听力损失程度
  getHearingLossLevel(pta) {
    if (pta <= 25) return 'normal'
    if (pta <= 40) return 'mild'
    if (pta <= 55) return 'moderate'
    if (pta <= 70) return 'moderately_severe'
    if (pta <= 90) return 'severe'
    return 'profound'
  }

  toJSON() {
    return {
      id: this.id,
      elderlyId: this.elderlyId,
      screeningDate: this.screeningDate,
      leftEar: this.leftEar,
      rightEar: this.rightEar,
      speechRecognition: this.speechRecognition,
      tinnitus: this.tinnitus,
      earDischarge: this.earDischarge,
      notes: this.notes,
      createdAt: this.createdAt
    }
  }
}

// 设备信息
export class DeviceInfo {
  constructor(data = {}) {
    this.id = data.id || this.generateId()
    this.elderlyId = data.elderlyId || ''
    this.model = data.model || ''
    this.serialNumber = data.serialNumber || ''
    this.manufacturer = data.manufacturer || ''
    this.purchaseDate = data.purchaseDate || ''
    this.warrantyExpiry = data.warrantyExpiry || ''
    this.batteryType = data.batteryType || ''
    this.lastBatteryChange = data.lastBatteryChange || ''
    this.batteryLifeMonths = data.batteryLifeMonths || 3
    this.lastAdjustment = data.lastAdjustment || ''
    this.fittingDate = data.fittingDate || ''
    this.notes = data.notes || ''
    this.createdAt = data.createdAt || new Date().toISOString()
    this.updatedAt = data.updatedAt || new Date().toISOString()
  }

  generateId() {
    return 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  toJSON() {
    return {
      id: this.id,
      elderlyId: this.elderlyId,
      model: this.model,
      serialNumber: this.serialNumber,
      manufacturer: this.manufacturer,
      purchaseDate: this.purchaseDate,
      warrantyExpiry: this.warrantyExpiry,
      batteryType: this.batteryType,
      lastBatteryChange: this.lastBatteryChange,
      batteryLifeMonths: this.batteryLifeMonths,
      lastAdjustment: this.lastAdjustment,
      fittingDate: this.fittingDate,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}

// 维修记录
export class RepairRecord {
  constructor(data = {}) {
    this.id = data.id || this.generateId()
    this.elderlyId = data.elderlyId || ''
    this.deviceId = data.deviceId || ''
    this.repairDate = data.repairDate || ''
    this.returnDate = data.returnDate || null
    this.problemDescription = data.problemDescription || ''
    this.repairActions = data.repairActions || ''
    this.cost = data.cost || 0
    this.status = data.status || 'pending'
    this.notes = data.notes || ''
    this.createdAt = data.createdAt || new Date().toISOString()
    this.updatedAt = data.updatedAt || new Date().toISOString()
  }

  generateId() {
    return 'repair_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  toJSON() {
    return {
      id: this.id,
      elderlyId: this.elderlyId,
      deviceId: this.deviceId,
      repairDate: this.repairDate,
      returnDate: this.returnDate,
      problemDescription: this.problemDescription,
      repairActions: this.repairActions,
      cost: this.cost,
      status: this.status,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}

// 预约信息
export class Appointment {
  constructor(data = {}) {
    this.id = data.id || this.generateId()
    this.elderlyId = data.elderlyId || ''
    this.date = data.date || ''
    this.time = data.time || ''
    this.type = data.type || 'follow_up'
    this.purpose = data.purpose || ''
    this.location = data.location || ''
    this.volunteer = data.volunteer || ''
    this.status = data.status || 'scheduled'
    this.notes = data.notes || ''
    this.createdAt = data.createdAt || new Date().toISOString()
    this.updatedAt = data.updatedAt || new Date().toISOString()
  }

  generateId() {
    return 'appointment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  toJSON() {
    return {
      id: this.id,
      elderlyId: this.elderlyId,
      date: this.date,
      time: this.time,
      type: this.type,
      purpose: this.purpose,
      location: this.location,
      volunteer: this.volunteer,
      status: this.status,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }
}
