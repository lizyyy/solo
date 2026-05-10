import { ApiResponse } from '../types';

export const successResponse = <T>(data: T, message: string = '操作成功'): ApiResponse<T> => ({
  success: true,
  data,
  message,
  timestamp: new Date().toISOString()
});

export const errorResponse = (message: string, errorCode?: string): ApiResponse => ({
  success: false,
  message,
  errorCode,
  timestamp: new Date().toISOString()
});

export class AppError extends Error {
  public readonly errorCode: string;
  public readonly statusCode: number;

  constructor(message: string, errorCode: string = 'INTERNAL_ERROR', statusCode: number = 500) {
    super(message);
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export const errorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  FORBIDDEN: 'FORBIDDEN',
  BAD_REQUEST: 'BAD_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  IDEMPOTENT_CONFLICT: 'IDEMPOTENT_CONFLICT',
  SAMPLE_FROZEN: 'SAMPLE_FROZEN',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  DUPLICATE_OPERATION: 'DUPLICATE_OPERATION'
};
