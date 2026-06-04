const { v4: uuidv4 } = require('uuid');

class WorkPhoto {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.hash = data.hash;
    this.fileName = data.fileName;
    this.filePath = data.filePath;
    this.uploadTime = data.uploadTime || new Date().toISOString();
    this.uploadedBy = data.uploadedBy;
    this.sensorNumbers = data.sensorNumbers || [];
    this.timestamp = data.timestamp;
    this.location = data.location;
    this.notes = data.notes || '';
    this.importBatchId = data.importBatchId;
    this.status = data.status || 'pending_review';
    this.reviewedBy = data.reviewedBy || null;
    this.reviewedAt = data.reviewedAt || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  static fromJSON(json) {
    return new WorkPhoto(JSON.parse(json));
  }

  toJSON() {
    return {
      id: this.id,
      hash: this.hash,
      fileName: this.fileName,
      filePath: this.filePath,
      uploadTime: this.uploadTime,
      uploadedBy: this.uploadedBy,
      sensorNumbers: this.sensorNumbers,
      timestamp: this.timestamp,
      location: this.location,
      notes: this.notes,
      importBatchId: this.importBatchId,
      status: this.status,
      reviewedBy: this.reviewedBy,
      reviewedAt: this.reviewedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  static generateHash(fileBuffer) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  getDeduplicationKey() {
    return `${this.hash}_${this.timestamp || this.uploadTime}`;
  }

  approve(reviewer) {
    this.status = 'approved';
    this.reviewedBy = reviewer;
    this.reviewedAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  reject(reviewer, reason) {
    this.status = 'rejected';
    this.reviewedBy = reviewer;
    this.reviewedAt = new Date().toISOString();
    this.notes = reason + '\n' + this.notes;
    this.updatedAt = new Date().toISOString();
  }
}

module.exports = WorkPhoto;
