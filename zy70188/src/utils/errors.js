class BusinessError extends Error {
  constructor(message, code = 'BUSINESS_ERROR', details = null) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.details = details;
  }
}

class ResourceNotFoundError extends BusinessError {
  constructor(message = '资源不存在') {
    super(message, 'RESOURCE_NOT_FOUND');
  }
}

class ValidationError extends BusinessError {
  constructor(message = '参数验证失败', details = null) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

class SegmentExhaustedError extends BusinessError {
  constructor(segmentCode = '') {
    super(`号段「${segmentCode}」已用完，请联系管理员`, 'SEGMENT_EXHAUSTED');
  }
}

class ReceiptAlreadyUsedError extends BusinessError {
  constructor(receiptNumber) {
    super(`收据号「${receiptNumber}」已被使用`, 'RECEIPT_ALREADY_USED');
  }
}

class ReceiptAlreadyVoidedError extends BusinessError {
  constructor(receiptNumber) {
    super(`收据号「${receiptNumber}」已作废`, 'RECEIPT_ALREADY_VOIDED');
  }
}

class ReceiptNotExistsError extends BusinessError {
  constructor(receiptNumber) {
    super(`收据号「${receiptNumber}」不存在`, 'RECEIPT_NOT_EXISTS');
  }
}

class ConcurrentModificationError extends BusinessError {
  constructor(message = '数据已被其他操作修改，请刷新后重试') {
    super(message, 'CONCURRENT_MODIFICATION');
  }
}

class CompensationTaskExistsError extends BusinessError {
  constructor(businessKey) {
    super(`业务标识「${businessKey}」已有待处理的补偿任务`, 'COMPENSATION_EXISTS');
  }
}

module.exports = {
  BusinessError,
  ResourceNotFoundError,
  ValidationError,
  SegmentExhaustedError,
  ReceiptAlreadyUsedError,
  ReceiptAlreadyVoidedError,
  ReceiptNotExistsError,
  ConcurrentModificationError,
  CompensationTaskExistsError
};
