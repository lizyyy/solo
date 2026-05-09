class ApiResponse {
  static success(data, message = '操作成功') {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    };
  }

  static error(message, code = 500, data = null) {
    return {
      success: false,
      message,
      code,
      data,
      timestamp: new Date().toISOString()
    };
  }

  static validationError(errors, message = '参数校验失败') {
    return {
      success: false,
      message,
      code: 400,
      errors,
      timestamp: new Date().toISOString()
    };
  }

  static pagination(data, total, page, pageSize) {
    return {
      success: true,
      data,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: parseInt(total),
        totalPages: Math.ceil(total / pageSize)
      },
      timestamp: new Date().toISOString()
    };
  }
}

class ApiError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'ApiError';
  }
}

module.exports = { ApiResponse, ApiError };
