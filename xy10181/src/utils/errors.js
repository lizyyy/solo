const ErrorCode = {
  SUCCESS: { code: 0, message: '成功' },

  QUOTA_NOT_FOUND: { code: 1001, message: '限额不存在' },
  QUOTA_INSUFFICIENT: { code: 1002, message: '限额不足' },
  QUOTA_DISABLED: { code: 1003, message: '限额已禁用' },
  QUOTA_EXPIRED: { code: 1004, message: '限额已过期' },

  APPROVAL_NOT_FOUND: { code: 2001, message: '审批记录不存在' },
  APPROVAL_NOT_PENDING: { code: 2002, message: '审批不在待处理状态' },
  APPROVAL_ALREADY_PROCESSED: { code: 2003, message: '审批已处理' },
  APPROVAL_EXPIRED: { code: 2004, message: '审批已过期' },
  APPROVAL_DUPLICATE_REQUEST: { code: 2005, message: '重复的审批请求' },

  CONCURRENT_CONFLICT: { code: 3001, message: '并发冲突，请重试' },
  RESOURCE_LOCKED: { code: 3002, message: '资源被锁定' },

  VALIDATION_ERROR: { code: 4000, message: '参数验证失败' },
  MISSING_REQUIRED_FIELD: { code: 4001, message: '缺少必填字段' },
  INVALID_AMOUNT: { code: 4002, message: '金额无效' },
  INVALID_STATUS: { code: 4003, message: '状态无效' },

  INTERNAL_ERROR: { code: 5000, message: '内部服务器错误' },
  DATABASE_ERROR: { code: 5001, message: '数据库错误' },
};

class AppError extends Error {
  constructor(errorCode, message, details = null) {
    super(message || errorCode.message);
    this.code = errorCode.code;
    this.name = 'AppError';
    this.details = details;
  }
}

module.exports = {
  ErrorCode,
  AppError,
};
