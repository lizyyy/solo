const { SourceType, RecordStatus, OperationType } = require('./constants');

class CreditRecord {
  constructor(data) {
    this.id = data.id || Date.now().toString();
    this.accountId = data.accountId;
    this.accountName = data.accountName;
    this.creditAmount = Number(data.creditAmount);
    this.usedAmount = Number(data.usedAmount) || 0;
    this.availableAmount = this.creditAmount - this.usedAmount;
    this.sourceType = data.sourceType;
    this.sourceId = data.sourceId;
    this.sourceDate = data.sourceDate || new Date().toISOString().split('T')[0];
    this.status = data.status || RecordStatus.PENDING_SUPPLEMENT;
    this.operationType = data.operationType || OperationType.MATERIAL_SUPPLEMENT;
    this.remark = data.remark || '';
    this.handler = data.handler || '';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.history = data.history || [];
  }

  update(data, operator) {
    this.history.push({
      before: {
        creditAmount: this.creditAmount,
        usedAmount: this.usedAmount,
        status: this.status,
        remark: this.remark
      },
      operator,
      changedAt: new Date().toISOString()
    });

    if (data.creditAmount !== undefined) {
      this.creditAmount = Number(data.creditAmount);
    }
    if (data.usedAmount !== undefined) {
      this.usedAmount = Number(data.usedAmount);
    }
    this.availableAmount = this.creditAmount - this.usedAmount;
    
    if (data.status !== undefined) {
      this.status = data.status;
    }
    if (data.remark !== undefined) {
      this.remark = data.remark;
    }
    if (data.handler !== undefined) {
      this.handler = data.handler;
    }
    if (data.operationType !== undefined) {
      this.operationType = data.operationType;
    }
    this.updatedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      accountId: this.accountId,
      accountName: this.accountName,
      creditAmount: this.creditAmount,
      usedAmount: this.usedAmount,
      availableAmount: this.availableAmount,
      sourceType: this.sourceType,
      sourceId: this.sourceId,
      sourceDate: this.sourceDate,
      status: this.status,
      operationType: this.operationType,
      remark: this.remark,
      handler: this.handler,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      history: this.history
    };
  }
}

module.exports = CreditRecord;
