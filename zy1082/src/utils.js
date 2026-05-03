const fs = require('fs');
const path = require('path');

class ValidationError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

function formatError(error) {
  if (error instanceof ValidationError) {
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        details: error.details
      }
    };
  }
  
  if (error.code === 'ENOENT') {
    return {
      success: false,
      error: {
        message: `文件或目录不存在: ${error.path || error.message}`,
        code: 'FILE_NOT_FOUND',
        details: { path: error.path }
      }
    };
  }
  
  if (error.code === 'EACCES') {
    return {
      success: false,
      error: {
        message: `权限不足，无法访问: ${error.path || error.message}`,
        code: 'PERMISSION_DENIED',
        details: { path: error.path }
      }
    };
  }
  
  if (error.name === 'SyntaxError') {
    return {
      success: false,
      error: {
        message: `JSON 解析错误: ${error.message}`,
        code: 'JSON_PARSE_ERROR',
        details: {}
      }
    };
  }
  
  return {
    success: false,
    error: {
      message: error.message || '未知错误',
      code: 'UNKNOWN_ERROR',
      details: {}
    }
  };
}

function validateDirectory(dirPath, options = {}) {
  const { required = false, mustBeDirectory = true } = options;
  
  if (!fs.existsSync(dirPath)) {
    if (required) {
      throw new ValidationError(
        `目录不存在: ${dirPath}`,
        'DIR_NOT_FOUND',
        { path: dirPath }
      );
    }
    return { exists: false, isDirectory: false };
  }
  
  const stats = fs.statSync(dirPath);
  
  if (mustBeDirectory && !stats.isDirectory()) {
    throw new ValidationError(
      `路径不是目录: ${dirPath}`,
      'NOT_A_DIRECTORY',
      { path: dirPath }
    );
  }
  
  return { exists: true, isDirectory: stats.isDirectory() };
}

function validateFile(filePath, options = {}) {
  const { required = false, extensions = null } = options;
  
  if (!fs.existsSync(filePath)) {
    if (required) {
      throw new ValidationError(
        `文件不存在: ${filePath}`,
        'FILE_NOT_FOUND',
        { path: filePath }
      );
    }
    return { exists: false, isFile: false };
  }
  
  const stats = fs.statSync(filePath);
  
  if (!stats.isFile()) {
    throw new ValidationError(
      `路径不是文件: ${filePath}`,
      'NOT_A_FILE',
      { path: filePath }
    );
  }
  
  if (extensions) {
    const ext = path.extname(filePath).toLowerCase();
    const validExts = extensions.map(e => e.toLowerCase());
    if (!validExts.includes(ext)) {
      throw new ValidationError(
        `文件格式不正确，应为 ${extensions.join(' 或 '}`,
        'INVALID_EXTENSION',
        { path: filePath, expected: extensions, actual: ext }
      );
    }
  }
  
  return { exists: true, isFile: true };
}

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

function safeJSONParse(str, filePath = 'unknown') {
  try {
    return JSON.parse(str);
  } catch (error) {
    throw new ValidationError(
      `JSON 解析失败 (${filePath}): ${error.message}`,
      'JSON_PARSE_ERROR',
      { filePath, originalError: error.message }
    );
  }
}

module.exports = {
  ValidationError,
  formatError,
  validateDirectory,
  validateFile,
  ensureDirectory,
  safeJSONParse
};
