const { generateId, BUCKET_NAMES } = require('./types');

class OnlineExperimentBucket {
  constructor(data) {
    this.id = data.id || generateId();
    this.bucketName = data.bucketName;
    this.experimentId = data.experimentId;
    this.metrics = data.metrics || {};
    this.startTime = data.startTime;
    this.endTime = data.endTime;
    this.status = data.status || 'running';
    this.remark = data.remark || '';
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  isValidBucket() {
    return BUCKET_NAMES.includes(this.bucketName);
  }
}

module.exports = OnlineExperimentBucket;
