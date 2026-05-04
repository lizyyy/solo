class BaseError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      details: this.details
    };
  }
}

class FileError extends BaseError {
  constructor(message, details = {}) {
    super(message, details);
    this.userMessage = this.formatUserMessage();
  }

  formatUserMessage() {
    const parts = [];
    parts.push(`❌ 文件错误: ${this.message}`);
    
    if (this.details.filePath) {
      parts.push(`   路径: ${this.details.filePath}`);
    }
    
    if (this.details.originalError) {
      parts.push(`   详细: ${this.details.originalError}`);
    }
    
    return parts.join('\n');
  }
}

class ValidationError extends BaseError {
  constructor(message, details = {}) {
    super(message, details);
    this.userMessage = this.formatUserMessage();
  }

  formatUserMessage() {
    const parts = [];
    parts.push(`⚠️  验证错误: ${this.message}`);
    
    if (this.details.filePath) {
      parts.push(`   文件: ${this.details.filePath}`);
    }
    
    if (this.details.lineNumber !== undefined) {
      parts.push(`   行号: ${this.details.lineNumber}`);
    }
    
    if (this.details.jsonPath) {
      parts.push(`   路径: ${this.details.jsonPath}`);
    }
    
    if (this.details.originalError) {
      parts.push(`   详细: ${this.details.originalError}`);
    }
    
    if (this.details.expected && this.details.actual) {
      parts.push(`   期望: ${this.details.expected}`);
      parts.push(`   实际: ${this.details.actual}`);
    }
    
    return parts.join('\n');
  }
}

class ParseError extends BaseError {
  constructor(message, details = {}) {
    super(message, details);
    this.userMessage = this.formatUserMessage();
  }

  formatUserMessage() {
    const parts = [];
    parts.push(`⚠️  解析错误: ${this.message}`);
    
    if (this.details.filePath) {
      parts.push(`   文件: ${this.details.filePath}`);
    }
    
    if (this.details.lineNumber !== undefined) {
      parts.push(`   行号: ${this.details.lineNumber}`);
    }
    
    if (this.details.columnNumber !== undefined) {
      parts.push(`   列号: ${this.details.columnNumber}`);
    }
    
    if (this.details.originalError) {
      parts.push(`   详细: ${this.details.originalError}`);
    }
    
    if (this.details.context) {
      parts.push(`   上下文: ${this.details.context}`);
    }
    
    return parts.join('\n');
  }
}

class ComparisonError extends BaseError {
  constructor(message, details = {}) {
    super(message, details);
    this.userMessage = this.formatUserMessage();
  }

  formatUserMessage() {
    const parts = [];
    parts.push(`⚠️  比较错误: ${this.message}`);
    
    if (this.details.endpoint) {
      parts.push(`   端点: ${this.details.endpoint}`);
    }
    
    if (this.details.field) {
      parts.push(`   字段: ${this.details.field}`);
    }
    
    if (this.details.source1) {
      parts.push(`   来源1: ${this.details.source1}`);
    }
    
    if (this.details.source2) {
      parts.push(`   来源2: ${this.details.source2}`);
    }
    
    return parts.join('\n');
  }
}

class ConfigError extends BaseError {
  constructor(message, details = {}) {
    super(message, details);
    this.userMessage = this.formatUserMessage();
  }

  formatUserMessage() {
    const parts = [];
    parts.push(`⚠️  配置错误: ${this.message}`);
    
    if (this.details.configPath) {
      parts.push(`   配置文件: ${this.details.configPath}`);
    }
    
    if (this.details.field) {
      parts.push(`   字段: ${this.details.field}`);
    }
    
    if (this.details.expected) {
      parts.push(`   期望: ${this.details.expected}`);
    }
    
    if (this.details.actual) {
      parts.push(`   实际: ${this.details.actual}`);
    }
    
    return parts.join('\n');
  }
}

module.exports = {
  BaseError,
  FileError,
  ValidationError,
  ParseError,
  ComparisonError,
  ConfigError
};
