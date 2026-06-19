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
    this.relatedMissingId = data.relatedMissingId || null
    this.supplementTime = data.supplementTime || null
    this.keepMissingReason = data.keepMissingReason || ''
    this.status = data.status || 'pending'
    this.supplementStatus = data.supplementStatus || null
    this.supplementedCount = data.supplementedCount || 0
    this.lastSupplementedAt = data.lastSupplementedAt || null
    this.batchId = data.batchId || null
    this.updatedAt = data.updatedAt || null
    this.updatedBy = data.updatedBy || ''
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
      relatedMissingId: this.relatedMissingId,
      supplementTime: this.supplementTime,
      keepMissingReason: this.keepMissingReason,
      status: this.status,
      supplementStatus: this.supplementStatus,
      supplementedCount: this.supplementedCount,
      lastSupplementedAt: this.lastSupplementedAt,
      batchId: this.batchId,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy
    }
  }
}
