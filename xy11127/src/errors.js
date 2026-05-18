class VerificationError extends Error {
  constructor(message, sourceFile, lineNumber, type, details = {}) {
    super(message)
    this.name = 'VerificationError'
    this.sourceFile = sourceFile
    this.lineNumber = lineNumber
    this.type = type
    this.details = details
  }

  toJSON() {
    return {
      error: this.message,
      sourceFile: this.sourceFile,
      lineNumber: this.lineNumber,
      type: this.type,
      details: this.details
    }
  }

  toString() {
    return `[${this.type}] ${this.message} (文件: ${this.sourceFile}, 行号: ${this.lineNumber})`
  }
}

class ColumnMissingError extends VerificationError {
  constructor(columnName, sourceFile, lineNumber) {
    super(`缺少必需列: ${columnName}`, sourceFile, lineNumber, 'COLUMN_MISSING', { columnName })
  }
}

class DuplicateRowError extends VerificationError {
  constructor(duplicateKey, sourceFile, lineNumber, existingLine) {
    super(`重复记录: ${duplicateKey}`, sourceFile, lineNumber, 'DUPLICATE_ROW', { duplicateKey, existingLine })
  }
}

class EncodingError extends VerificationError {
  constructor(message, sourceFile, lineNumber = 0) {
    super(`编码异常: ${message}`, sourceFile, lineNumber, 'ENCODING_ERROR', {})
  }
}

class EmptyValueError extends VerificationError {
  constructor(columnName, sourceFile, lineNumber) {
    super(`列 ${columnName} 值为空`, sourceFile, lineNumber, 'EMPTY_VALUE', { columnName })
  }
}

class InvalidFormatError extends VerificationError {
  constructor(columnName, value, expectedFormat, sourceFile, lineNumber) {
    super(`列 ${columnName} 格式错误: ${value}, 期望格式: ${expectedFormat}`, sourceFile, lineNumber, 'INVALID_FORMAT', { columnName, value, expectedFormat })
  }
}

module.exports = {
  VerificationError,
  ColumnMissingError,
  DuplicateRowError,
  EncodingError,
  EmptyValueError,
  InvalidFormatError
}
