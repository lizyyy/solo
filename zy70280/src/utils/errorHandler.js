class BusinessError extends Error {
  constructor(message, code = 'BUSINESS_ERROR', details = null) {
    super(message);
    this.code = code;
    this.details = details;
    this.statusCode = 400;
  }
}

class ValidationError extends BusinessError {
  constructor(message, details = null) {
    super(message, 'VALIDATION_ERROR', details);
    this.statusCode = 400;
  }
}

class NotFoundError extends BusinessError {
  constructor(message, details = null) {
    super(message, 'NOT_FOUND_ERROR', details);
    this.statusCode = 404;
  }
}

class StateError extends BusinessError {
  constructor(message, details = null) {
    super(message, 'STATE_ERROR', details);
    this.statusCode = 409;
  }
}

class PermissionError extends BusinessError {
  constructor(message, details = null) {
    super(message, 'PERMISSION_ERROR', details);
    this.statusCode = 403;
  }
}

const errorHandler = (err, req, res, next) => {
  console.error('[Error]', err.message, err.stack);
  
  if (err instanceof BusinessError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }
  
  if (err.name === 'SequelizeValidationError') {
    const details = err.errors.map(e => ({
      field: e.path,
      message: e.message
    }));
    return res.status(400).json({
      success: false,
      error: {
        code: 'DATABASE_VALIDATION_ERROR',
        message: '数据验证失败',
        details
      }
    });
  }
  
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'UNIQUE_CONSTRAINT_ERROR',
        message: '数据唯一性约束冲突',
        details: err.errors.map(e => e.message)
      }
    });
  }
  
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'FOREIGN_KEY_ERROR',
        message: '外键约束错误，关联数据不存在',
        details: err.fields
      }
    });
  }
  
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '服务器内部错误',
      details: process.env.NODE_ENV === 'development' ? err.message : null
    }
  });
};

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  BusinessError,
  ValidationError,
  NotFoundError,
  StateError,
  PermissionError,
  errorHandler,
  asyncHandler
};