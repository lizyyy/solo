export class AppError extends Error {
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, code: string = 'UNKNOWN_ERROR', details?: any) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'DATABASE_ERROR', details);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends AppError {
  public readonly fieldErrors: string[];

  constructor(message: string, fieldErrors: string[] = []) {
    super(message, 'VALIDATION_ERROR', fieldErrors);
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }
}

export class DuplicateError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'DUPLICATE_ERROR', details);
    this.name = 'DuplicateError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'NOT_FOUND_ERROR', details);
    this.name = 'NotFoundError';
  }
}

export class ImportError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'IMPORT_ERROR', details);
    this.name = 'ImportError';
  }
}

export function handleError(error: unknown): void {
  if (error instanceof AppError) {
    console.error(`\n❌ 错误 [${error.code}]: ${error.message}`);
    if (error.details) {
      console.error('详情:', error.details);
    }
  } else if (error instanceof Error) {
    console.error(`\n❌ 未预期的错误: ${error.message}`);
    console.error(error.stack);
  } else {
    console.error(`\n❌ 未知错误: ${error}`);
  }
  
  process.exit(1);
}

export function formatErrorForUser(error: unknown): string {
  if (error instanceof ValidationError) {
    const fieldErrors = error.fieldErrors.length > 0 
      ? `\n   - ${error.fieldErrors.join('\n   - ')}` 
      : '';
    return `❌ 验证失败: ${error.message}${fieldErrors}`;
  }
  
  if (error instanceof ImportError) {
    return `❌ 导入失败: ${error.message}`;
  }
  
  if (error instanceof DatabaseError) {
    return `❌ 数据库错误: ${error.message}`;
  }
  
  if (error instanceof AppError) {
    return `❌ 错误: ${error.message}`;
  }
  
  if (error instanceof Error) {
    return `❌ 系统错误: ${error.message}`;
  }
  
  return `❌ 未知错误: ${error}`;
}
