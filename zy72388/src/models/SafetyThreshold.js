export class SafetyThreshold {
  constructor(data = {}) {
    this.id = data.id || this.generateId()
    this.frequency = data.frequency || null
    this.minReverberationTime = data.minReverberationTime || 0
    this.maxReverberationTime = data.maxReverberationTime || 2
    this.location = data.location || ''
    this.updateTime = data.updateTime || new Date().toISOString()
    this.updatedBy = data.updatedBy || ''
  }

  generateId() {
    return 'THR_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  isWithinRange(reverberationTime) {
    return reverberationTime >= this.minReverberationTime && 
           reverberationTime <= this.maxReverberationTime
  }

  toJSON() {
    return {
      id: this.id,
      frequency: this.frequency,
      minReverberationTime: this.minReverberationTime,
      maxReverberationTime: this.maxReverberationTime,
      location: this.location,
      updateTime: this.updateTime,
      updatedBy: this.updatedBy
    }
  }
}
