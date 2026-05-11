const ErrorCode = {
  STOP_NOT_FOUND: 'STOP_NOT_FOUND',
  STOP_INACTIVE: 'STOP_INACTIVE',
  STOP_ARCHIVE_NOT_VERIFIED: 'STOP_ARCHIVE_NOT_VERIFIED',
  
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
  ROUTE_VERSION_MISMATCH: 'ROUTE_VERSION_MISMATCH',
  ROUTE_STOP_ASSOCIATION_INVALID: 'ROUTE_STOP_ASSOCIATION_INVALID',
  
  REPORT_TYPE_INVALID: 'REPORT_TYPE_INVALID',
  REPORT_NOT_FOUND: 'REPORT_NOT_FOUND',
  REPORT_STATUS_INVALID_TRANSITION: 'REPORT_STATUS_INVALID_TRANSITION',
  REPORT_ALREADY_PROCESSED: 'REPORT_ALREADY_PROCESSED',
  
  DISPATCH_DUPLICATE: 'DISPATCH_DUPLICATE',
  DISPATCH_NOT_FOUND: 'DISPATCH_NOT_FOUND',
  
  TEAM_ID_INVALID: 'TEAM_ID_INVALID',
  
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

class BusinessError extends Error {
  constructor(code, message, details = {}) {
    super(message);
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
      },
      actionRequired: this.getActionRequired()
    };
  }
  
  getActionRequired() {
    switch (this.code) {
      case ErrorCode.STOP_NOT_FOUND:
        return '请核对站牌编号，或先同步站牌档案到系统';
      case ErrorCode.STOP_INACTIVE:
        return '该站牌已停用，请确认上报对象';
      case ErrorCode.STOP_ARCHIVE_NOT_VERIFIED:
        return '站牌档案未经验证，请先调用验证接口';
      case ErrorCode.ROUTE_VERSION_MISMATCH:
        return `线路数据版本不一致，当前系统版本: ${this.details.systemVersion}, 上报版本: ${this.details.reportVersion}，请同步最新线路数据后重报`;
      case ErrorCode.ROUTE_STOP_ASSOCIATION_INVALID:
        return '上报的线路与站牌无关联，请核对线路归属';
      case ErrorCode.REPORT_TYPE_INVALID:
        return '上报类型不支持，当前队伍只能上报: ' + (this.details.allowedTypes || []).join(', ');
      case ErrorCode.DISPATCH_DUPLICATE:
        return '已存在同类待处理派修单，系统已自动去重';
      case ErrorCode.VALIDATION_ERROR:
        return '请检查请求参数格式是否正确';
      default:
        return '请联系技术支持';
    }
  }
}

module.exports = {
  ErrorCode,
  BusinessError
};
