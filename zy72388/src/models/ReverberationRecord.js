export class ReverberationRecord {
  constructor(data = {}) {
    this.id = data.id || this.generateId()
    this.sampleTime = data.sampleTime || null
    this.reverberationTime = data.reverberationTime || null
    this.frequency = data.frequency || null
    this.location = data.location || ''
    this.materialType = data.materialType || 'normal'
    this.importTime = data.importTime || new Date().toISOString()
    this.isSupplement = data.isSupplement || false
    this.supplementReason = data.supplementReason || ''
    this.supplementedBy = data.supplementedBy || ''
    this.originalRecordId = data.originalRecordId || null
    this.keepMissingReason = data.keepMissingReason || ''
    this.status = data.status || 'pending'
  }

  generateId() {
    return 'REC_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  toJSON() {
    return {
      id: this.id,
      sampleTime: this.sampleTime,
      reverberationTime: this.reverberationTime,
      frequency: this.frequency,
      location: this.location,
      materialType: this.materialType,
      importTime: this.importTime,
      isSupplement: this.isSupplement,
      supplementReason: this.supplementReason,
      supplementedBy: this.supplementedBy,
      originalRecordId: this.originalRecordId,
      keepMissingReason: this.keepMissingReason,
      status: this.status
    }
  }
}
