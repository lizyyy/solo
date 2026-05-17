const { v4: uuidv4 } = require('uuid');

const EXCEPTION_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SYNC_ERROR: 'SYNC_ERROR',
  STATUS_TRANSITION_ERROR: 'STATUS_TRANSITION_ERROR',
  DATA_INTEGRITY_ERROR: 'DATA_INTEGRITY_ERROR',
  BUSINESS_RULE_ERROR: 'BUSINESS_RULE_ERROR'
};

const BUSINESS_RULES = {
  PRICE_NON_NEGATIVE: 'RULE_001: 价格必须大于等于0',
  SERVICE_SCOPE_VALID: 'RULE_002: 服务范围必须在允许列表内',
  EFFECTIVE_DATE_VALID: 'RULE_003: 生效日期格式必须有效',
  CONTRACT_NO_UNIQUE: 'RULE_004: 合同编号必须唯一',
  VERSION_INCREMENTAL: 'RULE_005: 版本号必须递增'
};

class ExceptionRecord {
  constructor(data) {
    this.id = uuidv4();
    this.requestId = data.requestId || uuidv4();
    this.exceptionType = data.exceptionType;
    this.contractNo = data.contractNo || null;
    this.originalInput = data.originalInput;
    this.errorMessage = data.errorMessage;
    this.businessRule = data.businessRule || null;
    this.processingBasis = data.processingBasis || [];
    this.handler = data.handler || 'SYSTEM';
    this.resolved = false;
    this.resolutionNote = null;
    this.resolvedAt = null;
    this.createdAt = new Date().toISOString();
  }

  markResolved(handler, note) {
    this.resolved = true;
    this.handler = handler;
    this.resolutionNote = note;
    this.resolvedAt = new Date().toISOString();
    return this;
  }

  addProcessingBasis(basis) {
    this.processingBasis.push({
      id: uuidv4(),
      content: basis,
      timestamp: new Date().toISOString()
    });
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      requestId: this.requestId,
      exceptionType: this.exceptionType,
      contractNo: this.contractNo,
      originalInput: this.originalInput,
      errorMessage: this.errorMessage,
      businessRule: this.businessRule,
      processingBasis: this.processingBasis,
      handler: this.handler,
      resolved: this.resolved,
      resolutionNote: this.resolutionNote,
      resolvedAt: this.resolvedAt,
      createdAt: this.createdAt
    };
  }
}

module.exports = {
  ExceptionRecord,
  EXCEPTION_TYPES,
  BUSINESS_RULES
};