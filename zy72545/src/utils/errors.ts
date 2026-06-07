import { ApiError } from '../types';

export const ERROR_CODES = {
  PROMPT_VERSION_NOT_FOUND: 'PROMPT_VERSION_NOT_FOUND',
  SAMPLE_NOT_FOUND: 'SAMPLE_NOT_FOUND',
  DUPLICATE_IMPORT: 'DUPLICATE_IMPORT',
  INVALID_CONFIDENCE: 'INVALID_CONFIDENCE',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  LOW_CONFIDENCE_MASKED: 'LOW_CONFIDENCE_MASKED',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

export function createError(code: string, message: string, userMessage: string): ApiError {
  return { code, message, userMessage };
}

export function createUserFriendlyError(code: string, technicalMessage: string): ApiError {
  const userMessages: Record<string, string> = {
    [ERROR_CODES.PROMPT_VERSION_NOT_FOUND]: '找不到对应的提示词版本，请检查版本号是否正确',
    [ERROR_CODES.SAMPLE_NOT_FOUND]: '找不到对应的工艺参数样本',
    [ERROR_CODES.DUPLICATE_IMPORT]: '该批次提示词版本已导入过，系统已自动跳过重复项',
    [ERROR_CODES.INVALID_CONFIDENCE]: '置信度参数不合法，应为高/中/低三档',
    [ERROR_CODES.INVALID_STATUS_TRANSITION]: '当前状态不允许执行此操作，请联系知识库编辑',
    [ERROR_CODES.MISSING_REQUIRED_FIELD]: '缺少必填信息，请完整填写后再提交',
    [ERROR_CODES.LOW_CONFIDENCE_MASKED]: '该样本为低置信度且被平均指标覆盖，需知识库编辑复核后才能确认',
    [ERROR_CODES.DATABASE_ERROR]: '系统内部错误，请稍后重试或联系技术支持',
  };
  return createError(code, technicalMessage, userMessages[code] || '操作失败，请稍后重试');
}

export class AppError extends Error {
  public readonly code: string;
  public readonly userMessage: string;

  constructor(code: string, technicalMessage: string) {
    super(technicalMessage);
    this.code = code;
    this.userMessage = createUserFriendlyError(code, technicalMessage).userMessage;
    this.name = 'AppError';
  }
}
