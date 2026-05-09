const errorCodes = require('../config/error-codes');

function success(data = null, message = '成功') {
  return {
    success: true,
    code: 0,
    message,
    data,
    timestamp: Date.now()
  };
}

function error(errorCode, details = null) {
  return {
    success: false,
    code: errorCode.code,
    message: errorCode.message,
    details,
    timestamp: Date.now()
  };
}

class AppError extends Error {
  constructor(errorCode, details = null) {
    super(errorCode.message);
    this.code = errorCode.code;
    this.errorCode = errorCode;
    this.details = details;
  }
}

module.exports = {
  success,
  error,
  AppError,
  errorCodes
};
