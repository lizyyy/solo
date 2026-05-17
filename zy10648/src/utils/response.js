class ApiResponse {
  constructor(success, data = null, message = '', code = 0) {
    this.success = success;
    this.code = code;
    this.message = message;
    this.data = data;
    this.timestamp = new Date().toISOString();
  }

  static success(data, message = '操作成功') {
    return new ApiResponse(true, data, message, 200);
  }

  static error(message, code = 400, data = null) {
    return new ApiResponse(false, data, message, code);
  }

  static businessError(businessCode, message, data = null) {
    return new ApiResponse(false, data, message, businessCode);
  }
}

const BUSINESS_CODES = {
  BORROW_NOT_FOUND: 10001,
  ASSET_NOT_FOUND: 10002,
  USER_NOT_FOUND: 10003,
  ALREADY_RETURNED: 10004,
  DEPARTMENT_CONFLICT: 10005,
  REMINDER_TOO_FREQUENT: 10006,
  INVALID_DATE: 10007,
  IMPORT_ERROR: 10008,
  EXPORT_ERROR: 10009
};

const BUSINESS_MESSAGES = {
  [BUSINESS_CODES.BORROW_NOT_FOUND]: '借用记录不存在',
  [BUSINESS_CODES.ASSET_NOT_FOUND]: '资产不存在',
  [BUSINESS_CODES.USER_NOT_FOUND]: '用户不存在',
  [BUSINESS_CODES.ALREADY_RETURNED]: '该资产已归还，无需催还',
  [BUSINESS_CODES.DEPARTMENT_CONFLICT]: '借用人部门信息已变更，存在通知冲突，请确认接收人',
  [BUSINESS_CODES.REMINDER_TOO_FREQUENT]: '催还操作过于频繁，请稍后再试',
  [BUSINESS_CODES.INVALID_DATE]: '日期格式无效',
  [BUSINESS_CODES.IMPORT_ERROR]: '数据导入失败',
  [BUSINESS_CODES.EXPORT_ERROR]: '数据导出失败'
};

module.exports = { ApiResponse, BUSINESS_CODES, BUSINESS_MESSAGES };
