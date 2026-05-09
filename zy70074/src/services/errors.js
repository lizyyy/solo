class BusinessError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.details = details;
    this.isBusinessError = true;
  }

  toResponse() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details
      }
    };
  }
}

const ErrorCodes = {
  ASSET_NOT_FOUND: 'ASSET_NOT_FOUND',
  ASSET_STATUS_INVALID: 'ASSET_STATUS_INVALID',
  TRANSFER_NOT_FOUND: 'TRANSFER_NOT_FOUND',
  TRANSFER_INVALID_TRANSITION: 'TRANSFER_INVALID_TRANSITION',
  TRANSFER_DUPLICATE_SUBMISSION: 'TRANSFER_DUPLICATE_SUBMISSION',
  TRANSFER_ALREADY_EXISTS: 'TRANSFER_ALREADY_EXISTS',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  APPROVAL_NOT_ALLOWED: 'APPROVAL_NOT_ALLOWED',
  DEPRECIATION_CONFIG_NOT_FOUND: 'DEPRECIATION_CONFIG_NOT_FOUND',
  INVENTORY_ASSET_SHORT: 'INVENTORY_ASSET_SHORT',
  INVALID_REQUEST: 'INVALID_REQUEST',
  TASK_FAILED: 'TASK_FAILED'
};

const ErrorMessages = {
  [ErrorCodes.ASSET_NOT_FOUND]: '资产不存在',
  [ErrorCodes.ASSET_STATUS_INVALID]: '资产状态不允许执行此操作',
  [ErrorCodes.TRANSFER_NOT_FOUND]: '调拨单不存在',
  [ErrorCodes.TRANSFER_INVALID_TRANSITION]: '非法的调拨状态流转',
  [ErrorCodes.TRANSFER_DUPLICATE_SUBMISSION]: '检测到重复提交请求',
  [ErrorCodes.TRANSFER_ALREADY_EXISTS]: '该资产已有正在进行的调拨单',
  [ErrorCodes.VERSION_CONFLICT]: '数据已被其他操作修改，请刷新后重试',
  [ErrorCodes.APPROVAL_NOT_ALLOWED]: '无此审批权限',
  [ErrorCodes.DEPRECIATION_CONFIG_NOT_FOUND]: '折旧配置不存在',
  [ErrorCodes.INVENTORY_ASSET_SHORT]: '资产处于盘亏状态，调拨前需先处理盘点差异',
  [ErrorCodes.INVALID_REQUEST]: '请求参数无效',
  [ErrorCodes.TASK_FAILED]: '后台任务执行失败'
};

function createError(code, details = null, customMessage = null) {
  const message = customMessage || ErrorMessages[code] || '业务处理失败';
  return new BusinessError(code, message, details);
}

function errorHandler(err, req, res, next) {
  if (err.isBusinessError) {
    return res.status(400).json(err.toResponse());
  }
  
  console.error('Unexpected error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误'
    }
  });
}

module.exports = {
  BusinessError,
  ErrorCodes,
  createError,
  errorHandler
};
