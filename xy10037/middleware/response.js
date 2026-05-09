function success(data = null, message = 'success') {
  return {
    code: 0,
    message,
    data,
    timestamp: Date.now()
  };
}

function error(message = 'error', code = -1, data = null) {
  return {
    code,
    message,
    data,
    timestamp: Date.now()
  };
}

class BusinessError extends Error {
  constructor(message, code = -1) {
    super(message);
    this.code = code;
    this.name = 'BusinessError';
  }
}

class ConcurrencyError extends BusinessError {
  constructor(message = '数据已被其他用户修改，请刷新后重试') {
    super(message, 409);
    this.name = 'ConcurrencyError';
  }
}

class DuplicateRequestError extends BusinessError {
  constructor(message = '请求正在处理或已完成') {
    super(message, 409);
    this.name = 'DuplicateRequestError';
  }
}

class NotFoundError extends BusinessError {
  constructor(message = '资源不存在') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

class ValidationError extends BusinessError {
  constructor(message = '参数验证失败') {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

class StateTransitionError extends BusinessError {
  constructor(message = '状态流转不允许') {
    super(message, 400);
    this.name = 'StateTransitionError';
  }
}

module.exports = {
  success,
  error,
  BusinessError,
  ConcurrencyError,
  DuplicateRequestError,
  NotFoundError,
  ValidationError,
  StateTransitionError
};
