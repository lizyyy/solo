const logger = require('../config/logger');
const { BusinessError } = require('./errors');

const statusMap = {
  SUCCESS: { code: 0, message: '操作成功' },
  CREATED: { code: 0, message: '创建成功' },
  UPDATED: { code: 0, message: '更新成功' },
  DELETED: { code: 0, message: '删除成功' },
  BAD_REQUEST: { code: 400, message: '请求参数错误' },
  UNAUTHORIZED: { code: 401, message: '未授权访问' },
  FORBIDDEN: { code: 403, message: '权限不足' },
  NOT_FOUND: { code: 404, message: '资源不存在' },
  INTERNAL_ERROR: { code: 500, message: '系统内部错误，请稍后重试' },
  BUSINESS_ERROR: { code: 1000, message: '业务处理失败' },
  SEGMENT_EXHAUSTED: { code: 1001, message: '号段已用完' },
  RECEIPT_ALREADY_USED: { code: 1002, message: '收据号已被使用' },
  RECEIPT_ALREADY_VOIDED: { code: 1003, message: '收据号已作废' },
  RECEIPT_NOT_EXISTS: { code: 1004, message: '收据号不存在' }
};

class ApiResponse {
  constructor(success, code, message, data = null, details = null) {
    this.success = success;
    this.code = code;
    this.message = message;
    this.data = data;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    const result = {
      success: this.success,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp
    };
    
    if (this.data !== null) {
      result.data = this.data;
    }
    
    if (this.details !== null) {
      result.details = this.details;
    }
    
    return result;
  }
}

function success(data = null, message = '操作成功') {
  return new ApiResponse(true, 0, message, data);
}

function created(data = null, message = '创建成功') {
  return new ApiResponse(true, 0, message, data);
}

function businessError(code, message, details = null) {
  return new ApiResponse(false, code, message, null, details);
}

function validationError(errors) {
  return new ApiResponse(
    false,
    400,
    '请求参数验证失败',
    null,
    errors
  );
}

function notFound(message = '资源不存在') {
  return new ApiResponse(false, 404, message);
}

function internalError(message = '系统内部错误，请稍后重试') {
  return new ApiResponse(false, 500, message);
}

function handleError(error) {
  logger.error('API错误:', error);
  
  if (error instanceof BusinessError) {
    return new ApiResponse(
      false,
      error.code || 1000,
      error.message,
      null,
      error.details
    );
  }
  
  if (error.name === 'SequelizeValidationError') {
    const details = error.errors?.map(e => ({
      field: e.path,
      message: e.message
    }));
    return validationError(details);
  }
  
  if (error.name === 'SequelizeUniqueConstraintError') {
    return new ApiResponse(
      false,
      400,
      '数据唯一性约束违反',
      null,
      error.errors?.map(e => e.message)
    );
  }
  
  return internalError(error.message || '系统内部错误');
}

module.exports = {
  ApiResponse,
  success,
  created,
  businessError,
  validationError,
  notFound,
  internalError,
  handleError,
  statusMap
};
