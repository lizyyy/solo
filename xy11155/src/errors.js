class DataValidationError extends Error {
  constructor(message, sourceFile, lineNumber, field, value) {
    super(message);
    this.name = 'DataValidationError';
    this.sourceFile = sourceFile;
    this.lineNumber = lineNumber;
    this.field = field;
    this.value = value;
  }

  toDisplayString() {
    let result = `[${this.sourceFile}:${this.lineNumber}] ${this.message}`;
    if (this.field) {
      result += ` | 字段: ${this.field}`;
    }
    if (this.value !== undefined) {
      result += ` | 值: "${this.value}"`;
    }
    return result;
  }
}

class FileReadError extends Error {
  constructor(message, filePath, cause) {
    super(message);
    this.name = 'FileReadError';
    this.filePath = filePath;
    this.cause = cause;
  }

  toDisplayString() {
    return `[${this.filePath}] ${this.message}`;
  }
}

class InvalidFormatError extends Error {
  constructor(message, sourceFile, lineNumber, expected, actual) {
    super(message);
    this.name = 'InvalidFormatError';
    this.sourceFile = sourceFile;
    this.lineNumber = lineNumber;
    this.expected = expected;
    this.actual = actual;
  }

  toDisplayString() {
    let result = `[${this.sourceFile}:${this.lineNumber}] ${this.message}`;
    if (this.expected) {
      result += `\n    期望格式: ${this.expected}`;
    }
    if (this.actual) {
      result += `\n    实际值: ${this.actual}`;
    }
    return result;
  }
}

module.exports = {
  DataValidationError,
  FileReadError,
  InvalidFormatError
};
