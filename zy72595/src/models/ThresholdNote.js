const { generateId, getBucketIndex } = require('./types');

class ThresholdNote {
  constructor(data) {
    this.id = data.id || generateId();
    this.batchId = data.batchId;
    this.thresholds = data.thresholds || {};
    this.remark = data.remark || '';
    this.offlineScore = data.offlineScore;
    this.onlineScore = data.onlineScore;
    this.offlineBucket = data.offlineBucket;
    this.onlineBucket = data.onlineBucket;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.updatedBy = data.updatedBy || '';
    this.versions = data.versions || [];
    
    if (this.versions.length === 0) {
      this.versions.push({
          version: 1,
          timestamp: this.createdAt,
          remark: this.remark,
          thresholds: JSON.parse(JSON.stringify(this.thresholds)),
          updatedBy: this.updatedBy,
          changeType: 'create'
        });
    }
  }

  getOfflineBucketIndex() {
    return getBucketIndex(this.offlineBucket);
  }

  getOnlineBucketIndex() {
    return getBucketIndex(this.onlineBucket);
  }

  getBucketDiff() {
    const offlineIdx = this.getOfflineBucketIndex();
    const onlineIdx = this.getOnlineBucketIndex();
    if (offlineIdx === null || onlineIdx === null) return null;
    return Math.abs(onlineIdx - offlineIdx);
  }

  isOneBucketDiff() {
    const diff = this.getBucketDiff();
    return diff === 1;
  }

  updateRemark(newRemark, operator) {
    const oldRemark = this.remark;
    this.remark = newRemark;
    this.updatedAt = new Date().toISOString();
    this.updatedBy = operator;
    this.versions.push({
      version: this.versions.length + 1,
      timestamp: this.updatedAt,
      remark: newRemark,
      oldRemark: oldRemark,
      thresholds: JSON.parse(JSON.stringify(this.thresholds)),
      updatedBy: operator,
      changeType: 'remark_update'
    });
    return this;
  }

  getVersionDiff(versionNum) {
    return this.versions.find(v => v.version === versionNum) || null;
  }

  getChangeHistory() {
    return this.versions.map(v => ({
      version: v.version,
      timestamp: v.timestamp,
      changeType: v.changeType,
      updatedBy: v.updatedBy,
      remark: v.remark,
      oldRemark: v.oldRemark,
      thresholds: v.thresholds
    }));
  }
}

module.exports = ThresholdNote;
