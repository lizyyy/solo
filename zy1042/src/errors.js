export class BaseError extends Error {
  constructor(message, code) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class FileNotFoundError extends BaseError {
  constructor(filePath) {
    super(`文件不存在: ${filePath}`, 'FILE_NOT_FOUND');
    this.filePath = filePath;
  }
}

export class InvalidFormatError extends BaseError {
  constructor(message, filePath) {
    super(`文件格式错误 [${filePath}]: ${message}`, 'INVALID_FORMAT');
    this.filePath = filePath;
  }
}

export class InvalidOpenAPIVersionError extends BaseError {
  constructor(version, filePath) {
    super(`不支持的 OpenAPI 版本: ${version} (仅支持 OpenAPI 3.x)`, 'INVALID_OPENAPI_VERSION');
    this.version = version;
    this.filePath = filePath;
  }
}

export class InvalidSamplesFormatError extends BaseError {
  constructor(message) {
    super(`请求样例格式错误: ${message}`, 'INVALID_SAMPLES_FORMAT');
  }
}

export class ValidationError extends BaseError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR');
  }
}

export function isExpectedError(err) {
  return err instanceof BaseError;
}

export function formatErrorForConsole(err) {
  if (isExpectedError(err)) {
    return {
      code: err.code,
      message: err.message
    };
  }
  return {
    code: 'UNEXPECTED_ERROR',
    message: err.message || '发生未知错误'
  };
}
