export type ErrorCode =
  | 'SECRET_NOT_FOUND'
  | 'SECRET_ALREADY_EXISTS'
  | 'SECRET_HAS_ACTIVE_REFERENCES'
  | 'INVALID_STATUS_TRANSITION'
  | 'REFERENCE_NOT_FOUND'
  | 'REPLACEMENT_NOT_FOUND'
  | 'INVALID_INPUT'
  | 'INVALID_ENVIRONMENT'
  | 'OPERATION_NOT_ALLOWED'
  | 'INTERNAL_ERROR';

export interface ApiErrorDetails {
  raw_input: any;
  processing_basis: string;
  conclusion: string;
  references?: any[];
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: ApiErrorDetails;

  constructor(code: ErrorCode, message: string, statusCode: number = 400, details?: ApiErrorDetails) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorMessages: Record<ErrorCode, string> = {
  SECRET_NOT_FOUND: 'Secret不存在',
  SECRET_ALREADY_EXISTS: 'Secret已存在',
  SECRET_HAS_ACTIVE_REFERENCES: '该Secret存在活跃引用',
  INVALID_STATUS_TRANSITION: '无效的状态转换',
  REFERENCE_NOT_FOUND: '引用不存在',
  REPLACEMENT_NOT_FOUND: '替换计划不存在',
  INVALID_INPUT: '输入参数无效',
  INVALID_ENVIRONMENT: '无效的环境类型',
  OPERATION_NOT_ALLOWED: '操作不被允许',
  INTERNAL_ERROR: '内部服务器错误',
};

export function createError(
  code: ErrorCode,
  statusCode: number = 400,
  details?: ApiErrorDetails
): AppError {
  return new AppError(code, errorMessages[code], statusCode, details);
}
