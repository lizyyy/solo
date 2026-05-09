export function successResponse(data, message = 'Success') {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
}

export function errorResponse(message, code = 'UNKNOWN_ERROR', details = null) {
  return {
    success: false,
    error: {
      message,
      code,
      details
    },
    timestamp: new Date().toISOString()
  };
}

export class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class DuplicateRequestError extends AppError {
  constructor(message = '请求已处理', existingData = null) {
    super(message, 'DUPLICATE_REQUEST', 409);
    this.existingData = existingData;
  }
}

export class ConcurrencyError extends AppError {
  constructor(message = '数据已被其他操作修改，请刷新后重试') {
    super(message, 'CONCURRENCY_ERROR', 409);
  }
}

export class ValidationError extends AppError {
  constructor(message = '参数验证失败', details = null) {
    super(message, 'VALIDATION_ERROR', 400);
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message = '资源不存在') {
    super(message, 'NOT_FOUND', 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = '操作冲突') {
    super(message, 'CONFLICT', 409);
  }
}
