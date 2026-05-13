const { v4: uuidv4 } = require('uuid');

class StatusHistory {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.cylinderId = data.cylinderId;
    this.cylinderNo = data.cylinderNo;
    this.fromStatus = data.fromStatus || null;
    this.toStatus = data.toStatus;
    this.changeReason = data.changeReason || '';
    this.operator = data.operator || '';
    this.batchNo = data.batchNo || null;
    this.customer = data.customer || null;
    this.oldValues = data.oldValues || {};
    this.newValues = data.newValues || {};
    this.remark = data.remark || '';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.requestId = data.requestId || null;
  }
}

module.exports = StatusHistory;
