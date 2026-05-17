const { v4: uuidv4 } = require('uuid');

const CONTRACT_STATUSES = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  REVIEWED: 'REVIEWED',
  SYNCING: 'SYNCING',
  EFFECTIVE: 'EFFECTIVE',
  EXCEPTION: 'EXCEPTION',
  CORRECTED: 'CORRECTED'
};

const STATUS_TRANSITIONS = {
  [CONTRACT_STATUSES.DRAFT]: [CONTRACT_STATUSES.SUBMITTED],
  [CONTRACT_STATUSES.SUBMITTED]: [CONTRACT_STATUSES.REVIEWED, CONTRACT_STATUSES.EXCEPTION],
  [CONTRACT_STATUSES.REVIEWED]: [CONTRACT_STATUSES.SYNCING, CONTRACT_STATUSES.EXCEPTION],
  [CONTRACT_STATUSES.SYNCING]: [CONTRACT_STATUSES.EFFECTIVE, CONTRACT_STATUSES.EXCEPTION],
  [CONTRACT_STATUSES.EXCEPTION]: [CONTRACT_STATUSES.CORRECTED, CONTRACT_STATUSES.DRAFT],
  [CONTRACT_STATUSES.CORRECTED]: [CONTRACT_STATUSES.SUBMITTED, CONTRACT_STATUSES.EFFECTIVE]
};

const ALLOWED_SERVICE_SCOPES = [
  '云服务器', '对象存储', 'CDN加速', '数据库服务', 
  '负载均衡', '安全防护', '域名服务', '专线接入',
  '容器服务', '微服务引擎', '消息队列', '大数据服务'
];

class Contract {
  constructor(data) {
    this.id = uuidv4();
    this.contractNo = data.contractNo;
    this.customerName = data.customerName;
    this.contractType = data.contractType || 'SERVICE';
    this.version = data.version;
    this.effectiveDate = data.effectiveDate;
    this.price = data.price;
    this.serviceScope = data.serviceScope;
    this.status = CONTRACT_STATUSES.DRAFT;
    this.createdBy = data.createdBy;
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.statusHistory = [];
    this.syncRecords = [];
    this.corrections = [];
    this.addStatusHistory(CONTRACT_STATUSES.DRAFT, data.createdBy, '合同创建');
  }

  addStatusHistory(status, operator, comment = '') {
    this.statusHistory.push({
      id: uuidv4(),
      status,
      operator,
      comment,
      timestamp: new Date().toISOString()
    });
    this.updatedAt = new Date().toISOString();
  }

  canTransitionTo(newStatus) {
    const allowedTransitions = STATUS_TRANSITIONS[this.status] || [];
    return allowedTransitions.includes(newStatus);
  }

  transitionStatus(newStatus, operator, comment) {
    if (!this.canTransitionTo(newStatus)) {
      throw new Error(`无法从 ${this.status} 转换到 ${newStatus}`);
    }
    this.status = newStatus;
    this.addStatusHistory(newStatus, operator, comment);
    return this;
  }

  addSyncRecord(syncData) {
    const record = {
      id: uuidv4(),
      targetSystem: syncData.targetSystem,
      status: syncData.status || 'PENDING',
      requestData: syncData.requestData,
      responseData: syncData.responseData,
      errorMessage: syncData.errorMessage,
      operator: syncData.operator,
      timestamp: new Date().toISOString(),
      retryCount: syncData.retryCount || 0
    };
    this.syncRecords.push(record);
    this.updatedAt = new Date().toISOString();
    return record;
  }

  addCorrection(correctionData) {
    const correction = {
      id: uuidv4(),
      correctionType: correctionData.correctionType,
      oldValue: correctionData.oldValue,
      newValue: correctionData.newValue,
      reason: correctionData.reason,
      operator: correctionData.operator,
      approvalDoc: correctionData.approvalDoc,
      timestamp: new Date().toISOString()
    };
    this.corrections.push(correction);
    this.updatedAt = new Date().toISOString();
    return correction;
  }

  validateServiceScope() {
    const invalidItems = this.serviceScope.filter(
      item => !ALLOWED_SERVICE_SCOPES.includes(item)
    );
    return {
      valid: invalidItems.length === 0,
      invalidItems,
      allowedScopes: ALLOWED_SERVICE_SCOPES
    };
  }

  validatePrice() {
    return {
      valid: typeof this.price === 'number' && this.price >= 0,
      message: this.price < 0 ? '价格不能为负数' : '价格格式正确'
    };
  }

  toJSON() {
    return {
      id: this.id,
      contractNo: this.contractNo,
      customerName: this.customerName,
      contractType: this.contractType,
      version: this.version,
      effectiveDate: this.effectiveDate,
      price: this.price,
      serviceScope: this.serviceScope,
      status: this.status,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      statusHistory: this.statusHistory,
      syncRecords: this.syncRecords,
      corrections: this.corrections
    };
  }
}

module.exports = {
  Contract,
  CONTRACT_STATUSES,
  STATUS_TRANSITIONS,
  ALLOWED_SERVICE_SCOPES
};