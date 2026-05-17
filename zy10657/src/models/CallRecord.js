const CALL_STATUS = {
  PENDING: 'pending',
  INTERCEPTED: 'intercepted',
  CALLED: 'called',
  ARCHIVED: 'archived'
};

class CallRecord {
  constructor(id, taskBatchId, phoneNumber, customerName, importData = {}) {
    this.id = id;
    this.taskBatchId = taskBatchId;
    this.phoneNumber = phoneNumber;
    this.customerName = customerName;
    this.status = CALL_STATUS.PENDING;
    this.callResult = null;
    this.callTime = null;
    this.interceptReason = null;
    this.interceptTime = null;
    this.reviewedBy = null;
    this.reviewTime = null;
    this.reviewComment = null;
    this.importData = importData;
    this.importError = null;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

module.exports = { CallRecord, CALL_STATUS };
