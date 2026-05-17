class HistoryLog {
  constructor(id, callRecordId, action, operator, details, previousStatus, newStatus) {
    this.id = id;
    this.callRecordId = callRecordId;
    this.action = action;
    this.operator = operator;
    this.details = details;
    this.previousStatus = previousStatus;
    this.newStatus = newStatus;
    this.timestamp = new Date();
  }
}

module.exports = HistoryLog;
