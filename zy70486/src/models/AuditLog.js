const { v4: uuidv4 } = require('uuid');

const AuditAction = {
  ISSUE: 'issue',
  VERIFY: 'verify',
  EXECUTE: 'execute',
  REVOKE: 'revoke',
  EXPIRE_CHECK: 'expire_check'
};

class AuditLog {
  constructor({
    tokenId,
    action,
    operatorId,
    operatorName,
    success,
    errorCode = null,
    errorMessage = null,
    details = {}
  }) {
    this.logId = uuidv4();
    this.tokenId = tokenId;
    this.action = action;
    this.operatorId = operatorId;
    this.operatorName = operatorName;
    this.timestamp = new Date();
    this.success = success;
    this.errorCode = errorCode;
    this.errorMessage = errorMessage;
    this.details = details;
  }

  toJSON() {
    return {
      logId: this.logId,
      tokenId: this.tokenId,
      action: this.action,
      operatorId: this.operatorId,
      operatorName: this.operatorName,
      timestamp: this.timestamp,
      success: this.success,
      errorCode: this.errorCode,
      errorMessage: this.errorMessage,
      details: this.details
    };
  }
}

module.exports = { AuditLog, AuditAction };
