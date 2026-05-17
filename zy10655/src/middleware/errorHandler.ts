import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors';
import { ApiResponse, ErrorCode } from '../types';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error:', err);
  
  if (err instanceof AppError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        suggestion: err.suggestion
      }
    };
    
    let statusCode = 400;
    switch (err.code) {
      case ErrorCode.ADJUSTMENT_NOT_FOUND:
        statusCode = 404;
        break;
      case ErrorCode.DUPLICATE_REQUEST:
      case ErrorCode.CONFLICT_ADJUSTMENT:
        statusCode = 409;
        break;
      case ErrorCode.INVALID_STATUS_TRANSITION:
        statusCode = 422;
        break;
    }
    
    res.status(statusCode).json(response);
    return;
  }
  
  const response: ApiResponse = {
    success: false,
    error: {
      code: ErrorCode.DATABASE_ERROR,
      message: '服务器内部错误',
      suggestion: '请稍后重试或联系技术支持'
    }
  };
  
  res.status(500).json(response);
}
