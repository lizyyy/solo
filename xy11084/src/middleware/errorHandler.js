class BusinessError extends Error {
  constructor(type, message, detail, suggestion, severity = 'high') {
    super(message);
    this.name = 'BusinessError';
    this.type = type;
    this.detail = detail;
    this.suggestion = suggestion;
    this.severity = severity;
    this.statusCode = 409;
  }

  toJSON() {
    return {
      error: true,
      type: this.type,
      message: this.message,
      detail: this.detail,
      suggestion: this.suggestion,
      severity: this.severity,
      timestamp: new Date().toISOString()
    };
  }
}

class ValidationError extends Error {
  constructor(message, errors) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
    this.statusCode = 400;
  }

  toJSON() {
    return {
      error: true,
      type: 'VALIDATION_ERROR',
      message: this.message,
      errors: this.errors,
      timestamp: new Date().toISOString()
    };
  }
}

class NotFoundError extends Error {
  constructor(resource, id) {
    super(`${resource}未找到: ${id}`);
    this.name = 'NotFoundError';
    this.resource = resource;
    this.id = id;
    this.statusCode = 404;
  }

  toJSON() {
    return {
      error: true,
      type: 'NOT_FOUND',
      message: this.message,
      resource: this.resource,
      id: this.id,
      timestamp: new Date().toISOString()
    };
  }
}

function errorHandler(err, req, res, next) {
  console.error('错误详情:', err);

  if (err instanceof BusinessError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  if (err instanceof NotFoundError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: true,
      type: 'JSON_PARSE_ERROR',
      message: '请求体JSON格式错误',
      timestamp: new Date().toISOString()
    });
  }

  res.status(500).json({
    error: true,
    type: 'INTERNAL_SERVER_ERROR',
    message: '服务器内部错误，请稍后重试',
    timestamp: new Date().toISOString()
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: true,
    type: 'ENDPOINT_NOT_FOUND',
    message: `请求的接口不存在: ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  BusinessError,
  ValidationError,
  NotFoundError,
  errorHandler,
  notFoundHandler
};